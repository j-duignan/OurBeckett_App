import { router } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

type Props = {
  title?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  back?: boolean;
  close?: boolean;
  border?: boolean;
  large?: boolean;
};

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function Header({ title, subtitle, left, right, back = true, close, border = true, large }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.root,
        border ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null,
      ]}
    >
      <View style={styles.side}>
        {left ??
          (close ? (
            <IconButton icon="close" onPress={goBack} accessibilityLabel="Close" />
          ) : back ? (
            <IconButton icon="chevron-back" onPress={goBack} accessibilityLabel="Go back" />
          ) : null)}
      </View>
      <View style={[styles.center, large ? styles.centerLeft : null]}>
        {title ? (
          <AppText variant={large ? 'h1' : 'h3'} numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.sm,
  },
  side: { minWidth: 44, flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end', gap: spacing.xs },
  center: { flex: 1, alignItems: 'center' },
  centerLeft: { alignItems: 'flex-start' },
});
