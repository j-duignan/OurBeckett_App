import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { timeAgo } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { CommentItem } from '@/types/models';

import { RichText } from './RichText';
import { AppText } from './ui/AppText';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';

type Props = {
  comment: CommentItem;
  isReply?: boolean;
  onReply: (comment: CommentItem) => void;
  onMore: (comment: CommentItem) => void;
};

export function CommentRow({ comment, isReply, onReply, onMore }: Props) {
  const { colors } = useTheme();
  const openProfile = () => router.push({ pathname: '/user/[username]', params: { username: comment.author_username } });
  return (
    <View style={[styles.row, isReply ? styles.reply : null]}>
      <Pressable onPress={openProfile} accessibilityRole="button" accessibilityLabel={`${comment.author_display_name}'s profile`}>
        <Avatar uri={comment.author_avatar_url} name={comment.author_display_name} size={isReply ? 28 : 36} />
      </Pressable>
      <View style={styles.content}>
        <View style={styles.meta}>
          <AppText variant="label" onPress={openProfile}>
            {comment.author_display_name}
          </AppText>
          <AppText variant="caption" tone="muted">
            {timeAgo(comment.created_at)}
          </AppText>
        </View>
        <RichText text={comment.body} variant="callout" />
        <View style={styles.actions}>
          <Pressable onPress={() => onReply(comment)} hitSlop={8} accessibilityRole="button">
            <AppText variant="label" tone="muted">
              Reply
            </AppText>
          </Pressable>
        </View>
      </View>
      <Pressable onPress={() => onMore(comment)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Comment options">
        <Icon name="ellipsis-horizontal" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  reply: { paddingLeft: spacing.lg + 48 },
  content: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.lg, marginTop: 4 },
});
