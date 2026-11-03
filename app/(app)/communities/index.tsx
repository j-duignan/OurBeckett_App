import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { fetchCommunities, fetchUserCommunities } from '@/api/communities';
import { queryKeys } from '@/api/keys';
import { CommunityRow } from '@/components/CommunityCard';
import { AppText } from '@/components/ui/AppText';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { Header } from '@/components/ui/Header';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { useDebounced } from '@/hooks/useDebounced';
import { COMMUNITY_CATEGORIES } from '@/lib/constants';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const CATEGORY_OPTIONS = [{ key: 'All', label: 'All' }, ...COMMUNITY_CATEGORIES.map((c) => ({ key: c, label: c }))] as const;

export default function Communities() {
  const { colors } = useTheme();
  const { userId } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [refreshing, setRefreshing] = useState(false);
  const term = useDebounced(search.trim(), 300);

  const mine = useQuery({ queryKey: queryKeys.myCommunities, queryFn: () => fetchUserCommunities(userId) });
  const all = useQuery({
    queryKey: queryKeys.communityList(`${category}:${term}`),
    queryFn: () => fetchCommunities({ search: term, category }),
  });

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([mine.refetch(), all.refetch()]);
    setRefreshing(false);
  };

  const header = (
    <View>
      <TextField placeholder="Search communities" leftIcon="search" value={search} onChangeText={setSearch} containerStyle={styles.search} autoCapitalize="none" />
      {!term && mine.data && mine.data.length ? (
        <View>
          <AppText variant="label" tone="muted" style={styles.section}>
            YOUR COMMUNITIES
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mineRow}>
            {mine.data.map((c) => (
              <PressableScale
                key={c.id}
                onPress={() => router.push({ pathname: '/community/[id]', params: { id: c.id } })}
                style={[styles.mineItem, { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel={c.name}
              >
                <AppText style={styles.mineEmoji}>{c.icon}</AppText>
                <AppText variant="tiny" numberOfLines={1} align="center">
                  {c.name}
                </AppText>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <AppText variant="label" tone="muted" style={styles.section}>
        DISCOVER
      </AppText>
      <FilterTabs options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
    </View>
  );

  return (
    <Screen>
      <Header
        title="Communities"
        right={<IconButton icon="add-circle-outline" accessibilityLabel="Create community" onPress={() => router.push('/create/community')} />}
      />
      <FlatList
        data={all.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CommunityRow community={item} />}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          all.isPending ? (
            <LoadingState />
          ) : all.isError ? (
            <ErrorState error={all.error} onRetry={() => all.refetch()} />
          ) : (
            <EmptyState
              icon="people-outline"
              title="No communities found"
              message="Start one and invite your coursemates."
              actionLabel="Create community"
              onAction={() => router.push('/create/community')}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: spacing.lg, marginTop: spacing.md },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  mineRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  mineItem: { width: 86, alignItems: 'center', gap: 4, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, borderRadius: radius.lg },
  mineEmoji: { fontSize: 28, lineHeight: 34 },
});
