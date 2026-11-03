import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { fetchCommunity, fetchCommunityMembers, removeMember, setMemberRole } from '@/api/communities';
import { queryKeys } from '@/api/keys';
import { UserRow } from '@/components/UserRow';
import { AppText } from '@/components/ui/AppText';
import { Header } from '@/components/ui/Header';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { SheetOption, useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { CommunityMember, CommunityRole } from '@/types/models';

const ROLE_LABEL: Record<CommunityRole, string> = {
  owner: 'Owner',
  moderator: 'Moderator',
  member: 'Member',
  banned: 'Removed',
};

export default function CommunityMembers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { userId } = useCurrentUser();
  const { showSheet, showToast } = useOverlay();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const community = useQuery({ queryKey: queryKeys.community(id), queryFn: () => fetchCommunity(id) });
  const members = useQuery({ queryKey: queryKeys.communityMembers(id), queryFn: () => fetchCommunityMembers(id) });
  const myRole = community.data?.my_role ?? null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.communityMembers(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.community(id) });
  };

  const run = async (action: () => Promise<void>, success: string) => {
    try {
      await action();
      invalidate();
      showToast(success);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    }
  };

  const manage = (member: CommunityMember) => {
    const name = member.profile.display_name;
    const options: SheetOption[] = [];
    if (myRole === 'owner' && member.role === 'member') {
      options.push({ label: 'Make moderator', icon: 'shield-checkmark-outline', onPress: () => run(() => setMemberRole(id, member.user_id, 'moderator'), `${name} is now a moderator`) });
    }
    if (myRole === 'owner' && member.role === 'moderator') {
      options.push({ label: 'Remove moderator role', icon: 'shield-outline', onPress: () => run(() => setMemberRole(id, member.user_id, 'member'), `${name} is now a member`) });
    }
    const canActOn = (myRole === 'owner' && member.role !== 'owner') || (myRole === 'moderator' && (member.role === 'member' || member.role === 'banned'));
    if (canActOn && member.role !== 'banned') {
      options.push({
        label: 'Remove from community',
        icon: 'person-remove-outline',
        destructive: true,
        onPress: () => run(() => removeMember(id, member.user_id), `${name} was removed`),
      });
      options.push({
        label: 'Ban from community',
        icon: 'ban-outline',
        destructive: true,
        onPress: () =>
          Alert.alert(`Ban ${name}?`, 'They won’t be able to post, comment or rejoin.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Ban', style: 'destructive', onPress: () => run(() => setMemberRole(id, member.user_id, 'banned'), `${name} was banned`) },
          ]),
      });
    }
    if (canActOn && member.role === 'banned') {
      options.push({ label: 'Lift ban', icon: 'lock-open-outline', onPress: () => run(() => setMemberRole(id, member.user_id, 'member'), `${name} can participate again`) });
    }
    if (options.length) showSheet({ title: name, options });
  };

  const canManage = myRole === 'owner' || myRole === 'moderator';
  const visible = (members.data ?? []).filter((m) => m.role !== 'banned' || canManage);

  return (
    <Screen>
      <Header title="Members" subtitle={community.data?.name} />
      {members.isPending ? (
        <LoadingState />
      ) : members.isError ? (
        <ErrorState error={members.error} onRetry={() => members.refetch()} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(m) => m.user_id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={async () => {
                setRefreshing(true);
                await members.refetch();
                setRefreshing(false);
              }}
            />
          }
          renderItem={({ item }) => (
            <UserRow
              user={item.profile}
              showFollow={false}
              right={
                <View style={styles.right}>
                  {item.role !== 'member' ? (
                    <View style={[styles.role, { backgroundColor: item.role === 'banned' ? colors.dangerSoft : colors.primarySoft }]}>
                      <AppText variant="tiny" tone={item.role === 'banned' ? 'danger' : 'link'}>
                        {ROLE_LABEL[item.role]}
                      </AppText>
                    </View>
                  ) : null}
                  {canManage && item.user_id !== userId && item.role !== 'owner' ? (
                    <IconButton icon="ellipsis-horizontal" size={18} accessibilityLabel={`Manage ${item.profile.display_name}`} onPress={() => manage(item)} />
                  ) : null}
                </View>
              }
            />
          )}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No members yet" />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  role: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
});
