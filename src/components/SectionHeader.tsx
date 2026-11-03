import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';

type Props = { title: string; actionLabel?: string; onAction?: () => void };

export function SectionHeader({ title, actionLabel = 'See all', onAction }: Props) {
  return (
    <View style={styles.row}>
      <AppText variant="h2">{title}</AppText>
      {onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <AppText variant="label" tone="link">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
});
