import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { queryKeys } from '@/api/keys';
import { fetchProfileByUsername } from '@/api/profiles';
import { ProfileView } from '@/components/ProfileView';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { colors } = useTheme();
  const { userId } = useCurrentUser();

  const query = useQuery({
    queryKey: queryKeys.profile(username ?? ''),
    queryFn: () => fetchProfileByUsername(username ?? ''),
    enabled: Boolean(username),
  });

  if (query.isPending || query.isError || !query.data) {
    return (
      <Screen>
        <Header title={username ? `@${username}` : 'Profile'} />
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <EmptyState
            icon="person-outline"
            title="Student not found"
            message="This account doesn’t exist or the username has changed."
            actionLabel="Back to Explore"
            onAction={() => router.replace('/explore')}
          />
        )}
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ProfileView profile={query.data} isMe={query.data.id === userId} showBack />
    </View>
  );
}
