import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './ui/AppText';

type Props = { size?: number; wordmark?: boolean; light?: boolean };

/** The OurBeckett mark: a gradient squircle with a lowercase "ob". */
export function Logo({ size = 36, wordmark = true, light }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <LinearGradient
        colors={light ? ['#FFFFFF', '#EDE4FF'] : colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size * 0.32, alignItems: 'center', justifyContent: 'center' }}
      >
        <AppText style={{ color: light ? '#4C1D95' : '#FFFFFF', fontSize: size * 0.46, lineHeight: size * 0.56, fontWeight: '900', letterSpacing: -1 }}>
          ob
        </AppText>
      </LinearGradient>
      {wordmark ? (
        <AppText style={{ fontSize: size * 0.62, lineHeight: size * 0.8, fontWeight: '800', letterSpacing: -0.8, color: light ? '#FFFFFF' : colors.text }}>
          OurBeckett
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
