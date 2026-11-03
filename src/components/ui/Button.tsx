import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'gradient' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const heights: Record<Size, number> = { sm: 34, md: 46, lg: 54 };
const paddings: Record<Size, number> = { sm: spacing.md, md: spacing.lg, lg: spacing.xl };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth,
  style,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    gradient: { bg: 'transparent', fg: '#FFFFFF' },
    secondary: { bg: colors.primarySoft, fg: colors.link },
    outline: { bg: 'transparent', fg: colors.text, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.link },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const { bg, fg, border } = palette[variant];
  const textVariant = size === 'sm' ? 'label' : 'bodyStrong';
  const iconSize = size === 'sm' ? 15 : 18;

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={iconSize} color={fg} /> : null}
          <AppText variant={textVariant} style={{ color: fg }} numberOfLines={1}>
            {title}
          </AppText>
          {iconRight ? <Icon name={iconRight} size={iconSize} color={fg} /> : null}
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={() => {
        if (inactive) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      style={[
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: paddings[size],
          backgroundColor: bg,
          borderColor: border ?? 'transparent',
          borderWidth: border ? StyleSheet.hairlineWidth * 2 : 0,
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        variant === 'gradient' || variant === 'primary' ? shadow(colors.shadow, 1) : null,
        style,
      ]}
    >
      {variant === 'gradient' ? (
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]}
        />
      ) : null}
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
