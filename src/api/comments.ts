import { supabase } from '@/lib/supabase';
import type { CommentItem, CommentThread } from '@/types/models';

/** Loads all comments for a post and groups replies under their parent. */
export async function fetchComments(postId: string): Promise<CommentThread[]> {
  const { data, error } = await supabase
    .from('comment_feed')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;

  const rows = (data ?? []) as CommentItem[];
  const threads = new Map<string, CommentThread>();
  const orphans: CommentItem[] = [];
  for (const row of rows) {
    if (!row.parent_id) threads.set(row.id, { ...row, replies: [] });
  }
  for (const row of rows) {
    if (!row.parent_id) continue;
    const parent = threads.get(row.parent_id);
    if (parent) parent.replies.push(row);
    else orphans.push(row);
  }
  // Replies whose parent is hidden (e.g. blocked author) are shown top-level.
  for (const orphan of orphans) threads.set(orphan.id, { ...orphan, replies: [] });
  return Array.from(threads.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function addComment(input: {
  postId: string;
  authorId: string;
  body: string;
  parentId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('comments').insert({
    post_id: input.postId,
    author_id: input.authorId,
    body: input.body.trim(),
    parent_id: input.parentId ?? null,
  });
  if (error) throw error;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}
