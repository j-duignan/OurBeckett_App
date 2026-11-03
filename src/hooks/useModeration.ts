import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { queryKeys } from '@/api/keys';
import { getOrCreateConversation } from '@/api/messages';
import { blockUser, unblockUser } from '@/api/profiles';
import { submitReport } from '@/api/reports';
import { REPORT_REASONS, ReportTarget } from '@/lib/constants';
import { friendlyError } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';

/** Opens the report reasons sheet and files the report. */
export function useReport() {
  const { userId } = useAuth();
  const { showSheet, showToast } = useOverlay();

  return useCallback(
    (targetType: ReportTarget, targetId: string, noun = 'this') => {
      if (!userId) return;
      showSheet({
        title: `Report ${noun}`,
        message: 'Your report is confidential. The person you report won’t know it was you.',
        options: REPORT_REASONS.map((reason) => ({
          label: reason.label,
          onPress: async () => {
            try {
              await submitReport({ reporterId: userId, targetType, targetId, reason: reason.value, details: '' });
              showToast('Thanks for letting us know. Our team will review it.');
            } catch (err) {
              showToast(friendlyError(err), 'error');
            }
          },
        })),
      });
    },
    [userId, showSheet, showToast],
  );
}

/** Confirms, then blocks (or unblocks) a student and refreshes affected data. */
export function useBlockUser() {
  const { userId } = useAuth();
  const { showToast } = useOverlay();
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.posts });
    queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    queryClient.invalidateQueries({ queryKey: queryKeys.blocked });
    queryClient.invalidateQueries({ queryKey: queryKeys.suggestedUsers });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['is-following'] });
    queryClient.invalidateQueries({ queryKey: ['blocked-state'] });
  }, [queryClient]);

  const block = useCallback(
    (otherId: string, username: string, onDone?: () => void) => {
      if (!userId) return;
      Alert.alert(
        `Block @${username}?`,
        'They won’t be able to message you or see your posts, and you won’t see theirs. They won’t be told you blocked them.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await blockUser(userId, otherId);
                refresh();
                showToast(`@${username} has been blocked`);
                onDone?.();
              } catch (err) {
                showToast(friendlyError(err), 'error');
              }
            },
          },
        ],
      );
    },
    [userId, refresh, showToast],
  );

  const unblock = useCallback(
    async (otherId: string, username: string) => {
      if (!userId) return;
      try {
        await unblockUser(userId, otherId);
        refresh();
        showToast(`@${username} has been unblocked`);
      } catch (err) {
        showToast(friendlyError(err), 'error');
      }
    },
    [userId, refresh, showToast],
  );

  return { block, unblock };
}

/** Opens (creating if needed) a DM with another student, optionally with a draft. */
export function useStartConversation() {
  const { showToast } = useOverlay();
  return useCallback(
    async (otherUserId: string, draft?: string) => {
      try {
        const id = await getOrCreateConversation(otherUserId);
        router.push({ pathname: '/chat/[id]', params: draft ? { id, draft } : { id } });
      } catch (err) {
        showToast(friendlyError(err), 'error');
      }
    },
    [showToast],
  );
}
