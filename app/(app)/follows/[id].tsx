import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';

import { queryKeys } from '@/api/keys';
import { fetchFollows } from '@/api/profiles';
import { UserRow } from '@/components/UserRow';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useTheme } from '@/theme/ThemeProvider';

type Kind = 'followers' | 'following';

export default function Follows() {
  const params = useLocalSearchParams<{ id: string; kind?: Kind; name?: string }>();
  const { colors } = useTheme();
  const [kind, setKind] = useState<Kind>(params.kind === 'following' ? 'following' : 'followers');
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.follows(params.id, kind),
    queryFn: () => fetchFollows(params.id, kind),
  });

  return (
    <Screen>
      <Header title={params.name ?? 'Connections'} />
      <FilterTabs
        options={[
          { key: 'followers', label: 'Followers' },
          { key: 'following', label: 'Following' },
        ]}
        value={kind}
        onChange={setKind}
      />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UserRow user={item} subtitle={item.course ?? undefined} />}
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
              icon="people-outline"
              title={kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              message={kind === 'followers' ? 'When students follow this account they’ll appear here.' : 'People this account follows will appear here.'}
            />
          }
          contentContainerStyle={query.data.length ? undefined : { flexGrow: 1 }}
        />
      )}
    </Screen>
  );
}
