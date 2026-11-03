-- =====================================================================
-- OurBeckett: storage buckets + realtime
--
-- Buckets
--   avatars  public read, students write only inside "<their uid>/"
--   media    public read (posts, listings, events, community covers),
--            students write only inside "<their uid>/"
--   chat     PRIVATE. Path is "<conversation id>/<file>". Only the two
--            participants can upload or read (via signed URLs).
--
-- Public buckets use unguessable UUID paths and no LIST policy, so files
-- can't be enumerated. Swap to private + signed URLs if you need stricter
-- media privacy later.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('media', 'media', true, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime']),
  ('chat', 'chat', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- avatars + media: own folder only
create policy "avatars/media: upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "avatars/media: update own files" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "avatars/media: delete own files" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- chat: conversation participants only
create or replace function public.chat_object_allowed(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conv uuid;
begin
  begin
    v_conv := ((storage.foldername(p_name))[1])::uuid;
  exception when others then
    return false;
  end;
  return public.is_conversation_member(v_conv);
end;
$$;

create policy "chat: participants upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat' and public.chat_object_allowed(name));
create policy "chat: participants read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat' and public.chat_object_allowed(name));

-- ---------------------------------------------------------------------
-- Realtime: stream these tables to clients. RLS still applies, so each
-- student only receives rows they are allowed to read.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'notifications', 'conversation_members', 'conversations'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
