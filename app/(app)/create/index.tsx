import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Header } from '@/components/ui/Header';
import { Icon, IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, spacing } from '@/theme/tokens';

type Option = {
  title: string;
  subtitle: string;
  icon: IconName;
  tint: string;
  href: '/create/post' | '/create/event' | '/create/listing' | '/create/community';
};

const OPTIONS: Option[] = [
  { title: 'Post', subtitle: 'Share a thought, photos or a video', icon: 'create', tint: '#7C3AED', href: '/create/post' },
  { title: 'Event', subtitle: 'Host a social, match or study session', icon: 'calendar', tint: '#DB2777', href: '/create/event' },
  { title: 'Sell or swap', subtitle: 'List something on the marketplace', icon: 'pricetag', tint: '#0EA5E9', href: '/create/listing' },
  { title: 'Community', subtitle: 'Start a group for your people', icon: 'people', tint: '#F59E0B', href: '/create/community' },
];

export default function CreateHub() {
  const { colors } = useTheme();
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Create" close border={false} />
      <View style={styles.list}>
        <AppText variant="h1" style={styles.title}>
          What are you sharing?
        </AppText>
        {OPTIONS.map((option) => (
          <PressableScale
            key={option.title}
            onPress={() => router.replace(option.href)}
            scaleTo={0.97}
            style={[styles.card, shadow(colors.shadow, 1), { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={`${option.title}: ${option.subtitle}`}
          >
            <View style={[styles.icon, { backgroundColor: option.tint }]}>
              <Icon name={option.icon} size={24} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <AppText variant="h3">{option.title}</AppText>
              <AppText variant="caption" tone="muted">
                {option.subtitle}
              </AppText>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.textMuted} />
          </PressableScale>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  title: { marginBottom: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
});
