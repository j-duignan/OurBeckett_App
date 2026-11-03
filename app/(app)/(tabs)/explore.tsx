import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { fetchPopularCommunities } from '@/api/communities';
import { fetchUpcomingEvents } from '@/api/events';
import { fetchTrendingHashtags } from '@/api/explore';
import { queryKeys } from '@/api/keys';
import { fetchFeed } from '@/api/posts';
import { fetchSuggestedUsers } from '@/api/profiles';
import { CommunityTile } from '@/components/CommunityCard';
import { EventTile } from '@/components/EventCard';
import { PostCard } from '@/components/PostCard';
import { SectionHeader } from '@/components/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { FollowButton } from '@/components/FollowButton';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, spacing } from '@/theme/tokens';

const SHORTCUTS: { label: string; icon: IconName; href: '/communities' | '/events' | '/marketplace' | '/feed/discussions'; tint: string }[] = [
  { label: 'Communities', icon: 'people', href: '/communities', tint: '#7C3AED' },
  { label: 'Events', icon: 'calendar', href: '/events', tint: '#DB2777' },
  { label: 'Marketplace', icon: 'storefront', href: '/marketplace', tint: '#0EA5E9' },
  { label: 'Discussions', icon: 'chatbubbles', href: '/feed/discussions', tint: '#F59E0B' },
];

export default function Explore() {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const hashtags = useQuery({ queryKey: queryKeys.trendingHashtags, queryFn: () => fetchTrendingHashtags(12) });
  const events = useQuery({ queryKey: queryKeys.eventList('explore'), queryFn: () => fetchUpcomingEvents({ limit: 10 }) });
  const communities = useQuery({ queryKey: queryKeys.communityList('popular'), queryFn: () => fetchPopularCommunities(10) });
  const people = useQuery({ queryKey: queryKeys.suggestedUsers, queryFn: () => fetchSuggestedUsers(12) });
  const trending = useQuery({ queryKey: [...queryKeys.feed('trending'), 'preview'], queryFn: () => fetchFeed('trending', 0) });
  const discussions = useQuery({ queryKey: [...queryKeys.feed('discussions'), 'preview'], queryFn: () => fetchFeed('discussions', 0) });

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([hashtags.refetch(), events.refetch(), communities.refetch(), people.refetch(), trending.refetch(), discussions.refetch()]);
    setRefreshing(false);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="h1">Explore</AppText>
      </View>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.push('/search')}
          style={[styles.search, { backgroundColor: colors.inputBackground }]}
          accessibilityRole="search"
          accessibilityLabel="Search OurBeckett"
        >
          <Icon name="search" size={18} color={colors.textMuted} />
          <AppText tone="muted">Search students, posts, #tags, events…</AppText>
        </Pressable>

        <View style={styles.shortcuts}>
          {SHORTCUTS.map((s) => (
            <PressableScale
              key={s.label}
              onPress={() => router.push(s.href)}
              style={[styles.shortcut, { backgroundColor: colors.card, borderColor: colors.border }, shadow(colors.shadow, 1)]}
              accessibilityRole="button"
              accessibilityLabel={s.label}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: s.tint }]}>
                <Icon name={s.icon} size={20} color="#FFFFFF" />
              </View>
              <AppText variant="label" numberOfLines={1}>
                {s.label}
              </AppText>
            </PressableScale>
          ))}
        </View>

        <SectionHeader title="Trending tags" />
        {hashtags.isPending ? (
          <LoadingState style={styles.smallState} />
        ) : hashtags.isError ? (
          <ErrorState error={hashtags.error} onRetry={() => hashtags.refetch()} style={styles.smallState} />
        ) : hashtags.data.length ? (
          <View style={styles.tags}>
            {hashtags.data.map((h, i) => (
              <Pressable
                key={h.tag}
                onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag: h.tag } })}
                style={[styles.tag, { backgroundColor: i < 3 ? colors.primarySoft : colors.surface }]}
                accessibilityRole="link"
              >
                <AppText variant="label" tone="link">
                  #{h.tag}
                </AppText>
                <AppText variant="tiny" tone="muted">
                  {h.post_count}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : (
          <AppText tone="muted" style={styles.inlineEmpty}>
            Use #hashtags in your posts and they’ll trend here.
          </AppText>
        )}

        <SectionHeader title="Upcoming events" onAction={() => router.push('/events')} />
        {events.isPending ? (
          <LoadingState style={styles.smallState} />
        ) : events.isError ? (
          <ErrorState error={events.error} onRetry={() => events.refetch()} style={styles.smallState} />
        ) : events.data.length ? (
          <FlatList
            horizontal
            data={events.data}
            keyExtractor={(e) => e.id}
            renderItem={({ item }) => <EventTile event={item} />}
            contentContainerStyle={styles.carousel}
            showsHorizontalScrollIndicator={false}
          />
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="No upcoming events"
            message="Hosting something? Put it on the map."
            actionLabel="Create event"
            onAction={() => router.push('/create/event')}
            style={styles.smallState}
          />
        )}

        <SectionHeader title="Popular communities" onAction={() => router.push('/communities')} />
        {communities.isPending ? (
          <LoadingState style={styles.smallState} />
        ) : communities.isError ? (
          <ErrorState error={communities.error} onRetry={() => communities.refetch()} style={styles.smallState} />
        ) : (
          <FlatList
            horizontal
            data={communities.data}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => <CommunityTile community={item} />}
            contentContainerStyle={styles.carousel}
            showsHorizontalScrollIndicator={false}
          />
        )}

        <SectionHeader title="People you might know" />
        {people.isPending ? (
          <LoadingState style={styles.smallState} />
        ) : people.isError ? (
          <ErrorState error={people.error} onRetry={() => people.refetch()} style={styles.smallState} />
        ) : people.data.length ? (
          <FlatList
            horizontal
            data={people.data}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.carousel}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <PressableScale
                onPress={() => router.push({ pathname: '/user/[username]', params: { username: item.username } })}
                style={[styles.person, { backgroundColor: colors.card, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={item.display_name}
              >
                <Avatar uri={item.avatar_url} name={item.display_name} size={64} />
                <AppText variant="bodyStrong" numberOfLines={1} align="center">
                  {item.display_name}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1} align="center">
                  {item.shared_interests ? `${item.shared_interests} shared interest${item.shared_interests === 1 ? '' : 's'}` : item.course || `@${item.username}`}
                </AppText>
                <FollowButton targetId={item.id} />
              </PressableScale>
            )}
          />
        ) : (
          <AppText tone="muted" style={styles.inlineEmpty}>
            You’re following everyone we’d suggest. Nice!
          </AppText>
        )}

        <SectionHeader title="Hot discussions" onAction={() => router.push('/feed/discussions')} />
        {discussions.isPending ? (
          <LoadingState style={styles.smallState} />
        ) : discussions.isError ? (
          <ErrorState error={discussions.error} onRetry={() => discussions.refetch()} style={styles.smallState} />
        ) : discussions.data.length ? (
          discussions.data.slice(0, 3).map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <AppText tone="muted" style={styles.inlineEmpty}>
            Start a conversation in one of the communities.
          </AppText>
        )}

        <SectionHeader title="Trending this week" onAction={() => router.push('/feed/trending')} />
        {trending.isPending ? (
          <LoadingState style={styles.smallState} />
        ) : trending.isError ? (
          <ErrorState error={trending.error} onRetry={() => trending.refetch()} style={styles.smallState} />
        ) : trending.data.length ? (
          trending.data.slice(0, 5).map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <AppText tone="muted" style={styles.inlineEmpty}>
            Nothing trending yet this week.
          </AppText>
        )}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, height: 54, justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    height: 46,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
  },
  shortcuts: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shortcutIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  carousel: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm },
  person: {
    width: 150,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  smallState: { minHeight: 120, flex: 0 },
  inlineEmpty: { paddingHorizontal: spacing.lg },
  bottomSpace: { height: spacing.xxxl },
});
