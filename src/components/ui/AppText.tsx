import { Text, TextProps, TextStyle } from 'react-native';

import { ThemeColors } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { typography, TypographyVariant } from '@/theme/tokens';

export type TextTone = 'default' | 'secondary' | 'muted' | 'primary' | 'link' | 'danger' | 'success' | 'onPrimary' | 'accent';

const toneToColor: Record<TextTone, keyof ThemeColors> = {
  default: 'text',
  secondary: 'textSecondary',
  muted: 'textMuted',
  primary: 'primary',
  link: 'link',
  danger: 'danger',
  success: 'success',
  onPrimary: 'onPrimary',
  accent: 'accent',
};

type Props = TextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
};

export function AppText({ variant = 'body', tone = 'default', align, weight, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        typography[variant],
        { color: colors[toneToColor[tone]] as string },
        align ? { textAlign: align } : null,
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    />
  );
}
