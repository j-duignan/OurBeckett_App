-- =====================================================================
-- OurBeckett: functions, triggers and views
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Email domain restriction (server-side, cannot be bypassed)
-- ---------------------------------------------------------------------
create or replace function public.is_student_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    lower(trim(p_email)) ~ '^[a-z0-9._%+-]+@student\.leedsbeckett\.ac\.uk$',
    false
  );
$$;

-- Hard guarantee: any attempt to create an auth user, or change a user's
-- email, to an address outside the student domain is rejected by Postgres.
-- This runs inside the database, so it applies to every sign-up path
-- (mobile app, direct API calls, admin invites, OAuth, etc.).
create or replace function public.enforce_student_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_student_email(new.email) then
    raise exception 'Only @student.leedsbeckett.ac.uk email addresses can register'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE'
     and coalesce(new.email_change, '') <> ''
     and not public.is_student_email(new.email_change) then
    raise exception 'Only @student.leedsbeckett.ac.uk email addresses are allowed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger enforce_student_email_on_insert
  before insert on auth.users
  for each row execute function public.enforce_student_email();

create trigger enforce_student_email_on_update
  before update of email, email_change on auth.users
  for each row execute function public.enforce_student_email();

-- Optional but recommended: Supabase "Before User Created" auth hook.
-- When enabled (Dashboard > Authentication > Hooks) it rejects bad
-- domains with a clean 403 + readable message before the insert is
-- attempted. The trigger above remains the guarantee either way.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_student_email(event -> 'user' ->> 'email') then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Only @student.leedsbeckett.ac.uk email addresses can join OurBeckett.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Profile bootstrap
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  v_display  text := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if v_username !~ '^[a-z0-9_.]{3,20}$' then
    v_username := 'student_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  if v_display = '' or char_length(v_display) > 50 then
    v_display := v_username;
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_display);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up screen check a username before the account exists.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(p_username) ~ '^[a-z0-9_.]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(p_username));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Access helpers (security definer so RLS policies can call them
--    without recursion)
-- ---------------------------------------------------------------------
create or replace function public.is_blocked_pair(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
       or (b.blocker_id = p_other and b.blocked_id = auth.uid())
  );
$$;

create or replace function public.is_conversation_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation and m.user_id = auth.uid()
  );
$$;

-- True when the other participant of a conversation has a block with me.
create or replace function public.conversation_has_block(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation
      and m.user_id <> auth.uid()
      and public.is_blocked_pair(m.user_id)
  );
$$;

create or replace function public.community_role(p_community uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.community_members m
  where m.community_id = p_community and m.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 4. Generic triggers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger posts_updated_at before update of body on public.posts
  for each row execute function public.set_updated_at();
create trigger events_updated_at
  before update of title, description, category, location, starts_at, ends_at, cover_url on public.events
  for each row execute function public.set_updated_at();
create trigger listings_updated_at before update on public.marketplace_listings
  for each row execute function public.set_updated_at();

-- Hashtags are derived from the post body on the server, never trusted
-- from the client.
create or replace function public.extract_hashtags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.hashtags := array(
    select distinct lower(m[1])
    from regexp_matches(new.body, '#([A-Za-z0-9_]{2,40})', 'g') as m
    limit 10
  );
  return new;
end;
$$;

create trigger posts_hashtags before insert or update of body on public.posts
  for each row execute function public.extract_hashtags();

-- ---------------------------------------------------------------------
-- 5. Counters + notifications
-- ---------------------------------------------------------------------
create or replace function public.on_post_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set posts_count = posts_count + 1 where id = new.author_id;
    if new.community_id is not null then
      update public.communities set post_count = post_count + 1 where id = new.community_id;
    end if;
    return new;
  end if;
  update public.profiles set posts_count = greatest(posts_count - 1, 0) where id = old.author_id;
  if old.community_id is not null then
    update public.communities set post_count = greatest(post_count - 1, 0) where id = old.community_id;
  end if;
  return old;
end;
$$;
create trigger posts_counts after insert or delete on public.posts
  for each row execute function public.on_post_change();

create or replace function public.on_like_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1
      where id = new.post_id returning author_id into v_author;
    if v_author is not null and v_author <> new.user_id then
      insert into public.notifications (user_id, actor_id, type, post_id)
      values (v_author, new.user_id, 'like', new.post_id);
    end if;
    return new;
  end if;
  update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  delete from public.notifications
    where type = 'like' and actor_id = old.user_id and post_id = old.post_id;
  return old;
end;
$$;
create trigger likes_change after insert or delete on public.likes
  for each row execute function public.on_like_change();

-- Replies are kept one level deep (like Instagram). A reply to a reply is
-- attached to the top-level comment.
create or replace function public.prepare_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.comments%rowtype;
begin
  if new.parent_id is not null then
    select * into v_parent from public.comments where id = new.parent_id;
    if not found or v_parent.post_id <> new.post_id then
      raise exception 'Parent comment does not belong to this post';
    end if;
    if v_parent.parent_id is not null then
      new.parent_id := v_parent.parent_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger comments_prepare before insert on public.comments
  for each row execute function public.prepare_comment();

create or replace function public.on_comment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author   uuid;
  v_parent_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1
      where id = new.post_id returning author_id into v_post_author;

    if new.parent_id is not null then
      select author_id into v_parent_author from public.comments where id = new.parent_id;
      if v_parent_author is not null and v_parent_author <> new.author_id then
        insert into public.notifications (user_id, actor_id, type, post_id, comment_id, preview)
        values (v_parent_author, new.author_id, 'reply', new.post_id, new.id, left(new.body, 140));
      end if;
    end if;

    if v_post_author is not null
       and v_post_author <> new.author_id
       and v_post_author is distinct from v_parent_author then
      insert into public.notifications (user_id, actor_id, type, post_id, comment_id, preview)
      values (v_post_author, new.author_id, 'comment', new.post_id, new.id, left(new.body, 140));
    end if;
    return new;
  end if;

  update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;
create trigger comments_change after insert or delete on public.comments
  for each row execute function public.on_comment_change();

create or replace function public.on_follow_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    insert into public.notifications (user_id, actor_id, type)
    values (new.following_id, new.follower_id, 'follow');
    return new;
  end if;
  update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
  delete from public.notifications
    where type = 'follow' and actor_id = old.follower_id and user_id = old.following_id;
  return old;
end;
$$;
create trigger follows_change after insert or delete on public.follows
  for each row execute function public.on_follow_change();

-- Blocking someone removes follows in both directions.
create or replace function public.on_block_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;
create trigger blocks_created after insert on public.blocks
  for each row execute function public.on_block_created();

create or replace function public.on_community_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.creator_id is not null then
    insert into public.community_members (community_id, user_id, role)
    values (new.id, new.creator_id, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger communities_created after insert on public.communities
  for each row execute function public.on_community_created();

create or replace function public.on_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.role <> 'banned' then
      update public.communities set member_count = member_count + 1 where id = new.community_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.role <> 'banned' then
      update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
    end if;
    return old;
  end if;
  -- UPDATE
  if old.role <> 'banned' and new.role = 'banned' then
    update public.communities set member_count = greatest(member_count - 1, 0) where id = new.community_id;
  elsif old.role = 'banned' and new.role <> 'banned' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  end if;
  return new;
end;
$$;
create trigger community_members_change after insert or update of role or delete on public.community_members
  for each row execute function public.on_membership_change();

create or replace function public.on_attendee_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.events set attendee_count = attendee_count + 1 where id = new.event_id;
    return new;
  end if;
  update public.events set attendee_count = greatest(attendee_count - 1, 0) where id = old.event_id;
  return old;
end;
$$;
create trigger event_attendees_change after insert or delete on public.event_attendees
  for each row execute function public.on_attendee_change();

-- Attendees are notified when the organiser changes anything important.
create or replace function public.on_event_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.title, new.description, new.location, new.starts_at, new.ends_at)
     is distinct from (old.title, old.description, old.location, old.starts_at, old.ends_at) then
    insert into public.notifications (user_id, actor_id, type, event_id, preview)
    select a.user_id, new.creator_id, 'event_update', new.id, left(new.title, 140)
    from public.event_attendees a
    where a.event_id = new.id and a.user_id <> new.creator_id;
  end if;
  return new;
end;
$$;
create trigger events_updated after update on public.events
  for each row execute function public.on_event_updated();

-- New message: bump conversation, mark sender as read, and keep a single
-- unread "message" notification per conversation per recipient.
create or replace function public.on_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preview text := case
    when char_length(trim(new.body)) > 0 then left(new.body, 140)
    else '📷 Photo'
  end;
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = v_preview,
         last_message_sender = new.sender_id
   where id = new.conversation_id;

  update public.conversation_members
     set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;

  delete from public.notifications n
   where n.type = 'message'
     and n.conversation_id = new.conversation_id
     and n.user_id <> new.sender_id
     and n.read_at is null;

  insert into public.notifications (user_id, actor_id, type, conversation_id, preview)
  select m.user_id, new.sender_id, 'message', new.conversation_id, v_preview
  from public.conversation_members m
  where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id;

  return new;
end;
$$;
create trigger messages_inserted after insert on public.messages
  for each row execute function public.on_message_inserted();

-- Unsending a message: refresh the conversation preview from what's left
-- and drop the recipient's unread notification for it.
create or replace function public.on_message_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last public.messages%rowtype;
begin
  select * into v_last from public.messages
  where conversation_id = old.conversation_id
  order by created_at desc
  limit 1;

  update public.conversations
     set last_message_at = coalesce(v_last.created_at, last_message_at),
         last_message_preview = case
           when v_last.id is null then null
           when char_length(trim(v_last.body)) > 0 then left(v_last.body, 140)
           else '📷 Photo'
         end,
         last_message_sender = v_last.sender_id
   where id = old.conversation_id;

  delete from public.notifications
   where type = 'message'
     and conversation_id = old.conversation_id
     and actor_id = old.sender_id
     and read_at is null;
  return old;
end;
$$;
create trigger messages_deleted after delete on public.messages
  for each row execute function public.on_message_deleted();

-- ---------------------------------------------------------------------
-- 6. Read models (views run with the caller's permissions, so RLS applies)
-- ---------------------------------------------------------------------
create or replace view public.post_feed
with (security_invoker = true) as
select
  p.id,
  p.author_id,
  p.community_id,
  p.body,
  p.media_urls,
  p.media_type,
  p.hashtags,
  p.like_count,
  p.comment_count,
  p.share_count,
  p.created_at,
  a.username     as author_username,
  a.display_name as author_display_name,
  a.avatar_url   as author_avatar_url,
  c.name         as community_name,
  c.slug         as community_slug,
  c.icon         as community_icon,
  exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid())     as liked_by_me,
  exists (select 1 from public.bookmarks b where b.post_id = p.id and b.user_id = auth.uid()) as bookmarked_by_me
from public.posts p
join public.profiles a on a.id = p.author_id
left join public.communities c on c.id = p.community_id
where not public.is_blocked_pair(p.author_id);

-- Community posts live in public.posts; this view is the community lens.
create or replace view public.community_posts
with (security_invoker = true) as
select * from public.post_feed where community_id is not null;

create or replace view public.comment_feed
with (security_invoker = true) as
select
  cm.id,
  cm.post_id,
  cm.author_id,
  cm.parent_id,
  cm.body,
  cm.created_at,
  a.username     as author_username,
  a.display_name as author_display_name,
  a.avatar_url   as author_avatar_url
from public.comments cm
join public.profiles a on a.id = cm.author_id
where not public.is_blocked_pair(cm.author_id);

create or replace view public.event_feed
with (security_invoker = true) as
select
  e.id,
  e.creator_id,
  e.community_id,
  e.title,
  e.description,
  e.category,
  e.location,
  e.starts_at,
  e.ends_at,
  e.cover_url,
  e.attendee_count,
  e.created_at,
  e.updated_at,
  cr.username     as creator_username,
  cr.display_name as creator_display_name,
  cr.avatar_url   as creator_avatar_url,
  exists (select 1 from public.event_attendees ea where ea.event_id = e.id and ea.user_id = auth.uid()) as going_by_me
from public.events e
join public.profiles cr on cr.id = e.creator_id
where not public.is_blocked_pair(e.creator_id);

create or replace view public.listing_feed
with (security_invoker = true) as
select
  l.id,
  l.seller_id,
  l.title,
  l.description,
  l.price,
  l.listing_type,
  l.category,
  l.condition,
  l.image_urls,
  l.status,
  l.created_at,
  l.updated_at,
  s.username     as seller_username,
  s.display_name as seller_display_name,
  s.avatar_url   as seller_avatar_url
from public.marketplace_listings l
join public.profiles s on s.id = l.seller_id
where not public.is_blocked_pair(l.seller_id);

create or replace view public.community_feed
with (security_invoker = true) as
select
  c.id,
  c.slug,
  c.name,
  c.description,
  c.category,
  c.icon,
  c.cover_url,
  c.creator_id,
  c.is_official,
  c.member_count,
  c.post_count,
  c.created_at,
  (select m.role from public.community_members m where m.community_id = c.id and m.user_id = auth.uid()) as my_role
from public.communities c;

-- ---------------------------------------------------------------------
-- 7. RPCs used by the app
-- ---------------------------------------------------------------------
create or replace function public.get_feed(
  p_mode   text default 'for_you',
  p_limit  integer default 20,
  p_offset integer default 0
)
returns setof public.post_feed
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_interests text[];
begin
  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  if p_mode = 'latest' then
    return query
      select * from public.post_feed f
      order by f.created_at desc, f.id
      limit p_limit offset p_offset;

  elsif p_mode = 'following' then
    return query
      select * from public.post_feed f
      where f.author_id = v_uid
         or f.author_id in (select fo.following_id from public.follows fo where fo.follower_id = v_uid)
      order by f.created_at desc, f.id
      limit p_limit offset p_offset;

  elsif p_mode = 'trending' then
    return query
      select * from public.post_feed f
      where f.created_at > now() - interval '7 days'
      order by (f.like_count + 2 * f.comment_count + 3 * f.share_count) desc, f.created_at desc, f.id
      limit p_limit offset p_offset;

  elsif p_mode = 'discussions' then
    return query
      select * from public.post_feed f
      where f.community_id is not null
        and f.created_at > now() - interval '14 days'
      order by f.comment_count desc, f.like_count desc, f.created_at desc, f.id
      limit p_limit offset p_offset;

  else
    -- "For You": engagement, boosted by people you follow, communities
    -- you are in and your interests, decayed by age.
    select array(select replace(lower(x), ' ', '') from unnest(pr.interests) as x)
      into v_interests
      from public.profiles pr where pr.id = v_uid;

    return query
      select * from public.post_feed f
      where f.created_at > now() - interval '60 days'
      order by (
        (1 + f.like_count + 2 * f.comment_count + 3 * f.share_count)::float8
        * (case when f.author_id in (select fo.following_id from public.follows fo where fo.follower_id = v_uid) then 3 else 1 end)
        * (case when f.community_id in (
              select cm.community_id from public.community_members cm
              where cm.user_id = v_uid and cm.role <> 'banned') then 2 else 1 end)
        * (case when f.hashtags && coalesce(v_interests, '{}') then 1.5 else 1 end)
        / power(extract(epoch from (now() - f.created_at)) / 3600.0 + 2, 1.4)
      ) desc, f.created_at desc, f.id
      limit p_limit offset p_offset;
  end if;
end;
$$;

create or replace function public.get_bookmarks(p_limit integer default 20, p_offset integer default 0)
returns setof public.post_feed
language sql
stable
security invoker
set search_path = ''
as $$
  select f.*
  from public.post_feed f
  join public.bookmarks b on b.post_id = f.id and b.user_id = auth.uid()
  order by b.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;

create or replace function public.trending_hashtags(p_limit integer default 10)
returns table (tag text, post_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.tag, count(*) as post_count
  from public.posts p, unnest(p.hashtags) as t(tag)
  where p.created_at > now() - interval '14 days'
  group by t.tag
  order by count(*) desc, t.tag
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.suggested_users(p_limit integer default 10)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  course text,
  followers_count integer,
  shared_interests integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select pr.interests, pr.course from public.profiles pr where pr.id = auth.uid()
  )
  select
    p.id, p.username, p.display_name, p.avatar_url, p.bio, p.course, p.followers_count,
    cardinality(array(select unnest(p.interests) intersect select unnest(me.interests)))::integer as shared_interests
  from public.profiles p
  cross join me
  where p.id <> auth.uid()
    and p.onboarded
    and not exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id
    )
    and not public.is_blocked_pair(p.id)
  order by
    shared_interests desc,
    (p.course is not null and p.course = me.course) desc,
    p.followers_count desc,
    p.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.increment_share(p_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.posts set share_count = share_count + 1 where id = p_post;
end;
$$;

-- Finds the existing 1:1 conversation with another student, or creates it.
create or replace function public.get_or_create_dm(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_conv uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if p_other is null or p_other = v_me then
    raise exception 'You cannot message yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'User not found';
  end if;
  if public.is_blocked_pair(p_other) then
    raise exception 'You cannot message this user';
  end if;

  -- Serialise creation for this pair so two taps can't create duplicates.
  perform pg_advisory_xact_lock(
    hashtext(least(v_me::text, p_other::text) || greatest(v_me::text, p_other::text))
  );

  select m1.conversation_id into v_conv
  from public.conversation_members m1
  join public.conversation_members m2
    on m2.conversation_id = m1.conversation_id and m2.user_id = p_other
  where m1.user_id = v_me
  limit 1;

  if v_conv is not null then
    return v_conv;
  end if;

  insert into public.conversations default values returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id)
  values (v_conv, v_me), (v_conv, p_other);
  return v_conv;
end;
$$;

create or replace function public.my_conversations()
returns table (
  conversation_id      uuid,
  other_user_id        uuid,
  other_username       text,
  other_display_name   text,
  other_avatar_url     text,
  other_last_seen_at   timestamptz,
  last_message_at      timestamptz,
  last_message_preview text,
  last_message_sender  uuid,
  unread_count         integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    o.id,
    o.username,
    o.display_name,
    o.avatar_url,
    o.last_seen_at,
    c.last_message_at,
    c.last_message_preview,
    c.last_message_sender,
    (
      select count(*)::integer from public.messages msg
      where msg.conversation_id = c.id
        and msg.sender_id <> me.user_id
        and msg.created_at > me.last_read_at
    )
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_members om on om.conversation_id = c.id and om.user_id <> me.user_id
  join public.profiles o on o.id = om.user_id
  where me.user_id = auth.uid()
    and c.last_message_preview is not null
    and not public.is_blocked_pair(o.id)
  order by c.last_message_at desc;
$$;

-- Functions are executable by PUBLIC (and anon via Supabase default
-- privileges); restrict app RPCs to signed-in students.
-- username_available is the one deliberate anon exception.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.get_feed(text, integer, integer)',
    'public.get_bookmarks(integer, integer)',
    'public.trending_hashtags(integer)',
    'public.suggested_users(integer)',
    'public.increment_share(uuid)',
    'public.get_or_create_dm(uuid)',
    'public.my_conversations()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
