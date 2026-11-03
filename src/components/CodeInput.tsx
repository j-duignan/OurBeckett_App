import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputInstance, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: string | null;
  autoFocus?: boolean;
};

/** Segmented one-time-code input backed by a single hidden TextInput. */
export function CodeInput({ value, onChange, length = 6, error, autoFocus = true }: Props) {
  const { colors } = useTheme();
  const ref = useRef<TextInputInstance>(null);
  const cells = Array.from({ length }, (_, i) => value[i] ?? '');

  return (
    <View>
      <Pressable style={styles.row} onPress={() => ref.current?.focus()} accessibilityLabel="Verification code">
        {cells.map((char, i) => {
          const active = i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={[
                styles.cell,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: error ? colors.danger : active ? colors.primary : 'transparent',
                },
              ]}
            >
              <AppText variant="h2">{char}</AppText>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        style={styles.hidden}
        caretHidden
      />
      {error ? (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  cell: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.82,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  error: { marginTop: spacing.sm, textAlign: 'center' },
});
