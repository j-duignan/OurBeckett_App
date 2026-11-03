import { Platform, TextStyle, ViewStyle } from 'react-native';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2 },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export function shadow(color: string, level: 1 | 2 | 3 = 1): ViewStyle {
  const presets = {
    1: { opacity: 0.06, radius: 8, y: 2, elevation: 2 },
    2: { opacity: 0.1, radius: 16, y: 6, elevation: 6 },
    3: { opacity: 0.18, radius: 24, y: 10, elevation: 12 },
  }[level];
  return Platform.select<ViewStyle>({
    android: { elevation: presets.elevation },
    default: {
      shadowColor: color,
      shadowOpacity: presets.opacity,
      shadowRadius: presets.radius,
      shadowOffset: { width: 0, height: presets.y },
    },
  });
}
