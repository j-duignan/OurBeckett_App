import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/keys';
import { fetchConversations } from '@/api/messages';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { formatConversationTime } from '@/lib/time';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useRealtime } from '@/providers/RealtimeProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { ConversationSummary } from '@/types/models';

export default function Messages() {
  const { colors } = useTheme();
  const { userId } = useCurrentUser();
  const { onlineUserIds } = useRealtime();
  const [filter, setFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({ queryKey: queryKeys.conversations, queryFn: fetchConversations });

  const conversations = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const rows = query.data ?? [];
    if (!term) return rows;
    return rows.filter((c) => c.other_display_name.toLowerCase().includes(term) || c.other_username.includes(term));
  }, [query.data, filter]);

  const onlineNow = useMemo(
    () => (query.data ?? []).filter((c) => onlineUserIds.has(c.other_user_id)),
    [query.data, onlineUserIds],
  );

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: ConversationSummary }) => {
    const unread = item.unread_count > 0;
    const mine = item.last_message_sender === userId;
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.conversation_id } })}
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: colors.surface } : null]}
        accessibilityRole="button"
        accessibilityLabel={`Conversation with ${item.other_display_name}${unread ? `, ${item.unread_count} unread` : ''}`}
      >
        <Avatar uri={item.other_avatar_url} name={item.other_display_name} size={54} online={onlineUserIds.has(item.other_user_id)} />
        <View style={styles.meta}>
          <View style={styles.line}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
              {item.other_display_name}
            </AppText>
            <AppText variant="caption" tone={unread ? 'link' : 'muted'} weight={unread ? '700' : undefined}>
              {formatConversationTime(item.last_message_at)}
            </AppText>
          </View>
          <View style={styles.line}>
            <AppText variant="callout" tone={unread ? 'default' : 'muted'} weight={unread ? '600' : '400'} numberOfLines={1} style={styles.flex}>
              {mine ? 'You: ' : ''}
              {item.last_message_preview}
            </AppText>
            {unread ? (
              <View style={[styles.unread, { backgroundColor: colors.primary }]}>
                <AppText variant="tiny" style={styles.unreadText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="h1">Messages</AppText>
        <IconButton icon="create-outline" accessibilityLabel="New message" onPress={() => router.push('/new-message')} filled />
      </View>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.conversation_id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            query.data.length ? (
              <View>
                <TextField
                  placeholder="Search conversations"
                  leftIcon="search"
                  value={filter}
                  onChangeText={setFilter}
                  containerStyle={styles.search}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {onlineNow.length && !filter ? (
                  <View style={styles.onlineRow}>
                    <Icon name="ellipse" size={8} color={colors.online} />
                    <AppText variant="label" tone="muted">
                      {onlineNow.length} online now
                    </AppText>
                  </View>
                ) : null}
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            filter ? (
              <EmptyState icon="search-outline" title="No matches" message={`No conversations match “${filter}”.`} />
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title="No messages yet"
                message="Say hi to someone from your course, or reply to a marketplace listing."
                actionLabel="Start a conversation"
                onAction={() => router.push('/new-message')}
              />
            )
          }
          contentContainerStyle={conversations.length ? undefined : styles.grow}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    height: 54,
  },
  search: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  meta: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unread: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#FFFFFF' },
});
