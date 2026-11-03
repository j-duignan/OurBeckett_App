// Usage: npm run test:db
// Runs the OurBeckett migrations on PGlite (real Postgres in WASM) with
// minimal stand-ins for Supabase's auth/storage schemas, then exercises
// the security rules and triggers as different users.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const migrationsDir = process.argv[2] ?? fileURLToPath(new URL('../migrations', import.meta.url));
const files = [
  '20261103000001_schema.sql',
  '20261103000002_functions.sql',
  '20261103000003_rls.sql',
  '20261103000004_storage_realtime.sql',
  '20261103000005_seed_communities.sql',
];

const db = new PGlite({ extensions: { pg_trgm } });

// ---- Supabase stand-ins -------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create role supabase_auth_admin nologin;
  create schema if not exists extensions;
  create schema auth;
  create schema storage;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    email_change text default '',
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  create publication supabase_realtime;
  grant usage on schema public, auth, storage, extensions to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

for (const file of files) {
  try {
    await db.exec(readFileSync(`${migrationsDir}/${file}`, 'utf8'));
    console.log(`migrated ${file}`);
  } catch (err) {
    console.log(`MIGRATION FAILED ${file}: ${err.message}`);
    process.exit(1);
  }
}

// ---- helpers ------------------------------------------------------------
let passed = 0;
let failedCount = 0;
function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failedCount++;
    console.log(`  FAIL ${label} ${detail}`);
  }
}

async function asAdmin() {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
}
async function as(userId) {
  await db.exec(`reset role;`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  await db.exec(userId ? `set role authenticated;` : `set role anon;`);
}
async function q(sql, params = []) {
  return (await db.query(sql, params)).rows;
}
async function expectError(label, fn, pattern) {
  try {
    await fn();
    check(label, false, '(expected an error, got success)');
  } catch (err) {
    check(label, pattern ? pattern.test(err.message) : true, `(error: ${err.message})`);
  }
}

async function createUser(email, username, display) {
  await asAdmin();
  const rows = await q(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
    [email, JSON.stringify({ username, display_name: display })],
  );
  return rows[0].id;
}

// ---- 1. Registration rules ----------------------------------------------
console.log('\n1. Registration');
await expectError('rejects gmail address', () => createUser('someone@gmail.com', 'gmailer', 'G'), /leedsbeckett/);
await expectError('rejects staff domain', () => createUser('staff@leedsbeckett.ac.uk', 'staffer', 'S'), /leedsbeckett/);
await expectError('rejects lookalike domain', () => createUser('x@student.leedsbeckett.ac.uk.evil.com', 'evil', 'E'), /leedsbeckett/);
const alice = await createUser('Alice.Smith@Student.LeedsBeckett.ac.uk', 'alice', 'Alice Smith');
check('accepts student email case-insensitively', Boolean(alice));
const bob = await createUser('c7654321@student.leedsbeckett.ac.uk', 'bob_b', 'Bob Brown');
const carol = await createUser('carol@student.leedsbeckett.ac.uk', 'carol', 'Carol');
const prof = await q(`select username, display_name, onboarded from public.profiles where id = $1`, [alice]);
check('profile auto-created from metadata', prof[0]?.username === 'alice' && prof[0]?.display_name === 'Alice Smith');
await expectError('duplicate username blocks sign-up', () => createUser('dup@student.leedsbeckett.ac.uk', 'alice', 'Dup'), /duplicate|unique/);
await asAdmin();
await expectError(
  'cannot change email to another domain',
  () => q(`update auth.users set email_change = 'me@gmail.com' where id = $1`, [alice]),
  /leedsbeckett/,
);
await as(null);
const avail = await q(`select public.username_available('alice') as a, public.username_available('newname') as b`);
check('username_available works for anon', avail[0].a === false && avail[0].b === true);
const anonProfiles = await q(`select count(*)::int as n from public.profiles`).catch(() => [{ n: -1 }]);
check('anon cannot read profiles', anonProfiles[0].n <= 0);
const hookResult = await (async () => {
  await asAdmin();
  return q(`select public.hook_before_user_created('{"user":{"email":"x@gmail.com"}}'::jsonb) as r`);
})();
check('auth hook rejects other domains', hookResult[0].r?.error?.http_code === 403);

// ---- 2. Profiles --------------------------------------------------------
console.log('\n2. Profiles');
await as(alice);
await q(`update public.profiles set bio = 'hi', onboarded = true, interests = '{Gaming,Music}' where id = $1`, [alice]);
check('can update own profile', (await q(`select bio from public.profiles where id = $1`, [alice]))[0].bio === 'hi');
const other = await q(`update public.profiles set bio = 'hacked' where id = $1 returning id`, [bob]);
check('cannot update another profile', other.length === 0);
await expectError('cannot write follower counts', () => q(`update public.profiles set followers_count = 9999 where id = $1`, [alice]), /permission/);
const emailCols = await q(`select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name ilike '%email%'`);
check('profiles has no email column', emailCols.length === 0);
await as(bob);
await q(`update public.profiles set onboarded = true, interests = '{Gaming}' where id = $1`, [bob]);
await as(carol);
await q(`update public.profiles set onboarded = true where id = $1`, [carol]);

// ---- 3. Posts, likes, comments, notifications --------------------------
console.log('\n3. Posts');
await as(alice);
const post = (await q(`insert into public.posts (author_id, body) values ($1, 'Hello #Freshers2026 and #gaming') returning id, hashtags`, [alice]))[0];
check('post created with server-derived hashtags', JSON.stringify(post.hashtags.sort()) === JSON.stringify(['freshers2026', 'gaming']));
await expectError('cannot post as someone else', () => q(`insert into public.posts (author_id, body) values ($1, 'fake')`, [bob]), /row-level security/);
await expectError('cannot set like_count on insert', () => q(`insert into public.posts (author_id, body, like_count) values ($1, 'x', 100)`, [alice]), /permission/);
await expectError('empty post rejected', () => q(`insert into public.posts (author_id, body) values ($1, '   ')`, [alice]), /posts_not_empty/);
await as(bob);
await q(`insert into public.likes (user_id, post_id) values ($1, $2)`, [bob, post.id]);
const c1 = (await q(`insert into public.comments (post_id, author_id, body) values ($1, $2, 'Nice!') returning id`, [post.id, bob]))[0];
const edited = await q(`update public.posts set body = 'edited' where id = $1 returning id`, [post.id]);
check('cannot edit others posts', edited.length === 0);
const deleted = await q(`delete from public.posts where id = $1 returning id`, [post.id]);
check('cannot delete others posts', deleted.length === 0);
await as(alice);
await q(`insert into public.comments (post_id, author_id, body, parent_id) values ($1, $2, 'Thanks!', $3)`, [post.id, alice, c1.id]);
await as(carol);
const reply2 = (await q(`select id from public.comments where parent_id = $1`, [c1.id]))[0];
await q(`insert into public.comments (post_id, author_id, body, parent_id) values ($1, $2, 'Reply to reply', $3)`, [post.id, carol, reply2.id]);
const flattened = await q(`select count(*)::int as n from public.comments where parent_id = $1`, [c1.id]);
check('replies flattened to one level', flattened[0].n === 2);
await asAdmin();
const counts = (await q(`select like_count, comment_count from public.posts where id = $1`, [post.id]))[0];
check('like/comment counters maintained', counts.like_count === 1 && counts.comment_count === 3, JSON.stringify(counts));
const notifs = await q(`select type, user_id from public.notifications order by created_at`);
const types = notifs.map((n) => `${n.type}:${n.user_id === alice ? 'alice' : n.user_id === bob ? 'bob' : 'carol'}`);
check('like notification to author', types.includes('like:alice'), types.join(','));
check('comment notification to author', types.includes('comment:alice'), types.join(','));
check('reply notification to parent author', types.includes('reply:bob'), types.join(','));
await as(bob);
const bobNotifs = await q(`select count(*)::int as n from public.notifications where user_id = $1`, [alice]);
check('cannot read others notifications', bobNotifs[0].n === 0);
await q(`delete from public.likes where user_id = $1 and post_id = $2`, [bob, post.id]);
await asAdmin();
check('unlike removes notification + decrements', (await q(`select like_count from public.posts where id=$1`, [post.id]))[0].like_count === 0 && (await q(`select count(*)::int n from public.notifications where type='like'`))[0].n === 0);

// ---- 4. Feeds ----------------------------------------------------------
console.log('\n4. Feeds');
await as(bob);
for (const mode of ['for_you', 'following', 'latest', 'trending', 'discussions']) {
  const rows = await q(`select id, liked_by_me, author_username from public.get_feed($1, 20, 0)`, [mode]);
  check(`get_feed(${mode}) runs`, Array.isArray(rows), '');
}
const latest = await q(`select * from public.get_feed('latest', 20, 0)`);
check('latest feed returns the post with author', latest[0]?.author_username === 'alice');
await q(`insert into public.bookmarks (user_id, post_id) values ($1, $2)`, [bob, post.id]);
check('bookmarks feed', (await q(`select id from public.get_bookmarks(20, 0)`)).length === 1);
check('trending hashtags', (await q(`select * from public.trending_hashtags(10)`)).some((r) => r.tag === 'gaming'));
const suggestions = await q(`select username, shared_interests from public.suggested_users(10)`);
check('suggested users ranks shared interests', suggestions[0]?.username === 'alice' && suggestions[0]?.shared_interests === 1, JSON.stringify(suggestions));
await as(alice);
check('cannot see others bookmarks', (await q(`select count(*)::int n from public.bookmarks`))[0].n === 0);

// ---- 5. Follows & blocks ------------------------------------------------
console.log('\n5. Follows & blocks');
await as(bob);
await q(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [bob, alice]);
await expectError('cannot follow self', () => q(`insert into public.follows (follower_id, following_id) values ($1, $1)`, [bob]));
await asAdmin();
check('follower counts', (await q(`select followers_count from public.profiles where id=$1`, [alice]))[0].followers_count === 1);
await as(alice);
await q(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [alice, bob]);
await as(bob);
check('blocked user no longer sees posts', (await q(`select count(*)::int n from public.post_feed where author_id = $1`, [alice]))[0].n === 0);
check('block removed follow', (await q(`select count(*)::int n from public.follows where follower_id=$1`, [bob]))[0].n === 0);
check('blocked user cannot see who blocked them', (await q(`select count(*)::int n from public.blocks`))[0].n === 0);
await expectError('blocked user cannot follow blocker', () => q(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [bob, alice]), /row-level security/);
await expectError('blocked user cannot DM blocker', () => q(`select public.get_or_create_dm($1)`, [alice]), /cannot message/);
await as(alice);
await q(`delete from public.blocks where blocker_id = $1`, [alice]);

// ---- 6. Messaging -------------------------------------------------------
console.log('\n6. Messaging');
await as(alice);
const conv = (await q(`select public.get_or_create_dm($1) as id`, [bob]))[0].id;
const again = (await q(`select public.get_or_create_dm($1) as id`, [bob]))[0].id;
check('DM is reused', conv === again);
await q(`insert into public.messages (id, conversation_id, sender_id, body) values (gen_random_uuid(), $1, $2, 'Hey Bob')`, [conv, alice]);
await as(bob);
const bobConvs = await q(`select * from public.my_conversations()`);
check('recipient sees conversation with unread count', bobConvs[0]?.unread_count === 1 && bobConvs[0]?.other_username === 'alice', JSON.stringify(bobConvs));
check('message notification created', (await q(`select count(*)::int n from public.notifications where type='message'`))[0].n === 1);
await q(`update public.conversation_members set last_read_at = now() + interval '1 second' where conversation_id = $1 and user_id = $2`, [conv, bob]);
check('read marker clears unread', (await q(`select unread_count from public.my_conversations()`))[0].unread_count === 0);
await as(carol);
check('outsider cannot read messages', (await q(`select count(*)::int n from public.messages where conversation_id = $1`, [conv]))[0].n === 0);
check('outsider cannot see conversation', (await q(`select count(*)::int n from public.conversations where id = $1`, [conv]))[0].n === 0);
await expectError('outsider cannot inject message', () => q(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'spam')`, [conv, carol]), /row-level security/);
await expectError('cannot send as someone else', () => q(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'spoof')`, [conv, alice]), /row-level security/);
await as(alice);
const firstMsg = (await q(`select id from public.messages where conversation_id = $1`, [conv]))[0].id;
await q(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'Second')`, [conv, alice]);
await q(`delete from public.messages where body = 'Second' and sender_id = $1`, [alice]);
check('unsend refreshes preview', (await q(`select last_message_preview from public.conversations where id = $1`, [conv]))[0].last_message_preview === 'Hey Bob');
await as(bob);
check('cannot unsend others messages', (await q(`delete from public.messages where id = $1 returning id`, [firstMsg])).length === 0);
await as(bob);
check('chat image path allowed for member', (await q(`select public.chat_object_allowed($1) as ok`, [`${conv}/a.jpg`]))[0].ok === true);
await as(carol);
check('chat image path denied for outsider', (await q(`select public.chat_object_allowed($1) as ok`, [`${conv}/a.jpg`]))[0].ok === false);

// ---- 7. Communities -----------------------------------------------------
console.log('\n7. Communities');
await as(alice);
const comm = (await q(`insert into public.communities (slug, name, description, category, icon, creator_id) values ('cs-study-abc123', 'CS Study', 'desc', 'Course', '💻', $1) returning id`, [alice]))[0].id;
check('creator becomes owner', (await q(`select role from public.community_members where community_id = $1 and user_id = $2`, [comm, alice]))[0]?.role === 'owner');
await expectError('cannot create official community', () => q(`insert into public.communities (slug, name, creator_id, is_official) values ('fake-official', 'Fake Official', $1, true)`, [alice]), /permission|row-level/);
await as(bob);
await expectError('non-member cannot post in community', () => q(`insert into public.posts (author_id, body, community_id) values ($1, 'hi', $2)`, [bob, comm]), /row-level security/);
await q(`insert into public.community_members (community_id, user_id) values ($1, $2)`, [comm, bob]);
await expectError('cannot self-promote to owner', () => q(`insert into public.community_members (community_id, user_id, role) values ($1, $2, 'owner')`, [comm, carol]), /permission|row-level/);
const bobPost = (await q(`insert into public.posts (author_id, body, community_id) values ($1, 'member post', $2) returning id`, [bob, comm]))[0].id;
check('community_posts view', (await q(`select count(*)::int n from public.community_posts where community_id = $1`, [comm]))[0].n === 1);
check('member cannot edit community', (await q(`update public.communities set name = 'Hacked' where id = $1 returning id`, [comm])).length === 0);
await as(alice);
check('owner can remove member post', (await q(`delete from public.posts where id = $1 returning id`, [bobPost])).length === 1);
await q(`update public.community_members set role = 'banned' where community_id = $1 and user_id = $2`, [comm, bob]);
await as(bob);
await expectError('banned member cannot post', () => q(`insert into public.posts (author_id, body, community_id) values ($1, 'again', $2)`, [bob, comm]), /row-level security/);
check('banned member cannot leave to evade ban', (await q(`delete from public.community_members where community_id = $1 and user_id = $2 returning user_id`, [comm, bob])).length === 0);
await asAdmin();
check('member_count excludes banned', (await q(`select member_count from public.communities where id = $1`, [comm]))[0].member_count === 1);
check('seed communities present', (await q(`select count(*)::int n from public.communities where is_official`))[0].n === 11);

// ---- 8. Events ----------------------------------------------------------
console.log('\n8. Events');
await as(alice);
const ev = (await q(`insert into public.events (creator_id, title, category, location, starts_at) values ($1, 'Pub quiz', 'Social', 'Student Union', now() + interval '2 days') returning id`, [alice]))[0].id;
await as(bob);
await q(`insert into public.event_attendees (event_id, user_id) values ($1, $2)`, [ev, bob]);
check('cannot edit others event', (await q(`update public.events set title = 'x' where id = $1 returning id`, [ev])).length === 0);
await as(alice);
await q(`update public.events set location = 'Rose Bowl' where id = $1`, [ev]);
await asAdmin();
check('attendee count', (await q(`select attendee_count from public.events where id = $1`, [ev]))[0].attendee_count === 1);
check('attendees notified of update', (await q(`select count(*)::int n from public.notifications where type = 'event_update' and user_id = $1`, [bob]))[0].n === 1);
await as(bob);
check('event_feed going_by_me', (await q(`select going_by_me from public.event_feed where id = $1`, [ev]))[0].going_by_me === true);

// ---- 9. Marketplace & reports --------------------------------------------
console.log('\n9. Marketplace & reports');
await as(carol);
const listing = (await q(`insert into public.marketplace_listings (seller_id, title, price, category) values ($1, 'Desk lamp', 8.5, 'Furniture') returning id`, [carol]))[0].id;
await expectError('free listings must be £0', () => q(`insert into public.marketplace_listings (seller_id, title, price, category, listing_type) values ($1, 'Chair', 5, 'Furniture', 'free')`, [carol]), /check/);
await as(bob);
check('cannot edit others listing', (await q(`update public.marketplace_listings set price = 0 where id = $1 returning id`, [listing])).length === 0);
await q(`insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'listing', $2, 'scam')`, [bob, listing]);
await as(carol);
check('reports are private to reporter', (await q(`select count(*)::int n from public.reports`))[0].n === 0);

// ---- 10. Storage policies -------------------------------------------------
console.log('\n10. Storage');
await as(alice);
await q(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${alice}/me.jpg`]);
check('upload to own folder allowed', true);
await expectError('upload to another users folder denied', () => q(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${bob}/x.jpg`]), /row-level security/);

console.log(`\n${passed} passed, ${failedCount} failed`);
process.exit(failedCount ? 1 : 0);
