import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useIsOnline } from '@/providers/RealtimeProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { ProfileSummary } from '@/types/models';

import { FollowButton } from './FollowButton';
import { AppText } from './ui/AppText';
import { Avatar } from './ui/Avatar';

type Props = {
  user: ProfileSummary;
  subtitle?: string;
  right?: ReactNode;
  showFollow?: boolean;
  onPress?: () => void;
};

export function UserRow({ user, subtitle, right, showFollow = true, onPress }: Props) {
  const { colors } = useTheme();
  const online = useIsOnline(user.id);
  return (
    <Pressable
      onPress={onPress ?? (() => router.push({ pathname: '/user/[username]', params: { username: user.username } }))}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: colors.surface } : null]}
      accessibilityRole="button"
    >
      <Avatar uri={user.avatar_url} name={user.display_name} size={46} online={online} />
      <View style={styles.meta}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {user.display_name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          @{user.username}
          {subtitle ? ` · ${subtitle}` : ''}
        </AppText>
      </View>
      {right ?? (showFollow ? <FollowButton targetId={user.id} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  meta: { flex: 1 },
});
