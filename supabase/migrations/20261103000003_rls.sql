-- =====================================================================
-- OurBeckett: Row Level Security + column privileges
--
-- Principles
--   * Nothing is readable without a signed-in student session.
--   * Users can only create/modify/delete their own rows.
--   * Conversations and messages are visible to participants only.
--   * Counters, hashtags, ownership columns etc. are not client-writable:
--     table-level INSERT/UPDATE is revoked and re-granted per column.
-- =====================================================================

-- Enable RLS on every table
alter table public.profiles             enable row level security;
alter table public.communities          enable row level security;
alter table public.community_members    enable row level security;
alter table public.posts                enable row level security;
alter table public.comments             enable row level security;
alter table public.likes                enable row level security;
alter table public.bookmarks            enable row level security;
alter table public.follows              enable row level security;
alter table public.blocks               enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.notifications        enable row level security;
alter table public.events               enable row level security;
alter table public.event_attendees      enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.reports              enable row level security;

-- Anonymous visitors get nothing from the tables at all.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy "profiles: students can read" on public.profiles
  for select to authenticated using (true);
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from authenticated;
grant update (username, display_name, bio, avatar_url, course, campus, interests, onboarded, last_seen_at)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- communities
-- ---------------------------------------------------------------------
create policy "communities: read" on public.communities
  for select to authenticated using (true);
create policy "communities: create as self" on public.communities
  for insert to authenticated with check (creator_id = (select auth.uid()) and is_official = false);
create policy "communities: owner/mods edit" on public.communities
  for update to authenticated
  using (public.community_role(id) in ('owner', 'moderator'))
  with check (public.community_role(id) in ('owner', 'moderator'));
create policy "communities: owner deletes" on public.communities
  for delete to authenticated using (public.community_role(id) = 'owner');

revoke insert, update on public.communities from authenticated;
grant insert (slug, name, description, category, icon, cover_url, creator_id) on public.communities to authenticated;
grant update (name, description, category, icon, cover_url) on public.communities to authenticated;

-- ---------------------------------------------------------------------
-- community_members
-- ---------------------------------------------------------------------
create policy "members: read" on public.community_members
  for select to authenticated using (true);
create policy "members: join as member" on public.community_members
  for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'member');
create policy "members: owner manages roles" on public.community_members
  for update to authenticated
  using (public.community_role(community_id) = 'owner' and role <> 'owner')
  with check (role in ('moderator', 'member', 'banned'));
create policy "members: moderators manage members" on public.community_members
  for update to authenticated
  using (public.community_role(community_id) = 'moderator' and role in ('member', 'banned'))
  with check (role in ('member', 'banned'));
create policy "members: leave or be removed" on public.community_members
  for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role in ('member', 'moderator'))
    or (public.community_role(community_id) = 'owner' and role in ('moderator', 'member'))
    or (public.community_role(community_id) = 'moderator' and role = 'member')
  );

revoke insert, update on public.community_members from authenticated;
grant insert (community_id, user_id) on public.community_members to authenticated;
grant update (role) on public.community_members to authenticated;

-- ---------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------
create policy "posts: read" on public.posts
  for select to authenticated using (true);
create policy "posts: create own" on public.posts
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (community_id is null or public.community_role(community_id) in ('owner', 'moderator', 'member'))
  );
create policy "posts: edit own" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "posts: delete own or moderate" on public.posts
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or (community_id is not null and public.community_role(community_id) in ('owner', 'moderator'))
  );

revoke insert, update on public.posts from authenticated;
grant insert (author_id, community_id, body, media_urls, media_type) on public.posts to authenticated;
grant update (body) on public.posts to authenticated;

-- ---------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------
create policy "comments: read" on public.comments
  for select to authenticated using (true);
create policy "comments: create own" on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and not public.is_blocked_pair(p.author_id)
        and (p.community_id is null or coalesce(public.community_role(p.community_id), '') <> 'banned')
    )
  );
create policy "comments: delete own, on own post, or moderate" on public.comments
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.posts p
      where p.id = post_id
        and (
          p.author_id = (select auth.uid())
          or (p.community_id is not null and public.community_role(p.community_id) in ('owner', 'moderator'))
        )
    )
  );

revoke insert, update on public.comments from authenticated;
grant insert (post_id, author_id, parent_id, body) on public.comments to authenticated;

-- ---------------------------------------------------------------------
-- likes / bookmarks
-- ---------------------------------------------------------------------
create policy "likes: read" on public.likes
  for select to authenticated using (true);
create policy "likes: like as self" on public.likes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "likes: unlike own" on public.likes
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.likes from authenticated;

create policy "bookmarks: own only" on public.bookmarks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "bookmarks: add own" on public.bookmarks
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "bookmarks: remove own" on public.bookmarks
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.bookmarks from authenticated;

-- ---------------------------------------------------------------------
-- follows / blocks
-- ---------------------------------------------------------------------
create policy "follows: read" on public.follows
  for select to authenticated using (true);
create policy "follows: follow as self" on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()) and not public.is_blocked_pair(following_id));
create policy "follows: unfollow own" on public.follows
  for delete to authenticated using (follower_id = (select auth.uid()));
revoke update on public.follows from authenticated;

-- Only the blocker can see their own block list. Nobody can see who
-- blocked them.
create policy "blocks: read own" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "blocks: create own" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "blocks: remove own" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));
revoke update on public.blocks from authenticated;

-- ---------------------------------------------------------------------
-- conversations / members / messages (participants only)
-- Conversations are created exclusively by get_or_create_dm().
-- ---------------------------------------------------------------------
create policy "conversations: participants read" on public.conversations
  for select to authenticated using (public.is_conversation_member(id));
revoke insert, update, delete on public.conversations from authenticated;

create policy "conversation_members: participants read" on public.conversation_members
  for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "conversation_members: update own read marker" on public.conversation_members
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

create policy "messages: participants read" on public.messages
  for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "messages: participants send" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_member(conversation_id)
    and not public.conversation_has_block(conversation_id)
  );
create policy "messages: delete own" on public.messages
  for delete to authenticated using (sender_id = (select auth.uid()));
revoke insert, update on public.messages from authenticated;
-- id is client-generated so optimistic messages can be de-duplicated
-- against the realtime echo.
grant insert (id, conversation_id, sender_id, body, image_path) on public.messages to authenticated;

-- ---------------------------------------------------------------------
-- notifications (created only by triggers)
-- ---------------------------------------------------------------------
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: mark own read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: delete own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create policy "events: read" on public.events
  for select to authenticated using (true);
create policy "events: create own" on public.events
  for insert to authenticated with check (creator_id = (select auth.uid()));
create policy "events: edit own" on public.events
  for update to authenticated
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));
create policy "events: delete own" on public.events
  for delete to authenticated using (creator_id = (select auth.uid()));
revoke insert, update on public.events from authenticated;
grant insert (creator_id, community_id, title, description, category, location, starts_at, ends_at, cover_url)
  on public.events to authenticated;
grant update (title, description, category, location, starts_at, ends_at, cover_url)
  on public.events to authenticated;

create policy "attendees: read" on public.event_attendees
  for select to authenticated using (true);
create policy "attendees: rsvp as self" on public.event_attendees
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "attendees: cancel own rsvp" on public.event_attendees
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.event_attendees from authenticated;

-- ---------------------------------------------------------------------
-- marketplace
-- ---------------------------------------------------------------------
create policy "listings: read" on public.marketplace_listings
  for select to authenticated using (true);
create policy "listings: create own" on public.marketplace_listings
  for insert to authenticated with check (seller_id = (select auth.uid()));
create policy "listings: edit own" on public.marketplace_listings
  for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
create policy "listings: delete own" on public.marketplace_listings
  for delete to authenticated using (seller_id = (select auth.uid()));
revoke insert, update on public.marketplace_listings from authenticated;
grant insert (seller_id, title, description, price, listing_type, category, condition, image_urls)
  on public.marketplace_listings to authenticated;
grant update (title, description, price, listing_type, category, condition, image_urls, status)
  on public.marketplace_listings to authenticated;

-- ---------------------------------------------------------------------
-- reports (write-only for students, except reading their own)
-- ---------------------------------------------------------------------
create policy "reports: file as self" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "reports: read own" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));
revoke insert, update, delete on public.reports from authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on public.reports to authenticated;

-- Views inherit RLS from their base tables (security_invoker), but keep
-- anon out of them explicitly.
revoke all on public.post_feed, public.community_posts, public.comment_feed,
              public.event_feed, public.listing_feed, public.community_feed from anon;
grant select on public.post_feed, public.community_posts, public.comment_feed,
               public.event_feed, public.listing_feed, public.community_feed to authenticated;
