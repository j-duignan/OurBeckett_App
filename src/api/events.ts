import type { EventCategory } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type { EventItem, ProfileSummary } from '@/types/models';

export type EventFilter = {
  category?: EventCategory | 'All';
  goingOnly?: boolean;
  search?: string;
  limit?: number;
};

/** Upcoming (or still running) events, soonest first. */
export async function fetchUpcomingEvents(filter: EventFilter = {}): Promise<EventItem[]> {
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  let query = supabase.from('event_feed').select('*').gte('starts_at', cutoff);
  if (filter.category && filter.category !== 'All') query = query.eq('category', filter.category);
  if (filter.goingOnly) query = query.eq('going_by_me', true);
  const term = filter.search?.trim().replace(/[%_,()]/g, ' ');
  if (term) query = query.ilike('title', `%${term}%`);
  const { data, error } = await query.order('starts_at', { ascending: true }).limit(filter.limit ?? 60);
  if (error) throw error;
  return (data ?? []) as EventItem[];
}

export async function fetchEvent(id: string): Promise<EventItem | null> {
  const { data, error } = await supabase.from('event_feed').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as EventItem | null) ?? null;
}

export async function fetchEventAttendees(eventId: string, limit = 100): Promise<ProfileSummary[]> {
  const { data, error } = await supabase
    .from('event_attendees')
    .select('created_at, person:profiles(id, username, display_name, avatar_url)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as { person: ProfileSummary | null }[])
    .map((r) => r.person)
    .filter((p): p is ProfileSummary => Boolean(p));
}

export async function setAttending(eventId: string, userId: string, going: boolean): Promise<void> {
  const { error } = going
    ? await supabase
        .from('event_attendees')
        .upsert({ event_id: eventId, user_id: userId }, { onConflict: 'event_id,user_id', ignoreDuplicates: true })
    : await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('user_id', userId);
  if (error) throw error;
}

export type EventInput = {
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  startsAt: Date;
  endsAt: Date | null;
  coverUrl: string | null;
};

function toRow(input: EventInput) {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    location: input.location.trim(),
    starts_at: input.startsAt.toISOString(),
    ends_at: input.endsAt ? input.endsAt.toISOString() : null,
    cover_url: input.coverUrl,
  };
}

export async function createEvent(creatorId: string, input: EventInput): Promise<string> {
  const { data, error } = await supabase
    .from('events')
    .insert({ ...toRow(input), creator_id: creatorId })
    .select('id')
    .single();
  if (error) throw error;
  // Organisers are automatically going to their own event.
  await setAttending((data as { id: string }).id, creatorId, true);
  return (data as { id: string }).id;
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const { error } = await supabase.from('events').update(toRow(input)).eq('id', id);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}
