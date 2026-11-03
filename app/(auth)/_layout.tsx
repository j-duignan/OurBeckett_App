import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

export const unstable_settings = {
  initialRouteName: 'welcome',
};

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
