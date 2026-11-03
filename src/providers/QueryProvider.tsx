import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
