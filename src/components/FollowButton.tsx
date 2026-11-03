import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { queryKeys } from '@/api/keys';
import { isFollowing, setFollowing } from '@/api/profiles';
import { friendlyError } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';

import { Button } from './ui/Button';

type Props = { targetId: string; size?: 'sm' | 'md'; fullWidth?: boolean };

export function FollowButton({ targetId, size = 'sm', fullWidth }: Props) {
  const { userId, refreshProfile } = useAuth();
  const { showToast } = useOverlay();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: following, isPending } = useQuery({
    queryKey: queryKeys.isFollowing(targetId),
    queryFn: () => isFollowing(userId as string, targetId),
    enabled: Boolean(userId) && userId !== targetId,
  });

  if (!userId || userId === targetId) return null;

  const toggle = async () => {
    const next = !following;
    setBusy(true);
    queryClient.setQueryData(queryKeys.isFollowing(targetId), next);
    try {
      await setFollowing(userId, targetId, next);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['follows'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestedUsers });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed('following') });
      refreshProfile();
    } catch (err) {
      queryClient.setQueryData(queryKeys.isFollowing(targetId), !next);
      showToast(friendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      title={following ? 'Following' : 'Follow'}
      variant={following ? 'outline' : 'primary'}
      icon={following ? undefined : 'person-add-outline'}
      size={size}
      onPress={toggle}
      loading={isPending}
      disabled={busy}
      fullWidth={fullWidth}
    />
  );
}
