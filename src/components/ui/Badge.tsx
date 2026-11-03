import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

export function Badge({ count, dot }: { count?: number; dot?: boolean }) {
  const { colors } = useTheme();
  if (dot) {
    return <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.background }]} />;
  }
  if (!count) return null;
  return (
    <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
      <AppText variant="tiny" style={styles.text}>
        {count > 99 ? '99+' : count}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  text: { color: '#FFFFFF', fontSize: 10, lineHeight: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
