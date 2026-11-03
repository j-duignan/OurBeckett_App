import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ReactElement, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { fetchCommunities } from '@/api/communities';
import { fetchUpcomingEvents } from '@/api/events';
import { searchHashtags } from '@/api/explore';
import { queryKeys } from '@/api/keys';
import { searchPosts } from '@/api/posts';
import { searchUsers } from '@/api/profiles';
import { CommunityRow } from '@/components/CommunityCard';
import { EventCard } from '@/components/EventCard';
import { PostCard } from '@/components/PostCard';
import { UserRow } from '@/components/UserRow';
import { AppText } from '@/components/ui/AppText';
import { FilterOption, FilterTabs } from '@/components/ui/FilterTabs';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { useDebounced } from '@/hooks/useDebounced';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type Scope = 'people' | 'posts' | 'tags' | 'communities' | 'events';

const SCOPES: readonly FilterOption<Scope>[] = [
  { key: 'people', label: 'Students', icon: 'person-outline' },
  { key: 'posts', label: 'Posts', icon: 'document-text-outline' },
  { key: 'tags', label: 'Hashtags', icon: 'pricetag-outline' },
  { key: 'communities', label: 'Communities', icon: 'people-outline' },
  { key: 'events', label: 'Events', icon: 'calendar-outline' },
];

export default function Search() {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [scope, setScope] = useState<Scope>(text.startsWith('#') ? 'tags' : 'people');
  const term = useDebounced(text.trim(), 300);
  const enabled = term.replace(/^[#@]/, '').length >= 2;

  const people = useQuery({ queryKey: queryKeys.searchUsers(term), queryFn: () => searchUsers(term), enabled: enabled && scope === 'people' });
  const posts = useQuery({ queryKey: queryKeys.searchPosts(term), queryFn: () => searchPosts(term, 0), enabled: enabled && scope === 'posts' });
  const tags = useQuery({ queryKey: ['search-tags', term], queryFn: () => searchHashtags(term), enabled: enabled && scope === 'tags' });
  const communities = useQuery({
    queryKey: queryKeys.communityList(`search:${term}`),
    queryFn: () => fetchCommunities({ search: term }),
    enabled: enabled && scope === 'communities',
  });
  const events = useQuery({
    queryKey: queryKeys.eventList(`search:${term}`),
    queryFn: () => fetchUpcomingEvents({ search: term }),
    enabled: enabled && scope === 'events',
  });

  const onChange = (value: string) => {
    setText(value);
    if (value.startsWith('#') && scope !== 'tags') setScope('tags');
    if (value.startsWith('@') && scope !== 'people') setScope('people');
  };

  const active = { people, posts, tags, communities, events }[scope];

  let body: ReactElement;
  if (!enabled) {
    body = <EmptyState icon="search-outline" title="Search OurBeckett" message="Find students by name or @username, posts, #hashtags, communities and upcoming events." />;
  } else if (active.isPending) {
    body = <LoadingState />;
  } else if (active.isError) {
    body = <ErrorState error={active.error} onRetry={() => active.refetch()} />;
  } else if (scope === 'people') {
    body = (
      <FlatList
        data={people.data ?? []}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => <UserRow user={item} subtitle={item.course ?? undefined} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="person-outline" title="No students found" message={`Nobody matches “${term}”.`} />}
      />
    );
  } else if (scope === 'posts') {
    body = (
      <FlatList
        data={posts.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No posts found" message={`No posts mention “${term}”.`} />}
      />
    );
  } else if (scope === 'tags') {
    body = (
      <FlatList
        data={tags.data ?? []}
        keyExtractor={(t) => t.tag}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag: item.tag } })}
            style={({ pressed }) => [styles.tagRow, pressed ? { backgroundColor: colors.surface } : null]}
            accessibilityRole="link"
          >
            <View style={[styles.tagIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="pricetag" size={18} color={colors.link} />
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">#{item.tag}</AppText>
              <AppText variant="caption" tone="muted">
                {item.post_count ? `${item.post_count} recent post${item.post_count === 1 ? '' : 's'}` : 'View hashtag'}
              </AppText>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState icon="pricetag-outline" title="No hashtags found" message="Hashtags can use letters, numbers and underscores." />}
      />
    );
  } else if (scope === 'communities') {
    body = (
      <FlatList
        data={communities.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CommunityRow community={item} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No communities found"
            message="Can’t find your people? Start the community yourself."
            actionLabel="Create community"
            onAction={() => router.push('/create/community')}
          />
        }
      />
    );
  } else {
    body = (
      <FlatList
        data={events.data ?? []}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <View style={styles.eventItem}>
            <EventCard event={item} />
          </View>
        )}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="calendar-outline" title="No upcoming events found" message={`No events match “${term}”.`} />}
      />
    );
  }

  return (
    <Screen>
      <View style={styles.top}>
        <IconButton icon="chevron-back" accessibilityLabel="Go back" onPress={() => router.back()} />
        <TextField
          placeholder="Search OurBeckett"
          leftIcon="search"
          value={text}
          onChangeText={onChange}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          containerStyle={styles.flex}
          clearButtonMode="while-editing"
        />
      </View>
      <FilterTabs options={SCOPES} value={scope} onChange={setScope} />
      <View style={styles.flex}>{body}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.xs, paddingRight: spacing.lg, gap: spacing.xs, paddingTop: spacing.xs },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tagIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  eventItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
