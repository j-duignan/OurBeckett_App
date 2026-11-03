import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, TextInput, TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addComment, deleteComment, fetchComments } from '@/api/comments';
import { fetchCommunity } from '@/api/communities';
import { queryKeys } from '@/api/keys';
import { fetchPost } from '@/api/posts';
import { CommentRow } from '@/components/CommentRow';
import { PostCard } from '@/components/PostCard';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Header } from '@/components/ui/Header';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useReport } from '@/hooks/useModeration';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { SheetOption, useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import type { CommentItem } from '@/types/models';

type Row = { comment: CommentItem; isReply: boolean };

export default function PostDetail() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, profile } = useCurrentUser();
  const { showSheet, showToast } = useOverlay();
  const report = useReport();
  const queryClient = useQueryClient();
  const inputRef = useRef<TextInputInstance>(null);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const postQuery = useQuery({ queryKey: queryKeys.post(id), queryFn: () => fetchPost(id) });
  const commentsQuery = useQuery({ queryKey: queryKeys.comments(id), queryFn: () => fetchComments(id) });
  const communityId = postQuery.data?.community_id ?? null;
  const communityQuery = useQuery({
    queryKey: queryKeys.community(communityId ?? ''),
    queryFn: () => fetchCommunity(communityId as string),
    enabled: Boolean(communityId),
  });
  const canModerate = communityQuery.data?.my_role === 'owner' || communityQuery.data?.my_role === 'moderator';
  const isPostAuthor = postQuery.data?.author_id === userId;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const thread of commentsQuery.data ?? []) {
      out.push({ comment: thread, isReply: false });
      for (const reply of thread.replies) out.push({ comment: reply, isReply: true });
    }
    return out;
  }, [commentsQuery.data]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([postQuery.refetch(), commentsQuery.refetch()]);
    setRefreshing(false);
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await addComment({ postId: id, authorId: userId, body, parentId: replyTo?.parent_id ?? replyTo?.id ?? null });
      setText('');
      setReplyTo(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.comments(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.post(id) }),
      ]);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setSending(false);
    }
  };

  const startReply = (comment: CommentItem) => {
    setReplyTo(comment);
    setText(`@${comment.author_username} `);
    inputRef.current?.focus();
  };

  const commentMenu = (comment: CommentItem) => {
    const mine = comment.author_id === userId;
    const options: SheetOption[] = [
      { label: 'Reply', icon: 'arrow-undo-outline', onPress: () => startReply(comment) },
      {
        label: `View @${comment.author_username}`,
        icon: 'person-circle-outline',
        onPress: () => router.push({ pathname: '/user/[username]', params: { username: comment.author_username } }),
      },
    ];
    if (mine || isPostAuthor || canModerate) {
      options.push({
        label: 'Delete comment',
        icon: 'trash-outline',
        destructive: true,
        onPress: () =>
          Alert.alert('Delete comment?', 'Replies to it will also be removed.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteComment(comment.id);
                  queryClient.invalidateQueries({ queryKey: queryKeys.comments(id) });
                  queryClient.invalidateQueries({ queryKey: queryKeys.post(id) });
                } catch (err) {
                  showToast(friendlyError(err), 'error');
                }
              },
            },
          ]),
      });
    }
    if (!mine) {
      options.push({ label: 'Report comment', icon: 'flag-outline', destructive: true, onPress: () => report('comment', comment.id, 'comment') });
    }
    showSheet({ options });
  };

  if (postQuery.isPending) {
    return (
      <Screen>
        <Header title="Post" />
        <LoadingState />
      </Screen>
    );
  }
  if (postQuery.isError || !postQuery.data) {
    return (
      <Screen>
        <Header title="Post" />
        {postQuery.isError ? (
          <ErrorState error={postQuery.error} onRetry={() => postQuery.refetch()} />
        ) : (
          <EmptyState icon="document-outline" title="Post not available" message="It may have been deleted, or you can’t view it." />
        )}
      </Screen>
    );
  }

  const post = postQuery.data;

  return (
    <Screen>
      <Header title="Post" subtitle={post.community_name ?? undefined} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 54 : 0}>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.comment.id}
          renderItem={({ item }) => <CommentRow comment={item.comment} isReply={item.isReply} onReply={startReply} onMore={commentMenu} />}
          ListHeaderComponent={
            <View>
              <PostCard post={post} detail canModerate={canModerate} onDeleted={() => router.back()} />
              <AppText variant="label" tone="muted" style={styles.commentsTitle}>
                {post.comment_count ? `${post.comment_count} COMMENT${post.comment_count === 1 ? '' : 'S'}` : 'COMMENTS'}
              </AppText>
            </View>
          }
          ListEmptyComponent={
            commentsQuery.isPending ? (
              <LoadingState style={styles.smallState} />
            ) : commentsQuery.isError ? (
              <ErrorState error={commentsQuery.error} onRetry={() => commentsQuery.refetch()} style={styles.smallState} />
            ) : (
              <EmptyState icon="chatbubble-ellipses-outline" title="No comments yet" message="Start the conversation." style={styles.smallState} />
            )
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
        />

        <View style={[styles.composerWrap, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          {replyTo ? (
            <View style={styles.replying}>
              <AppText variant="caption" tone="muted" style={styles.flex}>
                Replying to <AppText variant="caption" weight="700">@{replyTo.author_username}</AppText>
              </AppText>
              <Pressable
                onPress={() => {
                  setReplyTo(null);
                  setText('');
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
              >
                <Icon name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composer}>
            <Avatar uri={profile.avatar_url} name={profile.display_name} size={34} />
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              autoFocus={focus === '1'}
              style={[styles.input, typography.body, { backgroundColor: colors.inputBackground, color: colors.text }]}
            />
            <PressableScale
              onPress={send}
              disabled={!text.trim() || sending}
              style={[styles.send, { backgroundColor: text.trim() ? colors.primary : colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
            >
              <Icon name="arrow-up" size={20} color="#FFFFFF" />
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { paddingBottom: spacing.lg },
  commentsTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  smallState: { minHeight: 160, flex: 0 },
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, paddingHorizontal: spacing.md },
  replying: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md + 2,
    paddingTop: 10,
    paddingBottom: 10,
  },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
