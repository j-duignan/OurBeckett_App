import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Header } from '@/components/ui/Header';
import { Icon, IconName } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Logo } from '@/components/Logo';
import { useAuth, useCurrentUser } from '@/providers/AuthProvider';
import { ThemeMode, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <AppText variant="label" tone="muted" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </AppText>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function Row({ icon, label, value, onPress, destructive, right }: { icon: IconName; label: string; value?: string; onPress?: () => void; destructive?: boolean; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: colors.surface } : null]}
      accessibilityRole="button"
    >
      <Icon name={icon} size={20} color={destructive ? colors.danger : colors.textSecondary} />
      <AppText variant="bodyStrong" tone={destructive ? 'danger' : 'default'} style={styles.flex}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="callout" tone="muted">
          {value}
        </AppText>
      ) : null}
      {right ?? (onPress && !destructive ? <Icon name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'system', label: 'Automatic', icon: 'phone-portrait-outline' },
  { mode: 'light', label: 'Light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  const { profile } = useCurrentUser();
  const { signOut, session } = useAuth();

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You can sign back in any time with your student email.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <Screen>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Account">
          <Row icon="person-circle-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
          <Row icon="mail-outline" label="Email" value={session?.user.email ?? ''} />
          <Row icon="lock-closed-outline" label="Change password" onPress={() => router.push({ pathname: '/change-password' })} />
        </Section>

        <Section title="Appearance">
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((option) => {
              const selected = mode === option.mode;
              return (
                <Pressable
                  key={option.mode}
                  onPress={() => setMode(option.mode)}
                  style={[styles.themeOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : 'transparent' }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Icon name={option.icon} size={22} color={selected ? colors.link : colors.textSecondary} />
                  <AppText variant="label" tone={selected ? 'link' : 'secondary'}>
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Your stuff">
          <Row icon="bookmark-outline" label="Saved posts" onPress={() => router.push('/bookmarks')} />
          <Row icon="calendar-outline" label="Events I’m going to" onPress={() => router.push('/events')} />
          <Row icon="storefront-outline" label="Marketplace" onPress={() => router.push('/marketplace')} />
          <Row icon="people-outline" label="Communities" onPress={() => router.push('/communities')} />
        </Section>

        <Section title="Safety">
          <Row icon="ban-outline" label="Blocked students" onPress={() => router.push('/blocked')} />
        </Section>

        <Section title="Session">
          <Row icon="log-out-outline" label="Sign out" destructive onPress={confirmSignOut} />
        </Section>

        <View style={styles.footer}>
          <Logo size={26} />
          <AppText variant="caption" tone="muted" align="center">
            Signed in as @{profile.username} · v{Constants.expoConfig?.version ?? '1.0.0'}
          </AppText>
          <AppText variant="caption" tone="muted" align="center">
            Built for Leeds Beckett students. Not an official university service.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  section: { marginBottom: spacing.xl },
  sectionTitle: { marginLeft: spacing.sm, marginBottom: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  themeRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  themeOption: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5 },
  footer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
});
