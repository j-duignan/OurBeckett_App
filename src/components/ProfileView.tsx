import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ReactElement, useState } from 'react';
import { FlatList, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchUserCommunities } from '@/api/communities';
import { queryKeys } from '@/api/keys';
import { fetchBookmarks, fetchUserPosts } from '@/api/posts';
import { hasBlocked } from '@/api/profiles';
import { useBlockUser, useReport, useStartConversation } from '@/hooks/useModeration';
import { joinedLabel, lastSeenLabel } from '@/lib/time';
import { useAuth } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';
import { useIsOnline } from '@/providers/RealtimeProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { Profile } from '@/types/models';

import { CommunityRow } from './CommunityCard';
import { FollowButton } from './FollowButton';
import { PostList } from './PostList';
import { AppText } from './ui/AppText';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { FilterOption, FilterTabs } from './ui/FilterTabs';
import { Icon } from './ui/Icon';
import { IconButton } from './ui/IconButton';
import { PressableScale } from './ui/PressableScale';
import { EmptyState, ErrorState, LoadingState } from './ui/States';

type Tab = 'posts' | 'communities' | 'saved';

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} disabled={!onPress} style={styles.stat} accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={`${value} ${label}`}>
      <AppText variant="h3">{value.toLocaleString()}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </PressableScale>
  );
}

export function ProfileView({ profile, isMe, showBack }: { profile: Profile; isMe: boolean; showBack?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { showSheet } = useOverlay();
  const report = useReport();
  const { block, unblock } = useBlockUser();
  const startConversation = useStartConversation();
  const online = useIsOnline(isMe ? null : profile.id);
  const [tab, setTab] = useState<Tab>('posts');

  const blockedQuery = useQuery({
    queryKey: ['blocked-state', profile.id],
    queryFn: () => hasBlocked(userId as string, profile.id),
    enabled: !isMe && Boolean(userId),
  });
  const iBlockedThem = Boolean(blockedQuery.data);

  const communitiesQuery = useQuery({
    queryKey: queryKeys.userCommunities(profile.id),
    queryFn: () => fetchUserCommunities(profile.id),
    enabled: tab === 'communities',
  });

  const tabs: FilterOption<Tab>[] = [
    { key: 'posts', label: 'Posts', icon: 'grid-outline' },
    { key: 'communities', label: 'Communities', icon: 'people-outline' },
    ...(isMe ? [{ key: 'saved' as const, label: 'Saved', icon: 'bookmark-outline' as const }] : []),
  ];

  const shareProfile = () => {
    const link = Linking.createURL(`/user/${profile.username}`);
    Share.share({ message: `Find ${profile.display_name} (@${profile.username}) on OurBeckett\n${link}` }).catch(() => undefined);
  };

  const openMenu = () =>
    showSheet({
      title: `@${profile.username}`,
      options: [
        { label: 'Share profile', icon: 'share-outline', onPress: shareProfile },
        { label: 'Report', icon: 'flag-outline', destructive: true, onPress: () => report('user', profile.id, `@${profile.username}`) },
        iBlockedThem
          ? { label: 'Unblock', icon: 'lock-open-outline', onPress: () => unblock(profile.id, profile.username) }
          : { label: 'Block', icon: 'ban-outline', destructive: true, onPress: () => block(profile.id, profile.username) },
      ],
    });

  const header = (
    <View>
      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cover, { paddingTop: insets.top }]}>
        <View style={styles.coverActions}>
          {showBack ? <IconButton icon="chevron-back" color="#FFFFFF" accessibilityLabel="Go back" onPress={() => router.back()} /> : <View />}
          {isMe ? (
            <IconButton icon="settings-outline" color="#FFFFFF" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
          ) : (
            <IconButton icon="ellipsis-horizontal" color="#FFFFFF" accessibilityLabel="More options" onPress={openMenu} />
          )}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarBorder, { backgroundColor: colors.background }]}>
            <Avatar uri={profile.avatar_url} name={profile.display_name} size={92} online={online} />
          </View>
          <View style={styles.headerButtons}>
            {isMe ? (
              <>
                <Button title="Edit profile" variant="outline" size="sm" onPress={() => router.push('/edit-profile')} />
                <Button title="Share" variant="outline" size="sm" icon="share-outline" onPress={shareProfile} />
              </>
            ) : iBlockedThem ? (
              <Button title="Unblock" variant="outline" size="sm" onPress={() => unblock(profile.id, profile.username)} />
            ) : (
              <>
                <Button title="Message" variant="outline" size="sm" icon="chatbubble-outline" onPress={() => startConversation(profile.id)} />
                <FollowButton targetId={profile.id} />
              </>
            )}
          </View>
        </View>

        <AppText variant="h1" style={styles.name}>
          {profile.display_name}
        </AppText>
        <AppText tone="muted">
          @{profile.username}
          {!isMe ? ` · ${lastSeenLabel(profile.last_seen_at, online)}` : ''}
        </AppText>

        {profile.bio ? <AppText style={styles.bio}>{profile.bio}</AppText> : null}

        <View style={styles.details}>
          {profile.course ? (
            <View style={styles.detail}>
              <Icon name="school-outline" size={15} color={colors.textMuted} />
              <AppText variant="caption" tone="secondary">
                {profile.course}
              </AppText>
            </View>
          ) : null}
          {profile.campus ? (
            <View style={styles.detail}>
              <Icon name="location-outline" size={15} color={colors.textMuted} />
              <AppText variant="caption" tone="secondary">
                {profile.campus}
              </AppText>
            </View>
          ) : null}
          <View style={styles.detail}>
            <Icon name="calendar-outline" size={15} color={colors.textMuted} />
            <AppText variant="caption" tone="secondary">
              {joinedLabel(profile.created_at)}
            </AppText>
          </View>
        </View>

        {profile.interests.length ? (
          <View style={styles.interests}>
            {profile.interests.map((interest) => (
              <Chip key={interest} label={interest} small />
            ))}
          </View>
        ) : null}

        <View style={[styles.stats, { borderColor: colors.border }]}>
          <Stat value={profile.posts_count} label="Posts" />
          <Stat
            value={profile.followers_count}
            label="Followers"
            onPress={() => router.push({ pathname: '/follows/[id]', params: { id: profile.id, kind: 'followers', name: profile.display_name } })}
          />
          <Stat
            value={profile.following_count}
            label="Following"
            onPress={() => router.push({ pathname: '/follows/[id]', params: { id: profile.id, kind: 'following', name: profile.display_name } })}
          />
        </View>
      </View>

      {iBlockedThem ? null : <FilterTabs options={tabs} value={tab} onChange={setTab} />}
    </View>
  );

  if (iBlockedThem) {
    return (
      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState icon="ban-outline" title="You blocked this student" message="Unblock them to see their posts and message them again." />
        }
      />
    );
  }

  if (tab === 'communities') {
    let empty: ReactElement;
    if (communitiesQuery.isPending) empty = <LoadingState />;
    else if (communitiesQuery.isError) empty = <ErrorState error={communitiesQuery.error} onRetry={() => communitiesQuery.refetch()} />;
    else
      empty = (
        <EmptyState
          icon="people-outline"
          title="No communities yet"
          message={isMe ? 'Find your people in Explore.' : `${profile.display_name} hasn’t joined any communities.`}
          actionLabel={isMe ? 'Browse communities' : undefined}
          onAction={isMe ? () => router.push('/communities') : undefined}
        />
      );
    return (
      <FlatList
        data={communitiesQuery.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CommunityRow community={item} showJoin={false} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
      />
    );
  }

  if (tab === 'saved' && isMe) {
    return (
      <PostList
        key="saved"
        queryKey={queryKeys.bookmarks}
        fetchPage={fetchBookmarks}
        header={header}
        empty={{ icon: 'bookmark-outline', title: 'Nothing saved yet', message: 'Tap the bookmark on any post to save it for later. Only you can see these.' }}
      />
    );
  }

  return (
    <PostList
      key="posts"
      queryKey={queryKeys.userPosts(profile.id)}
      fetchPage={(page) => fetchUserPosts(profile.id, page)}
      header={header}
      empty={{
        icon: 'images-outline',
        title: isMe ? 'Share your first post' : 'No posts yet',
        message: isMe ? 'Say hello to Leeds Beckett!' : `When ${profile.display_name} posts, it’ll show up here.`,
        actionLabel: isMe ? 'Create a post' : undefined,
        onAction: isMe ? () => router.push('/create/post') : undefined,
      }}
    />
  );
}

const styles = StyleSheet.create({
  cover: { height: 150 },
  coverActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  body: { paddingHorizontal: spacing.lg },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -46 },
  avatarBorder: { padding: 4, borderRadius: 52 },
  headerButtons: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.xs },
  name: { marginTop: spacing.sm },
  bio: { marginTop: spacing.md },
  details: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs, marginTop: spacing.md },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  interests: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
});
