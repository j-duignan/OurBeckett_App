import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/keys';
import { fetchFeed } from '@/api/posts';
import { Logo } from '@/components/Logo';
import { PostList } from '@/components/PostList';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { FilterOption, FilterTabs } from '@/components/ui/FilterTabs';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useRealtime } from '@/providers/RealtimeProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { FeedMode } from '@/types/models';

const MODES: readonly FilterOption<FeedMode>[] = [
  { key: 'for_you', label: 'For You', icon: 'sparkles-outline' },
  { key: 'following', label: 'Following', icon: 'people-outline' },
  { key: 'latest', label: 'Latest', icon: 'time-outline' },
  { key: 'trending', label: 'Trending', icon: 'flame-outline' },
];

const EMPTY: Record<FeedMode, { title: string; message: string }> = {
  for_you: { title: 'Your feed is warming up', message: 'Follow people and join communities to see more here. Or be the first to post!' },
  following: { title: 'Nothing from your people yet', message: 'Follow students from Explore and their posts will appear here.' },
  latest: { title: 'No posts yet', message: 'Be the first to say hello to Leeds Beckett.' },
  trending: { title: 'Nothing trending this week', message: 'Posts with the most likes and comments over the last 7 days show up here.' },
  discussions: { title: 'No discussions yet', message: 'Community posts with the most replies show up here.' },
};

export default function Home() {
  const { colors } = useTheme();
  const { profile } = useCurrentUser();
  const { unreadNotifications } = useRealtime();
  const [mode, setMode] = useState<FeedMode>('for_you');

  const header = (
    <View>
      <FilterTabs options={MODES} value={mode} onChange={setMode} />
      <Pressable
        onPress={() => router.push('/create/post')}
        style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel="Create a post"
      >
        <Avatar uri={profile.avatar_url} name={profile.display_name} size={36} />
        <AppText tone="muted" style={styles.flex}>
          What’s happening on campus?
        </AppText>
        <Icon name="image-outline" size={22} color={colors.link} />
      </Pressable>
    </View>
  );

  return (
    <Screen>
      <View style={styles.topBar}>
        <Logo size={30} />
        <View style={styles.actions}>
          <IconButton icon="calendar-outline" accessibilityLabel="Events" onPress={() => router.push('/events')} />
          <IconButton icon="storefront-outline" accessibilityLabel="Marketplace" onPress={() => router.push('/marketplace')} />
          <IconButton
            icon="notifications-outline"
            accessibilityLabel="Notifications"
            badge={unreadNotifications}
            onPress={() => router.push('/notifications')}
          />
        </View>
      </View>
      <PostList
        key={mode}
        queryKey={queryKeys.feed(mode)}
        fetchPage={(page) => fetchFeed(mode, page)}
        header={header}
        empty={{
          icon: mode === 'trending' ? 'flame-outline' : 'newspaper-outline',
          ...EMPTY[mode],
          actionLabel: mode === 'following' ? 'Find people' : 'Create a post',
          onAction: () => router.push(mode === 'following' ? '/explore' : '/create/post'),
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    height: 54,
  },
  actions: { flexDirection: 'row', alignItems: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
