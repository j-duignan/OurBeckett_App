import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { queryKeys } from '@/api/keys';
import { fetchProfileById } from '@/api/profiles';
import { ProfileView } from '@/components/ProfileView';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

export default function MyProfile() {
  const { colors } = useTheme();
  const { userId, profile } = useCurrentUser();

  // Fresh counts (followers, posts) whenever the tab is focused.
  const query = useQuery({
    queryKey: queryKeys.profileById(userId),
    queryFn: () => fetchProfileById(userId),
    initialData: profile,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ProfileView profile={query.data ?? profile} isMe />
    </View>
  );
}
