import { supabase } from '@/lib/supabase';
import type { ConversationSummary, Message } from '@/types/models';

export const MESSAGE_PAGE = 40;

export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_dm', { p_other: otherUserId });
  if (error) throw error;
  return data as string;
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) throw error;
  return (data ?? []) as ConversationSummary[];
}

/** Newest first, for an inverted list. Pass the oldest loaded timestamp to page back. */
export async function fetchMessages(conversationId: string, before?: string): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, image_path, created_at')
    .eq('conversation_id', conversationId);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(MESSAGE_PAGE);
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(message: {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  imagePath?: string | null;
}): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id: message.id,
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      body: message.body.trim(),
      image_path: message.imagePath ?? null,
    })
    .select('id, conversation_id, sender_id, body, image_path, created_at')
    .single();
  if (error) throw error;
  return data as Message;
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', id);
  if (error) throw error;
}

export type ConversationMember = {
  user_id: string;
  last_read_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    last_seen_at: string | null;
  } | null;
};

export async function fetchConversationMembers(conversationId: string): Promise<ConversationMember[]> {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id, last_read_at, profile:profiles(id, username, display_name, avatar_url, last_seen_at)')
    .eq('conversation_id', conversationId);
  if (error) throw error;
  return (data ?? []) as unknown as ConversationMember[];
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  if (error) throw error;
  // Clear the matching message notification too.
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .is('read_at', null);
}

/** Chat images live in a private bucket; display them through short-lived signed URLs. */
export async function signedChatImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('chat').createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
