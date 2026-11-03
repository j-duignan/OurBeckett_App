import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatEventDate } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';
import { Icon } from './ui/Icon';

type Props = {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  error?: string | null;
};

/** Date + time picker: native compact picker on iOS, two-step dialog on Android. */
export function DateTimeField({ label, value, onChange, minimumDate, error }: Props) {
  const { colors, isDark } = useTheme();

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      onValueChange: (_event, date) => {
        const picked = new Date(value);
        picked.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        DateTimePickerAndroid.open({
          value: picked,
          mode: 'time',
          is24Hour: true,
          onValueChange: (_e, time) => {
            const final = new Date(picked);
            final.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(final);
          },
        });
      },
    });
  };

  return (
    <View style={styles.container}>
      <AppText variant="label" tone="secondary" style={styles.label}>
        {label}
      </AppText>
      {Platform.OS === 'ios' ? (
        <View style={[styles.field, { backgroundColor: colors.inputBackground, borderColor: error ? colors.danger : 'transparent' }]}>
          <Icon name="calendar-outline" size={18} color={colors.textMuted} />
          <View style={styles.flex} />
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            minimumDate={minimumDate}
            minuteInterval={5}
            themeVariant={isDark ? 'dark' : 'light'}
            accentColor={colors.primary}
            onValueChange={(_event, date) => onChange(date)}
          />
        </View>
      ) : (
        <Pressable
          onPress={openAndroid}
          style={[styles.field, { backgroundColor: colors.inputBackground, borderColor: error ? colors.danger : 'transparent' }]}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${formatEventDate(value.toISOString())}`}
        >
          <Icon name="calendar-outline" size={18} color={colors.textMuted} />
          <AppText style={styles.flex}>{formatEventDate(value.toISOString())}</AppText>
          <Icon name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>
      )}
      {error ? (
        <AppText variant="caption" tone="danger" style={styles.label}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs + 2 },
  label: { marginLeft: spacing.xs },
  flex: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md + 2,
  },
});
