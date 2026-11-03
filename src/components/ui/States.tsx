import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { friendlyError } from '@/lib/validation';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, IconName } from './Icon';

export function LoadingState({ label, style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, style]}>
      <ActivityIndicator color={colors.primary} />
      {label ? (
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

type EmptyProps = {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ icon, title, message, actionLabel, onAction, style }: EmptyProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, styles.padded, style]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={30} color={colors.link} />
      </View>
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="callout" tone="muted" align="center" style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} size="sm" style={styles.action} /> : null}
    </View>
  );
}

export function ErrorState({
  error,
  onRetry,
  style,
}: {
  error: unknown;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, styles.padded, style]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
        <Icon name="cloud-offline-outline" size={30} color={colors.danger} />
      </View>
      <AppText variant="h3" align="center">
        Couldn’t load this
      </AppText>
      <AppText variant="callout" tone="muted" align="center" style={styles.message}>
        {friendlyError(error)}
      </AppText>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="secondary" size="sm" icon="refresh" style={styles.action} /> : null}
    </View>
  );
}

export function ListFooterLoader({ loading }: { loading: boolean }) {
  const { colors } = useTheme();
  if (!loading) return <View style={styles.footerSpacer} />;
  return (
    <View style={styles.footer}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 200 },
  padded: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xxxl },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  message: { maxWidth: 300 },
  action: { marginTop: spacing.md },
  footer: { paddingVertical: spacing.xl },
  footerSpacer: { height: spacing.xxxl },
});
