import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create/index" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create/post" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create/event" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create/listing" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create/community" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
      <Stack.Screen name="change-password" options={{ presentation: 'modal' }} />
      <Stack.Screen name="new-message" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
