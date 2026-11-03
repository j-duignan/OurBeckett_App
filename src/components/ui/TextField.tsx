import { forwardRef, ReactNode, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, TextInput, TextInputInstance, TextInputProps, View, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string | null;
  leftIcon?: IconName;
  right?: ReactNode;
  secureToggle?: boolean;
  showCount?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, error, hint, leftIcon, right, secureToggle, showCount, containerStyle, multiline, style, value, maxLength, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const borderColor = error ? colors.danger : focused ? colors.primary : 'transparent';

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText variant="label" tone="secondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.inputBackground,
            borderColor,
            minHeight: multiline ? 96 : 50,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {leftIcon ? (
          <Icon name={leftIcon} size={18} color={focused ? colors.primary : colors.textMuted} style={multiline ? styles.multilineIcon : undefined} />
        ) : null}
        <TextInput
          ref={ref}
          {...rest}
          value={value}
          maxLength={maxLength}
          multiline={multiline}
          secureTextEntry={secureToggle ? hidden : rest.secureTextEntry}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.input,
            typography.body,
            { color: colors.text, textAlignVertical: multiline ? 'top' : 'center', paddingTop: multiline ? spacing.md : 0 },
            style,
          ]}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
        {right}
      </View>
      {error || hint || (showCount && maxLength) ? (
        <View style={styles.footer}>
          <AppText variant="caption" tone={error ? 'danger' : 'muted'} style={styles.footerText}>
            {error ?? hint ?? ''}
          </AppText>
          {showCount && maxLength ? (
            <AppText variant="caption" tone="muted">
              {(value ?? '').length}/{maxLength}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs + 2 },
  label: { marginLeft: spacing.xs },
  field: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md + 2,
    gap: spacing.sm + 2,
  },
  multilineIcon: { marginTop: spacing.md + 1 },
  input: { flex: 1, paddingVertical: spacing.md, minHeight: 46 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs, gap: spacing.sm },
  footerText: { flex: 1 },
});
