import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/keys';
import { deleteNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/api/notifications';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Icon, IconName } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { timeAgo } from '@/lib/time';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { AppNotification, NotificationType } from '@/types/models';

const META: Record<NotificationType, { icon: IconName; color: 'like' | 'primary' | 'accent' | 'success' | 'warning'; text: string }> = {
  like: { icon: 'heart', color: 'like', text: 'liked your post' },
  comment: { icon: 'chatbubble', color: 'primary', text: 'commented on your post' },
  reply: { icon: 'arrow-undo', color: 'primary', text: 'replied to your comment' },
  follow: { icon: 'person-add', color: 'success', text: 'started following you' },
  message: { icon: 'mail', color: 'accent', text: 'sent you a message' },
  event_update: { icon: 'calendar', color: 'warning', text: 'updated an event you’re going to' },
};

function navigateFor(n: AppNotification) {
  switch (n.type) {
    case 'like':
    case 'comment':
    case 'reply':
      if (n.post_id) router.push({ pathname: '/post/[id]', params: { id: n.post_id } });
      break;
    case 'follow':
      if (n.actor) router.push({ pathname: '/user/[username]', params: { username: n.actor.username } });
      break;
    case 'message':
      if (n.conversation_id) router.push({ pathname: '/chat/[id]', params: { id: n.conversation_id } });
      break;
    case 'event_update':
      if (n.event_id) router.push({ pathname: '/event/[id]', params: { id: n.event_id } });
      break;
  }
}

export default function Notifications() {
  const { colors } = useTheme();
  const { userId } = useCurrentUser();
  const { showSheet, showToast } = useOverlay();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({ queryKey: queryKeys.notifications, queryFn: fetchNotifications });
  const unread = (query.data ?? []).filter((n) => !n.read_at).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

  const markAll = async () => {
    try {
      await markAllNotificationsRead(userId);
      invalidate();
    } catch (err) {
      showToast(friendlyError(err), 'error');
    }
  };

  const open = (n: AppNotification) => {
    if (!n.read_at) markNotificationRead(n.id).then(invalidate).catch(() => undefined);
    navigateFor(n);
  };

  const menu = (n: AppNotification) =>
    showSheet({
      options: [
        ...(n.read_at
          ? []
          : [
              {
                label: 'Mark as read',
                icon: 'checkmark-done-outline' as const,
                onPress: () => markNotificationRead(n.id).then(invalidate).catch(() => undefined),
              },
            ]),
        {
          label: 'Remove notification',
          icon: 'trash-outline' as const,
          destructive: true,
          onPress: () => deleteNotification(n.id).then(invalidate).catch((err) => showToast(friendlyError(err), 'error')),
        },
      ],
    });

  return (
    <Screen>
      <Header
        title="Notifications"
        right={unread ? <Button title="Mark all read" size="sm" variant="ghost" onPress={markAll} /> : undefined}
      />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(n) => n.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={async () => {
                setRefreshing(true);
                await query.refetch();
                setRefreshing(false);
              }}
            />
          }
          renderItem={({ item }) => {
            const meta = META[item.type];
            const name = item.actor?.display_name ?? 'Someone';
            return (
              <Pressable
                onPress={() => open(item)}
                onLongPress={() => menu(item)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? colors.surface : item.read_at ? 'transparent' : colors.primarySoft },
                ]}
                accessibilityRole="button"
                accessibilityHint="Long press for options"
              >
                <View>
                  <Avatar uri={item.actor?.avatar_url} name={name} size={46} />
                  <View style={[styles.typeIcon, { backgroundColor: colors[meta.color], borderColor: colors.background }]}>
                    <Icon name={meta.icon} size={11} color="#FFFFFF" />
                  </View>
                </View>
                <View style={styles.flex}>
                  <AppText variant="callout">
                    <AppText variant="callout" weight="700">
                      {name}
                    </AppText>{' '}
                    {meta.text}
                    <AppText variant="callout" tone="muted">
                      {'  '}
                      {timeAgo(item.created_at)}
                    </AppText>
                  </AppText>
                  {item.preview ? (
                    <AppText variant="caption" tone="secondary" numberOfLines={2} style={styles.preview}>
                      {item.type === 'event_update' ? item.preview : `“${item.preview}”`}
                    </AppText>
                  ) : null}
                </View>
                {!item.read_at ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState icon="notifications-outline" title="You’re all caught up" message="Likes, comments, follows and messages will show up here." />
          }
          contentContainerStyle={query.data.length ? undefined : { flexGrow: 1 }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  typeIcon: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
