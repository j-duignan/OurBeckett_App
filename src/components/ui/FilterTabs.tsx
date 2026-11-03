import * as Haptics from 'expo-haptics';
import { ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { spacing } from '@/theme/tokens';

import { Chip } from './Chip';
import type { IconName } from './Icon';

export type FilterOption<T extends string> = { key: T; label: string; icon?: IconName };

type Props<T extends string> = {
  options: readonly FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** Horizontally scrolling pill filters (feed modes, categories, search scopes). */
export function FilterTabs<T extends string>({ options, value, onChange, style }: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={[styles.scroll, style]}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => (
        <Chip
          key={option.key}
          label={option.label}
          icon={option.icon}
          selected={option.key === value}
          onPress={() => {
            if (option.key !== value) {
              Haptics.selectionAsync().catch(() => undefined);
              onChange(option.key);
            }
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
