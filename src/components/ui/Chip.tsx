import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { PressableScale } from './PressableScale';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

export function Chip({ label, selected, onPress, icon, style, small }: Props) {
  const { colors } = useTheme();
  const fg = selected ? colors.onPrimary : colors.textSecondary;
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: Boolean(selected) }}
      style={[
        styles.chip,
        small ? styles.small : null,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 13 : 15} color={fg} /> : null}
      <AppText variant={small ? 'tiny' : 'label'} style={{ color: fg }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  small: { height: 26, paddingHorizontal: spacing.sm + 2 },
});
