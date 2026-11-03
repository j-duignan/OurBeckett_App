import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { memo, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, Share, StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/keys';
import { deletePost, recordShare, setBookmarked, setLiked } from '@/api/posts';
import { timeAgo } from '@/lib/time';
import { friendlyError } from '@/lib/validation';
import { useBlockUser, useReport } from '@/hooks/useModeration';
import { useAuth } from '@/providers/AuthProvider';
import { SheetOption, useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { FeedPost } from '@/types/models';

import { MediaGallery } from './MediaGallery';
import { RichText } from './RichText';
import { AppText } from './ui/AppText';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';
import { PressableScale } from './ui/PressableScale';

type Props = {
  post: FeedPost;
  /** Community owners/moderators may remove other people's posts. */
  canModerate?: boolean;
  /** On the post detail screen the body is not a link to itself. */
  detail?: boolean;
  onDeleted?: () => void;
};

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(n / 1000)}k`;
}

export const PostCard = memo(function PostCard({ post, canModerate, detail, onDeleted }: Props) {
  const { colors } = useTheme();
  const { userId } = useAuth();
  const { showSheet, showToast } = useOverlay();
  const queryClient = useQueryClient();
  const report = useReport();
  const { block } = useBlockUser();

  const [liked, setLikedState] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [saved, setSaved] = useState(post.bookmarked_by_me);
  const [shareCount, setShareCount] = useState(post.share_count);
  const heartScale = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;

  // Keep in sync when the list refetches.
  useEffect(() => {
    setLikedState(post.liked_by_me);
    setLikeCount(post.like_count);
    setSaved(post.bookmarked_by_me);
    setShareCount(post.share_count);
  }, [post.liked_by_me, post.like_count, post.bookmarked_by_me, post.share_count]);

  const isMine = post.author_id === userId;

  const openProfile = () => router.push({ pathname: '/user/[username]', params: { username: post.author_username } });
  const openPost = (focusComment = false) =>
    router.push({ pathname: '/post/[id]', params: focusComment ? { id: post.id, focus: '1' } : { id: post.id } });

  const animateHeart = () => {
    heartScale.setValue(0.7);
    Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 20 }).start();
  };

  const toggleLike = async (forceLike = false) => {
    if (!userId) return;
    const next = forceLike ? true : !liked;
    if (next === liked) {
      if (forceLike) playBurst();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setLikedState(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (next) animateHeart();
    if (forceLike) playBurst();
    try {
      await setLiked(userId, post.id, next);
    } catch (err) {
      setLikedState(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      showToast(friendlyError(err), 'error');
    }
  };

  const playBurst = () => {
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
      Animated.timing(burst, { toValue: 0, duration: 250, delay: 350, useNativeDriver: true }),
    ]).start();
  };

  const toggleSave = async () => {
    if (!userId) return;
    const next = !saved;
    Haptics.selectionAsync().catch(() => undefined);
    setSaved(next);
    try {
      await setBookmarked(userId, post.id, next);
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
      showToast(next ? 'Saved to your bookmarks' : 'Removed from bookmarks', 'info');
    } catch (err) {
      setSaved(!next);
      showToast(friendlyError(err), 'error');
    }
  };

  const share = async () => {
    try {
      const link = Linking.createURL(`/post/${post.id}`);
      const excerpt = post.body.length > 140 ? `${post.body.slice(0, 140)}…` : post.body;
      const result = await Share.share({
        message: `${post.author_display_name} on OurBeckett${excerpt ? `: “${excerpt}”` : ''}\n${link}`,
      });
      if (result.action === Share.sharedAction) {
        setShareCount((c) => c + 1);
        recordShare(post.id).catch(() => undefined);
      }
    } catch {
      // Share sheet dismissed or unavailable.
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete post?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post.id);
            queryClient.invalidateQueries({ queryKey: queryKeys.posts });
            queryClient.removeQueries({ queryKey: queryKeys.post(post.id) });
            showToast('Post deleted');
            onDeleted?.();
          } catch (err) {
            showToast(friendlyError(err), 'error');
          }
        },
      },
    ]);
  };

  const openMenu = () => {
    const options: SheetOption[] = [];
    if (isMine || canModerate) {
      options.push({ label: isMine ? 'Delete post' : 'Remove post (moderator)', icon: 'trash-outline', destructive: true, onPress: confirmDelete });
    }
    if (!isMine) {
      options.push({ label: `View @${post.author_username}`, icon: 'person-circle-outline', onPress: openProfile });
      options.push({ label: 'Report post', icon: 'flag-outline', destructive: true, onPress: () => report('post', post.id, 'post') });
      options.push({
        label: `Block @${post.author_username}`,
        icon: 'ban-outline',
        destructive: true,
        onPress: () => block(post.author_id, post.author_username),
      });
    }
    options.push({ label: saved ? 'Remove bookmark' : 'Bookmark', icon: saved ? 'bookmark' : 'bookmark-outline', onPress: toggleSave });
    showSheet({ options });
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.header}>
        <Pressable onPress={openProfile} accessibilityRole="button" accessibilityLabel={`${post.author_display_name}'s profile`}>
          <Avatar uri={post.author_avatar_url} name={post.author_display_name} size={42} />
        </Pressable>
        <Pressable style={styles.meta} onPress={openProfile}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {post.author_display_name}
            </AppText>
            <AppText variant="caption" tone="muted">
              {' · '}
              {timeAgo(post.created_at)}
            </AppText>
          </View>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            @{post.author_username}
          </AppText>
        </Pressable>
        <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Post options" style={styles.more}>
          <Icon name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {post.community_id && post.community_name ? (
        <Pressable
          onPress={() => router.push({ pathname: '/community/[id]', params: { id: post.community_id as string } })}
          style={[styles.communityPill, { backgroundColor: colors.primarySoft }]}
          accessibilityRole="link"
        >
          <AppText variant="tiny">{post.community_icon}</AppText>
          <AppText variant="tiny" tone="link">
            {post.community_name}
          </AppText>
        </Pressable>
      ) : null}

      {post.body ? (
        <Pressable onPress={detail ? undefined : () => openPost()} disabled={detail}>
          <RichText text={post.body} variant={detail ? 'h3' : 'body'} style={[styles.body, detail ? styles.detailBody : null]} />
        </Pressable>
      ) : null}

      <View>
        <MediaGallery urls={post.media_urls} type={post.media_type} onDoubleTap={() => toggleLike(true)} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.burst,
            { opacity: burst, transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.2] }) }] },
          ]}
        >
          <Icon name="heart" size={96} color="#FFFFFF" />
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <PressableScale onPress={() => toggleLike()} style={styles.action} accessibilityRole="button" accessibilityLabel={liked ? 'Unlike' : 'Like'} scaleTo={0.85}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Icon name={liked ? 'heart' : 'heart-outline'} size={23} color={liked ? colors.like : colors.textSecondary} />
          </Animated.View>
          <AppText variant="label" tone="secondary">
            {likeCount > 0 ? formatCount(likeCount) : ''}
          </AppText>
        </PressableScale>
        <PressableScale onPress={() => openPost(true)} style={styles.action} accessibilityRole="button" accessibilityLabel="Comment" scaleTo={0.85}>
          <Icon name="chatbubble-outline" size={21} color={colors.textSecondary} />
          <AppText variant="label" tone="secondary">
            {post.comment_count > 0 ? formatCount(post.comment_count) : ''}
          </AppText>
        </PressableScale>
        <PressableScale onPress={share} style={styles.action} accessibilityRole="button" accessibilityLabel="Share" scaleTo={0.85}>
          <Icon name="paper-plane-outline" size={21} color={colors.textSecondary} />
          <AppText variant="label" tone="secondary">
            {shareCount > 0 ? formatCount(shareCount) : ''}
          </AppText>
        </PressableScale>
        <View style={styles.spacer} />
        <PressableScale onPress={toggleSave} style={styles.actionEnd} accessibilityRole="button" accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark'} scaleTo={0.85}>
          <Icon name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? colors.link : colors.textSecondary} />
        </PressableScale>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { flexShrink: 1 },
  more: { padding: spacing.xs },
  communityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: spacing.sm + 2,
  },
  body: { marginTop: spacing.sm + 2 },
  detailBody: { fontWeight: '400' },
  burst: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginLeft: -spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, minWidth: 64 },
  actionEnd: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  spacer: { flex: 1 },
});
