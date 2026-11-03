import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteCommunity, fetchCommunity, joinCommunity, leaveCommunity } from '@/api/communities';
import { queryKeys } from '@/api/keys';
import { fetchCommunityPosts } from '@/api/posts';
import { PostList } from '@/components/PostList';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useReport } from '@/hooks/useModeration';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { SheetOption, useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, spacing } from '@/theme/tokens';

export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useCurrentUser();
  const { showSheet, showToast } = useOverlay();
  const report = useReport();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const query = useQuery({ queryKey: queryKeys.community(id), queryFn: () => fetchCommunity(id) });

  if (query.isPending || query.isError || !query.data) {
    return (
      <Screen>
        <Header title="Community" />
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <EmptyState icon="people-outline" title="Community not found" message="It may have been deleted." />
        )}
      </Screen>
    );
  }

  const community = query.data;
  const role = community.my_role;
  const isMember = role === 'owner' || role === 'moderator' || role === 'member';
  const canModerate = role === 'owner' || role === 'moderator';

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    queryClient.invalidateQueries({ queryKey: queryKeys.feed('for_you') });
  };

  const join = async () => {
    setBusy(true);
    try {
      await joinCommunity(community.id, userId);
      refreshAll();
      showToast(`Welcome to ${community.name}!`);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const leave = () =>
    Alert.alert(`Leave ${community.name}?`, 'You can rejoin at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveCommunity(community.id, userId);
            refreshAll();
          } catch (err) {
            showToast(friendlyError(err), 'error');
          }
        },
      },
    ]);

  const remove = () =>
    Alert.alert(`Delete ${community.name}?`, 'All posts in this community will be permanently deleted. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCommunity(community.id);
            refreshAll();
            queryClient.invalidateQueries({ queryKey: queryKeys.posts });
            showToast('Community deleted');
            router.back();
          } catch (err) {
            showToast(friendlyError(err), 'error');
          }
        },
      },
    ]);

  const share = () => {
    const link = Linking.createURL(`/community/${community.id}`);
    Share.share({ message: `Join ${community.name} on OurBeckett\n${link}` }).catch(() => undefined);
  };

  const openMenu = () => {
    const options: SheetOption[] = [
      { label: 'Share community', icon: 'share-outline', onPress: share },
      { label: 'View members', icon: 'people-outline', onPress: () => router.push({ pathname: '/community-members/[id]', params: { id: community.id } }) },
    ];
    if (canModerate) {
      options.push({ label: 'Edit community', icon: 'create-outline', onPress: () => router.push({ pathname: '/create/community', params: { id: community.id } }) });
    }
    if (role === 'owner') {
      options.push({ label: 'Delete community', icon: 'trash-outline', destructive: true, onPress: remove });
    } else if (isMember) {
      options.push({ label: 'Leave community', icon: 'exit-outline', destructive: true, onPress: leave });
    }
    if (role !== 'owner') {
      options.push({ label: 'Report community', icon: 'flag-outline', destructive: true, onPress: () => report('community', community.id, 'community') });
    }
    showSheet({ title: community.name, options });
  };

  const header = (
    <View>
      <View style={[styles.cover, { paddingTop: insets.top }]}>
        {community.cover_url ? (
          <Image source={{ uri: community.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.coverActions}>
          <IconButton icon="chevron-back" color="#FFFFFF" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.coverButton} />
          <IconButton icon="ellipsis-horizontal" color="#FFFFFF" accessibilityLabel="Community options" onPress={openMenu} style={styles.coverButton} />
        </View>
      </View>
      <View style={styles.body}>
        <View style={[styles.iconBox, shadow(colors.shadow, 2), { backgroundColor: colors.card, borderColor: colors.background }]}>
          <AppText style={styles.emoji}>{community.icon}</AppText>
        </View>
        <View style={styles.nameRow}>
          <AppText variant="h1" style={styles.flexShrink}>
            {community.name}
          </AppText>
          {community.is_official ? <Icon name="checkmark-circle" size={20} color={colors.link} /> : null}
        </View>
        <Pressable onPress={() => router.push({ pathname: '/community-members/[id]', params: { id: community.id } })} accessibilityRole="link">
          <AppText tone="muted">
            <AppText weight="700">{community.member_count.toLocaleString()}</AppText> members ·{' '}
            <AppText weight="700">{community.post_count.toLocaleString()}</AppText> posts · {community.category}
          </AppText>
        </Pressable>
        {community.description ? <AppText style={styles.description}>{community.description}</AppText> : null}

        {role === 'banned' ? (
          <View style={[styles.banned, { backgroundColor: colors.dangerSoft }]}>
            <Icon name="ban-outline" size={18} color={colors.danger} />
            <AppText variant="callout" tone="danger" style={styles.flex}>
              You’ve been removed from this community by its moderators.
            </AppText>
          </View>
        ) : (
          <View style={styles.buttons}>
            {isMember ? (
              <>
                <Button
                  title="New post"
                  icon="create-outline"
                  variant="gradient"
                  onPress={() => router.push({ pathname: '/create/post', params: { communityId: community.id } })}
                  style={styles.flex}
                />
                <Button
                  title={role === 'owner' ? 'Owner' : role === 'moderator' ? 'Moderator' : 'Joined'}
                  icon={role === 'member' ? 'checkmark' : 'shield-checkmark-outline'}
                  variant="outline"
                  onPress={role === 'member' ? leave : openMenu}
                />
              </>
            ) : (
              <Button title="Join community" icon="add" variant="gradient" onPress={join} loading={busy} style={styles.flex} />
            )}
          </View>
        )}
      </View>
      <AppText variant="label" tone="muted" style={styles.section}>
        POSTS
      </AppText>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <PostList
        queryKey={queryKeys.communityPosts(community.id)}
        fetchPage={(page) => fetchCommunityPosts(community.id, page)}
        header={header}
        canModerate={canModerate}
        empty={{
          icon: 'chatbubbles-outline',
          title: 'No posts yet',
          message: isMember ? 'Kick things off with the first post.' : 'Join to start the conversation.',
        }}
      />
      {isMember ? (
        <PressableScale
          onPress={() => router.push({ pathname: '/create/post', params: { communityId: community.id } })}
          style={[styles.fab, shadow(colors.primary, 3), { bottom: insets.bottom + spacing.xl }]}
          accessibilityRole="button"
          accessibilityLabel="New post in this community"
        >
          <LinearGradient colors={colors.gradient} style={styles.fabInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Icon name="add" size={28} color="#FFFFFF" />
          </LinearGradient>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  cover: { height: 150 },
  coverActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  coverButton: { backgroundColor: 'rgba(0,0,0,0.25)' },
  body: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -36,
    marginBottom: spacing.sm,
    borderWidth: 4,
  },
  emoji: { fontSize: 36, lineHeight: 44 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  description: { marginTop: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  banned: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xs },
  fab: { position: 'absolute', right: spacing.xl, width: 58, height: 58, borderRadius: 29 },
  fabInner: { flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
});
