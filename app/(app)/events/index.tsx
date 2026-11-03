import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { fetchUpcomingEvents } from '@/api/events';
import { queryKeys } from '@/api/keys';
import { EventCard } from '@/components/EventCard';
import { FilterOption, FilterTabs } from '@/components/ui/FilterTabs';
import { Header } from '@/components/ui/Header';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS, EventCategory } from '@/lib/constants';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Filter = 'All' | 'Going' | EventCategory;

const FILTERS: readonly FilterOption<Filter>[] = [
  { key: 'All', label: 'Upcoming', icon: 'calendar-outline' },
  { key: 'Going', label: 'Going', icon: 'checkmark-circle-outline' },
  ...EVENT_CATEGORIES.map((c) => ({ key: c, label: EVENT_CATEGORY_LABELS[c] })),
];

export default function Events() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('All');
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.eventList(filter),
    queryFn: () =>
      fetchUpcomingEvents({
        goingOnly: filter === 'Going',
        category: filter === 'All' || filter === 'Going' ? 'All' : filter,
      }),
  });

  return (
    <Screen>
      <Header title="Events" right={<IconButton icon="add-circle-outline" accessibilityLabel="Create event" onPress={() => router.push('/create/event')} />} />
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <EventCard event={item} />
            </View>
          )}
          contentContainerStyle={query.data.length ? styles.list : styles.grow}
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
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={filter === 'Going' ? 'No plans yet' : 'No upcoming events'}
              message={filter === 'Going' ? 'RSVP to events and they’ll show up here.' : 'Hosting a social, a match or a study session? Share it with campus.'}
              actionLabel="Create event"
              onAction={() => router.push('/create/event')}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.sm },
  grow: { flexGrow: 1 },
  item: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
