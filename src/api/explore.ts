import { supabase } from '@/lib/supabase';
import type { HashtagStat } from '@/types/models';

export async function fetchTrendingHashtags(limit = 12): Promise<HashtagStat[]> {
  const { data, error } = await supabase.rpc('trending_hashtags', { p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as HashtagStat[]).map((h) => ({ ...h, post_count: Number(h.post_count) }));
}

export async function searchHashtags(query: string): Promise<HashtagStat[]> {
  const term = query.trim().replace(/^#/, '').toLowerCase();
  const all = await fetchTrendingHashtags(50);
  const matches = all.filter((h) => h.tag.includes(term));
  // Always offer the exact tag so students can open any hashtag page.
  if (term.length >= 2 && /^[a-z0-9_]+$/.test(term) && !matches.some((h) => h.tag === term)) {
    matches.unshift({ tag: term, post_count: 0 });
  }
  return matches;
}
