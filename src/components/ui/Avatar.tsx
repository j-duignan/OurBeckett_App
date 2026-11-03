import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

type Props = {
  uri: string | null | undefined;
  name: string;
  size?: number;
  online?: boolean;
  ring?: boolean;
};

const FALLBACK_GRADIENTS: readonly (readonly [string, string])[] = [
  ['#7C3AED', '#DB2777'],
  ['#5B21B6', '#2563EB'],
  ['#9333EA', '#F59E0B'],
  ['#4C1D95', '#0EA5E9'],
  ['#A21CAF', '#F43F5E'],
  ['#6D28D9', '#10B981'],
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

function gradientFor(name: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length];
}

export function Avatar({ uri, name, size = 40, online, ring }: Props) {
  const { colors } = useTheme();
  const dot = Math.max(10, Math.round(size * 0.28));

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          ring ? { borderWidth: 2, borderColor: colors.primary } : null,
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <LinearGradient colors={gradientFor(name)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fallback}>
            <AppText style={{ color: '#FFFFFF', fontSize: size * 0.38, lineHeight: size * 0.46, fontWeight: '700' }}>
              {initials(name)}
            </AppText>
          </LinearGradient>
        )}
      </View>
      {online ? (
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: colors.online,
              borderColor: colors.background,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2 },
});
