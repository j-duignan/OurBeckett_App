-- =====================================================================
-- OurBeckett: core schema
-- Tables, constraints, indexes. Functions/triggers live in 0002,
-- Row Level Security in 0003, storage in 0004, seed data in 0005.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- profiles: one row per auth user. Email is NEVER stored here, so it
-- can never leak through the public profile API.
-- ---------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text not null unique
                  check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name    text not null
                  check (char_length(trim(display_name)) between 1 and 50),
  bio             text not null default '' check (char_length(bio) <= 300),
  avatar_url      text,
  course          text check (char_length(course) <= 100),
  campus          text check (campus in ('City Campus', 'Headingley Campus')),
  interests       text[] not null default '{}' check (cardinality(interests) <= 15),
  onboarded       boolean not null default false,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  posts_count     integer not null default 0,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index profiles_username_trgm on public.profiles using gin (username extensions.gin_trgm_ops);
create index profiles_display_name_trgm on public.profiles using gin (display_name extensions.gin_trgm_ops);
create index profiles_interests_gin on public.profiles using gin (interests);

-- ---------------------------------------------------------------------
-- communities
-- ---------------------------------------------------------------------
create table public.communities (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{3,50}$'),
  name         text not null check (char_length(trim(name)) between 3 and 60),
  description  text not null default '' check (char_length(description) <= 500),
  category     text not null default 'General'
               check (category in ('General', 'Course', 'Housing', 'Sport', 'Gaming', 'Nightlife', 'Deals', 'Society', 'Freshers')),
  icon         text not null default '💬' check (char_length(icon) <= 8),
  cover_url    text,
  creator_id   uuid references public.profiles (id) on delete set null,
  is_official  boolean not null default false,
  member_count integer not null default 0,
  post_count   integer not null default 0,
  created_at   timestamptz not null default now()
);
create unique index communities_name_lower_key on public.communities (lower(name));
create index communities_name_trgm on public.communities using gin (name extensions.gin_trgm_ops);
create index communities_member_count_idx on public.communities (member_count desc);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member'
               check (role in ('owner', 'moderator', 'member', 'banned')),
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user_idx on public.community_members (user_id);

-- ---------------------------------------------------------------------
-- posts. Home feed and community posts share one table so likes,
-- comments, bookmarks, reports and search work identically for both.
-- "community_posts" is exposed as a view over this table (see 0002).
-- ---------------------------------------------------------------------
create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles (id) on delete cascade,
  community_id  uuid references public.communities (id) on delete cascade,
  body          text not null default '' check (char_length(body) <= 2000),
  media_urls    text[] not null default '{}' check (cardinality(media_urls) <= 4),
  media_type    text check (media_type in ('image', 'video')),
  hashtags      text[] not null default '{}',
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  share_count   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint posts_not_empty check (char_length(trim(body)) > 0 or cardinality(media_urls) > 0),
  constraint posts_media_type_consistent check ((cardinality(media_urls) = 0) = (media_type is null)),
  constraint posts_single_video check (media_type is distinct from 'video' or cardinality(media_urls) = 1)
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_author_created_idx on public.posts (author_id, created_at desc);
create index posts_community_created_idx on public.posts (community_id, created_at desc) where community_id is not null;
create index posts_hashtags_gin on public.posts using gin (hashtags);
create index posts_body_trgm on public.posts using gin (body extensions.gin_trgm_ops);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid references public.comments (id) on delete cascade,
  body       text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_post_created_idx on public.comments (post_id, created_at);
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index comments_author_idx on public.comments (author_id);

create table public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index likes_post_idx on public.likes (post_id);

create table public.bookmarks (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index bookmarks_user_created_idx on public.bookmarks (user_id, created_at desc);
create index bookmarks_post_idx on public.bookmarks (post_id);

create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ---------------------------------------------------------------------
-- messaging
-- ---------------------------------------------------------------------
create table public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz not null default now(),
  last_message_preview text,
  last_message_sender  uuid references public.profiles (id) on delete set null
);
create index conversations_last_message_idx on public.conversations (last_message_at desc);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null default '' check (char_length(body) <= 4000),
  image_path      text,
  created_at      timestamptz not null default now(),
  constraint messages_not_empty check (char_length(trim(body)) > 0 or image_path is not null)
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create table public.events (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references public.profiles (id) on delete cascade,
  community_id   uuid references public.communities (id) on delete set null,
  title          text not null check (char_length(trim(title)) between 3 and 100),
  description    text not null default '' check (char_length(description) <= 2000),
  category       text not null
                 check (category in ('University', 'Nightlife', 'Sports', 'Societies', 'Networking', 'Study', 'Social')),
  location       text not null check (char_length(trim(location)) between 2 and 200),
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  cover_url      text,
  attendee_count integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index events_starts_idx on public.events (starts_at);
create index events_creator_idx on public.events (creator_id);
create index events_title_trgm on public.events using gin (title extensions.gin_trgm_ops);

create table public.event_attendees (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_attendees_user_idx on public.event_attendees (user_id);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  actor_id        uuid references public.profiles (id) on delete cascade,
  type            text not null
                  check (type in ('like', 'comment', 'reply', 'follow', 'message', 'event_update')),
  post_id         uuid references public.posts (id) on delete cascade,
  comment_id      uuid references public.comments (id) on delete cascade,
  event_id        uuid references public.events (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  preview         text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_actor_idx on public.notifications (actor_id);

-- ---------------------------------------------------------------------
-- marketplace
-- ---------------------------------------------------------------------
create table public.marketplace_listings (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.profiles (id) on delete cascade,
  title        text not null check (char_length(trim(title)) between 3 and 100),
  description  text not null default '' check (char_length(description) <= 2000),
  price        numeric(10, 2) not null default 0 check (price >= 0 and price <= 100000),
  listing_type text not null default 'sale' check (listing_type in ('sale', 'exchange', 'free')),
  category     text not null
               check (category in ('Textbooks', 'Electronics', 'Clothing', 'Furniture', 'Accommodation', 'Free', 'Miscellaneous')),
  condition    text check (condition in ('New', 'Like new', 'Good', 'Fair')),
  image_urls   text[] not null default '{}' check (cardinality(image_urls) <= 6),
  status       text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (listing_type <> 'free' or price = 0)
);
create index listings_status_created_idx on public.marketplace_listings (status, created_at desc);
create index listings_category_idx on public.marketplace_listings (category, created_at desc);
create index listings_seller_idx on public.marketplace_listings (seller_id);
create index listings_title_trgm on public.marketplace_listings using gin (title extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- reports. Reviewed by staff in the Supabase dashboard (service role).
-- ---------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null
              check (target_type in ('post', 'comment', 'user', 'listing', 'event', 'community', 'message')),
  target_id   uuid not null,
  reason      text not null
              check (reason in ('spam', 'harassment', 'hate', 'nudity', 'violence', 'scam', 'impersonation', 'other')),
  details     text not null default '' check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);
