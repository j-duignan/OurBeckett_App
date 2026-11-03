import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Badge } from './Badge';
import { Icon, IconName } from './Icon';
import { PressableScale } from './PressableScale';

type Props = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  color?: string;
  filled?: boolean;
  badge?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function IconButton({ icon, onPress, accessibilityLabel, size = 22, color, filled, badge, style, disabled }: Props) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      scaleTo={0.88}
      style={[
        styles.button,
        { width: size + 18, height: size + 18, borderRadius: (size + 18) / 2 },
        filled ? { backgroundColor: colors.surface } : null,
        disabled ? { opacity: 0.4 } : null,
        style,
      ]}
    >
      <Icon name={icon} size={size} color={color ?? colors.text} />
      {badge ? (
        <View style={styles.badge}>
          <Badge count={badge} />
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 0 },
});
