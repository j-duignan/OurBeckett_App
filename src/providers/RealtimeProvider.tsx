import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { queryKeys } from '@/api/keys';
import { fetchConversations } from '@/api/messages';
import { fetchUnreadNotificationCount } from '@/api/notifications';
import { touchLastSeen } from '@/api/profiles';
import { supabase } from '@/lib/supabase';

import { useAuth } from './AuthProvider';

type RealtimeContextValue = {
  onlineUserIds: ReadonlySet<string>;
  unreadNotifications: number;
  unreadMessages: number;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  onlineUserIds: new Set(),
  unreadNotifications: 0,
  unreadMessages: 0,
});

/**
 * App-wide realtime wiring for a signed-in student:
 *  - presence channel for "online now" indicators
 *  - live notification + message streams that keep badges up to date
 *  - periodic last_seen_at heartbeat for "active 5m ago"
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { userId, profile } = useAuth();
  const enabled = Boolean(userId && profile?.onboarded);
  const queryClient = useQueryClient();
  const [onlineUserIds, setOnlineUserIds] = useState<ReadonlySet<string>>(new Set());

  const unreadNotificationsQuery = useQuery({
    queryKey: queryKeys.unreadNotifications,
    queryFn: fetchUnreadNotificationCount,
    enabled,
  });

  const conversationsQuery = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: fetchConversations,
    enabled,
  });

  // Presence
  useEffect(() => {
    if (!enabled || !userId) return;
    const channel = supabase.channel('presence:online', {
      config: { presence: { key: userId } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineUserIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ online_at: new Date().toISOString() }).catch(() => undefined);
        }
      });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') channel.track({ online_at: new Date().toISOString() }).catch(() => undefined);
      else channel.untrack().catch(() => undefined);
    });

    return () => {
      appStateSub.remove();
      supabase.removeChannel(channel);
      setOnlineUserIds(new Set());
    };
  }, [enabled, userId]);

  // Last-seen heartbeat
  useEffect(() => {
    if (!enabled || !userId) return;
    touchLastSeen(userId).catch(() => undefined);
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') touchLastSeen(userId).catch(() => undefined);
    }, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') touchLastSeen(userId).catch(() => undefined);
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [enabled, userId]);

  // Live notifications + messages (RLS limits rows to this student)
  useEffect(() => {
    if (!enabled || !userId) return;
    const channel = supabase
      .channel(`user-stream:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
        },
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, userId, queryClient]);

  const unreadMessages = useMemo(
    () => (conversationsQuery.data ?? []).reduce((sum, c) => sum + (c.unread_count > 0 ? 1 : 0), 0),
    [conversationsQuery.data],
  );

  const value = useMemo<RealtimeContextValue>(
    () => ({
      onlineUserIds,
      unreadNotifications: unreadNotificationsQuery.data ?? 0,
      unreadMessages,
    }),
    [onlineUserIds, unreadNotificationsQuery.data, unreadMessages],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

export function useIsOnline(userId: string | null | undefined): boolean {
  const { onlineUserIds } = useRealtime();
  return Boolean(userId && onlineUserIds.has(userId));
}
