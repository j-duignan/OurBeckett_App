import { router } from 'expo-router';
import { Linking, TextProps } from 'react-native';

import { AppText } from './ui/AppText';
import type { TypographyVariant } from '@/theme/tokens';

const TOKEN_REGEX = /(#[A-Za-z0-9_]{2,40}|@[a-zA-Z0-9_.]{3,20}|https?:\/\/[^\s]+)/g;

type Props = TextProps & { text: string; variant?: TypographyVariant };

/** Renders post/comment text with tappable #hashtags, @mentions and links. */
export function RichText({ text, variant = 'body', ...rest }: Props) {
  const parts = text.split(TOKEN_REGEX);
  return (
    <AppText variant={variant} {...rest}>
      {parts.map((part, index) => {
        if (!part) return null;
        if (index % 2 === 1) {
          if (part.startsWith('#')) {
            const tag = part.slice(1).toLowerCase();
            return (
              <AppText
                key={index}
                variant={variant}
                tone="link"
                weight="600"
                onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag } })}
              >
                {part}
              </AppText>
            );
          }
          if (part.startsWith('@')) {
            const username = part.slice(1).toLowerCase().replace(/\.+$/, '');
            return (
              <AppText
                key={index}
                variant={variant}
                tone="link"
                weight="600"
                onPress={() => router.push({ pathname: '/user/[username]', params: { username } })}
              >
                {part}
              </AppText>
            );
          }
          return (
            <AppText key={index} variant={variant} tone="link" onPress={() => Linking.openURL(part).catch(() => undefined)}>
              {part}
            </AppText>
          );
        }
        return part;
      })}
    </AppText>
  );
}
