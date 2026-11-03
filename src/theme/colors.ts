/**
 * OurBeckett palette. Deep Leeds Beckett-inspired purple with warm
 * magenta highlights and soft violet-tinted neutrals.
 */
export type ThemeColors = {
  background: string;
  surface: string;
  card: string;
  elevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  link: string;
  accent: string;
  like: string;
  success: string;
  warning: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
  inputBackground: string;
  skeleton: string;
  tabBar: string;
  shadow: string;
  online: string;
  bubbleMine: string;
  bubbleMineText: string;
  bubbleTheirs: string;
  bubbleTheirsText: string;
  gradient: readonly [string, string, string];
  gradientSoft: readonly [string, string];
};

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F7F5FB',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  border: '#ECE8F4',
  borderStrong: '#D9D2E6',
  text: '#15101F',
  textSecondary: '#4A4458',
  textMuted: '#8A8399',
  primary: '#5B21B6',
  primaryPressed: '#4C1D95',
  primarySoft: '#F0EAFD',
  onPrimary: '#FFFFFF',
  link: '#5B21B6',
  accent: '#DB2777',
  like: '#F43F5E',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  dangerSoft: '#FEECEC',
  overlay: 'rgba(12, 6, 24, 0.55)',
  inputBackground: '#F4F1F9',
  skeleton: '#EEEAF5',
  tabBar: 'rgba(255, 255, 255, 0.96)',
  shadow: '#2E1065',
  online: '#22C55E',
  bubbleMine: '#5B21B6',
  bubbleMineText: '#FFFFFF',
  bubbleTheirs: '#F1EDF8',
  bubbleTheirsText: '#15101F',
  gradient: ['#2E1065', '#5B21B6', '#A21CAF'],
  gradientSoft: ['#F3EDFF', '#FDF2FA'],
};

export const darkColors: ThemeColors = {
  background: '#0B0812',
  surface: '#120E1B',
  card: '#17121F',
  elevated: '#1F1929',
  border: '#272033',
  borderStrong: '#3A3149',
  text: '#F5F2FA',
  textSecondary: '#C9C2D6',
  textMuted: '#8B839B',
  primary: '#7C3AED',
  primaryPressed: '#6D28D9',
  primarySoft: '#241A3B',
  onPrimary: '#FFFFFF',
  link: '#B69CFF',
  accent: '#F472B6',
  like: '#FB7185',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  dangerSoft: '#2C1416',
  overlay: 'rgba(0, 0, 0, 0.65)',
  inputBackground: '#1A1523',
  skeleton: '#1F1929',
  tabBar: 'rgba(18, 14, 27, 0.97)',
  shadow: '#000000',
  online: '#22C55E',
  bubbleMine: '#7C3AED',
  bubbleMineText: '#FFFFFF',
  bubbleTheirs: '#211B2C',
  bubbleTheirsText: '#F5F2FA',
  gradient: ['#1E0B45', '#4C1D95', '#86198F'],
  gradientSoft: ['#1A1229', '#211327'],
};
