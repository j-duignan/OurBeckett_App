import { PAGE_SIZE } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type { FeedMode, FeedPost } from '@/types/models';

function rangeFor(page: number): [number, number] {
  const from = page * PAGE_SIZE;
  return [from, from + PAGE_SIZE - 1];
}

export async function fetchFeed(mode: FeedMode, page: number): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc('get_feed', {
    p_mode: mode,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  });
  if (error) throw error;
  return (data ?? []) as FeedPost[];
}

export async function fetchUserPosts(userId: string, page: number): Promise<FeedPost[]> {
  const [from, to] = rangeFor(page);
  const { data, error } = await supabase
    .from('post_feed')
    .select('*')
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data ?? []) as FeedPost[];
}

export async function fetchCommunityPosts(communityId: string, page: number): Promise<FeedPost[]> {
  const [from, to] = rangeFor(page);
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data ?? []) as FeedPost[];
}

export async function fetchHashtagPosts(tag: string, page: number): Promise<FeedPost[]> {
  const [from, to] = rangeFor(page);
  const { data, error } = await supabase
    .from('post_feed')
    .select('*')
    .contains('hashtags', [tag.toLowerCase()])
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data ?? []) as FeedPost[];
}

export async function searchPosts(query: string, page: number): Promise<FeedPost[]> {
  const [from, to] = rangeFor(page);
  const term = query.trim().replace(/[%_,()]/g, ' ');
  const { data, error } = await supabase
    .from('post_feed')
    .select('*')
    .ilike('body', `%${term}%`)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data ?? []) as FeedPost[];
}

export async function fetchBookmarks(page: number): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc('get_bookmarks', {
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  });
  if (error) throw error;
  return (data ?? []) as FeedPost[];
}

export async function fetchPost(id: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from('post_feed').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as FeedPost | null) ?? null;
}

export type NewPost = {
  authorId: string;
  body: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | null;
  communityId: string | null;
};

export async function createPost(input: NewPost): Promise<string> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: input.authorId,
      body: input.body.trim(),
      media_urls: input.mediaUrls,
      media_type: input.mediaUrls.length ? input.mediaType : null,
      community_id: input.communityId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;
}

export async function setLiked(userId: string, postId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase.from('likes').upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
    : await supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId);
  if (error) throw error;
}

export async function setBookmarked(userId: string, postId: string, bookmarked: boolean): Promise<void> {
  const { error } = bookmarked
    ? await supabase.from('bookmarks').upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
    : await supabase.from('bookmarks').delete().eq('user_id', userId).eq('post_id', postId);
  if (error) throw error;
}

export async function recordShare(postId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_share', { p_post: postId });
  if (error) throw error;
}
