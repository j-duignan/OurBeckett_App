import { router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/States';

/**
 * Placeholder route for the centre tab. The tab bar intercepts presses and
 * opens the /create modal instead, so this only shows if deep-linked.
 */
export default function NewTab() {
  return (
    <Screen>
      <EmptyState
        icon="add-circle-outline"
        title="Share something"
        message="Post an update, host an event, sell something or start a community."
        actionLabel="Create"
        onAction={() => router.push('/create')}
      />
    </Screen>
  );
}
