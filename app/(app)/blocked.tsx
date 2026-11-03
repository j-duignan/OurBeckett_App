import { useQuery } from '@tanstack/react-query';
import { FlatList } from 'react-native';

import { queryKeys } from '@/api/keys';
import { fetchBlockedUsers } from '@/api/profiles';
import { UserRow } from '@/components/UserRow';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBlockUser } from '@/hooks/useModeration';
import { useCurrentUser } from '@/providers/AuthProvider';

export default function Blocked() {
  const { userId } = useCurrentUser();
  const { unblock } = useBlockUser();
  const query = useQuery({ queryKey: queryKeys.blocked, queryFn: () => fetchBlockedUsers(userId) });

  return (
    <Screen>
      <Header title="Blocked students" />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <UserRow user={item} right={<Button title="Unblock" size="sm" variant="outline" onPress={() => unblock(item.id, item.username)} />} />
          )}
          ListEmptyComponent={
            <EmptyState icon="shield-checkmark-outline" title="No one blocked" message="Blocked students can’t message you, and you won’t see each other’s posts." />
          }
          contentContainerStyle={query.data.length ? undefined : { flexGrow: 1 }}
        />
      )}
    </Screen>
  );
}
