import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { OverlayProvider } from '@/providers/OverlayProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { RealtimeProvider } from '@/providers/RealtimeProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <RealtimeProvider>
              <OverlayProvider>
                <RootNavigator />
              </OverlayProvider>
            </RealtimeProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, profile, initialising, profileError, recovering, refreshProfile, signOut } = useAuth();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (!initialising) SplashScreen.hideAsync().catch(() => undefined);
  }, [initialising]);

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [isDark, colors]);

  if (!isSupabaseConfigured) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Logo />
        <AppText variant="h2" align="center">
          Supabase isn’t configured
        </AppText>
        <AppText tone="muted" align="center">
          Copy .env.example to .env, add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.
        </AppText>
      </View>
    );
  }

  if (initialising) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (session && !profile && profileError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Logo />
        <AppText variant="h2" align="center">
          We couldn’t load your profile
        </AppText>
        <AppText tone="muted" align="center">
          {profileError}
        </AppText>
        <Button title="Try again" onPress={refreshProfile} icon="refresh" />
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </View>
    );
  }

  const signedIn = Boolean(session) && !recovering;
  const needsOnboarding = signedIn && Boolean(profile) && !profile?.onboarded;
  const ready = signedIn && Boolean(profile?.onboarded);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={needsOnboarding}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl, gap: spacing.md },
});
