import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

import { queryKeys } from '@/api/keys';
import { fetchListings } from '@/api/marketplace';
import { ListingCard } from '@/components/ListingCard';
import { AppText } from '@/components/ui/AppText';
import { FilterOption, FilterTabs } from '@/components/ui/FilterTabs';
import { Header } from '@/components/ui/Header';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { useDebounced } from '@/hooks/useDebounced';
import { LISTING_CATEGORIES, LISTING_CATEGORY_ICONS, ListingCategory } from '@/lib/constants';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { IconName } from '@/components/ui/Icon';

type Filter = 'All' | 'Mine' | ListingCategory;

const FILTERS: readonly FilterOption<Filter>[] = [
  { key: 'All', label: 'All', icon: 'grid-outline' },
  ...LISTING_CATEGORIES.map((c) => ({ key: c, label: c, icon: LISTING_CATEGORY_ICONS[c] as IconName })),
  { key: 'Mine', label: 'My listings', icon: 'person-outline' },
];

const COLUMNS = 2;
const GAP = spacing.md;

export default function Marketplace() {
  const { colors } = useTheme();
  const { userId } = useCurrentUser();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const term = useDebounced(search.trim(), 300);
  const itemWidth = (width - spacing.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const query = useQuery({
    queryKey: queryKeys.listingList(`${filter}:${term}`),
    queryFn: () =>
      fetchListings({
        category: filter === 'All' || filter === 'Mine' ? 'All' : filter,
        sellerId: filter === 'Mine' ? userId : undefined,
        search: term,
      }),
  });

  return (
    <Screen>
      <Header
        title="Marketplace"
        subtitle="Buy, sell & swap with students"
        right={<IconButton icon="add-circle-outline" accessibilityLabel="Sell something" onPress={() => router.push('/create/listing')} />}
      />
      <TextField placeholder="Search textbooks, desks, bikes…" leftIcon="search" value={search} onChangeText={setSearch} containerStyle={styles.search} />
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(l) => l.id}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.columns}
          renderItem={({ item }) => <ListingCard listing={item} width={itemWidth} />}
          contentContainerStyle={query.data.length ? styles.list : styles.grow}
          keyboardShouldPersistTaps="handled"
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
          ListHeaderComponent={
            <View style={styles.notice}>
              <AppText variant="caption" tone="muted">
                Meet in a public place on campus and check items before paying. OurBeckett doesn’t handle payments.
              </AppText>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title={filter === 'Mine' ? 'You haven’t listed anything' : 'Nothing listed here yet'}
              message="Clear out your room and help a fellow student at the same time."
              actionLabel="Sell something"
              onAction={() => router.push('/create/listing')}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  grow: { flexGrow: 1 },
  columns: { gap: GAP },
  notice: { paddingVertical: spacing.xs },
});
