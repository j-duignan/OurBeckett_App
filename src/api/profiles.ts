import { supabase } from '@/lib/supabase';
import { normaliseUsername } from '@/lib/validation';
import type { Profile, ProfileSummary } from '@/types/models';

const PROFILE_COLUMNS =
  'id, username, display_name, bio, avatar_url, course, campus, interests, onboarded, followers_count, following_count, posts_count, last_seen_at, created_at';
const SUMMARY_COLUMNS = 'id, username, display_name, avatar_url, bio, course, followers_count';

export async function fetchProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('username', normaliseUsername(username))
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', { p_username: normaliseUsername(username) });
  if (error) throw error;
  return Boolean(data);
}

export type ProfileUpdate = Partial<
  Pick<Profile, 'username' | 'display_name' | 'bio' | 'avatar_url' | 'course' | 'campus' | 'interests' | 'onboarded'>
>;

export async function updateProfile(id: string, changes: ProfileUpdate): Promise<void> {
  const { error } = await supabase.from('profiles').update(changes).eq('id', id);
  if (error) throw error;
}

export async function touchLastSeen(id: string): Promise<void> {
  await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', id);
}

export async function isFollowing(me: string, other: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('follower_id', me)
    .eq('following_id', other);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function setFollowing(me: string, other: string, follow: boolean): Promise<void> {
  const { error } = follow
    ? await supabase.from('follows').upsert(
        { follower_id: me, following_id: other },
        { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
      )
    : await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', other);
  if (error) throw error;
}

export async function fetchFollows(userId: string, kind: 'followers' | 'following'): Promise<ProfileSummary[]> {
  const query =
    kind === 'followers'
      ? supabase
          .from('follows')
          .select(`created_at, person:profiles!follows_follower_id_fkey(${SUMMARY_COLUMNS})`)
          .eq('following_id', userId)
      : supabase
          .from('follows')
          .select(`created_at, person:profiles!follows_following_id_fkey(${SUMMARY_COLUMNS})`)
          .eq('follower_id', userId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return ((data ?? []) as unknown as { person: ProfileSummary | null }[])
    .map((row) => row.person)
    .filter((p): p is ProfileSummary => Boolean(p));
}

export async function searchUsers(query: string): Promise<ProfileSummary[]> {
  const term = normaliseUsername(query).replace(/[%_,()]/g, '');
  if (!term) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select(SUMMARY_COLUMNS)
    .eq('onboarded', true)
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    .order('followers_count', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as ProfileSummary[];
}

export async function fetchSuggestedUsers(limit = 10): Promise<ProfileSummary[]> {
  const { data, error } = await supabase.rpc('suggested_users', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as ProfileSummary[];
}

export async function blockUser(me: string, other: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .upsert({ blocker_id: me, blocked_id: other }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function unblockUser(me: string, other: string): Promise<void> {
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', other);
  if (error) throw error;
}

export async function fetchBlockedUsers(me: string): Promise<ProfileSummary[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select(`created_at, person:profiles!blocks_blocked_id_fkey(${SUMMARY_COLUMNS})`)
    .eq('blocker_id', me)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { person: ProfileSummary | null }[])
    .map((row) => row.person)
    .filter((p): p is ProfileSummary => Boolean(p));
}

export async function hasBlocked(me: string, other: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('blocks')
    .select('blocker_id', { count: 'exact', head: true })
    .eq('blocker_id', me)
    .eq('blocked_id', other);
  if (error) throw error;
  return (count ?? 0) > 0;
}
