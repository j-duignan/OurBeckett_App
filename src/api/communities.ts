import type { CommunityCategory } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/validation';
import { uuid } from '@/lib/uuid';
import type { Community, CommunityMember, CommunityRole } from '@/types/models';

export async function fetchCommunities(options: { search?: string; category?: string; limit?: number } = {}): Promise<Community[]> {
  let query = supabase.from('community_feed').select('*');
  const term = options.search?.trim().replace(/[%_,()]/g, ' ');
  if (term) query = query.ilike('name', `%${term}%`);
  if (options.category && options.category !== 'All') query = query.eq('category', options.category);
  const { data, error } = await query
    .order('is_official', { ascending: false })
    .order('member_count', { ascending: false })
    .limit(options.limit ?? 50);
  if (error) throw error;
  return (data ?? []) as Community[];
}

export async function fetchPopularCommunities(limit = 10): Promise<Community[]> {
  const { data, error } = await supabase
    .from('community_feed')
    .select('*')
    .order('member_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Community[];
}

export async function fetchUserCommunities(userId: string): Promise<Community[]> {
  const { data, error } = await supabase
    .from('community_members')
    .select('role, community:communities(*)')
    .eq('user_id', userId)
    .neq('role', 'banned')
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { role: CommunityRole; community: Omit<Community, 'my_role'> | null }[])
    .filter((row) => row.community)
    .map((row) => ({ ...(row.community as Omit<Community, 'my_role'>), my_role: row.role }));
}

export async function fetchCommunity(id: string): Promise<Community | null> {
  const { data, error } = await supabase.from('community_feed').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Community | null) ?? null;
}

export async function joinCommunity(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('community_members').insert({ community_id: communityId, user_id: userId });
  if (error && !error.message.includes('duplicate key')) throw error;
}

export async function leaveCommunity(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', userId);
  if (error) throw error;
}

export type CommunityInput = {
  name: string;
  description: string;
  category: CommunityCategory;
  icon: string;
  coverUrl: string | null;
};

export async function createCommunity(creatorId: string, input: CommunityInput): Promise<string> {
  const base = slugify(input.name) || 'community';
  const slug = `${base.slice(0, 40)}-${uuid().slice(0, 6)}`;
  const { data, error } = await supabase
    .from('communities')
    .insert({
      slug,
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category,
      icon: input.icon,
      cover_url: input.coverUrl,
      creator_id: creatorId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateCommunity(id: string, input: CommunityInput): Promise<void> {
  const { error } = await supabase
    .from('communities')
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category,
      icon: input.icon,
      cover_url: input.coverUrl,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCommunity(id: string): Promise<void> {
  const { error } = await supabase.from('communities').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchCommunityMembers(communityId: string): Promise<CommunityMember[]> {
  const { data, error } = await supabase
    .from('community_members')
    .select('community_id, user_id, role, joined_at, profile:profiles(id, username, display_name, avatar_url)')
    .eq('community_id', communityId)
    .order('joined_at', { ascending: true })
    .limit(1000);
  if (error) throw error;
  const order: Record<CommunityRole, number> = { owner: 0, moderator: 1, member: 2, banned: 3 };
  return ((data ?? []) as unknown as CommunityMember[])
    .filter((m) => m.profile)
    .sort((a, b) => order[a.role] - order[b.role]);
}

export async function setMemberRole(communityId: string, userId: string, role: Exclude<CommunityRole, 'owner'>): Promise<void> {
  const { error } = await supabase
    .from('community_members')
    .update({ role })
    .eq('community_id', communityId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeMember(communityId: string, userId: string): Promise<void> {
  await leaveCommunity(communityId, userId);
}
