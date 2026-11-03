import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { joinCommunity } from '@/api/communities';
import { queryKeys } from '@/api/keys';
import { friendlyError } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, spacing } from '@/theme/tokens';
import type { Community } from '@/types/models';

import { AppText } from './ui/AppText';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { PressableScale } from './ui/PressableScale';

function memberLabel(n: number) {
  return `${n.toLocaleString()} member${n === 1 ? '' : 's'}`;
}

function open(id: string) {
  router.push({ pathname: '/community/[id]', params: { id } });
}

function JoinButton({ community }: { community: Community }) {
  const { userId } = useAuth();
  const { showToast } = useOverlay();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (community.my_role) {
    return <Button title={community.my_role === 'banned' ? 'Banned' : 'Joined'} variant="outline" size="sm" disabled onPress={() => undefined} />;
  }
  return (
    <Button
      title="Join"
      size="sm"
      loading={busy}
      onPress={async () => {
        if (!userId) return;
        setBusy(true);
        try {
          await joinCommunity(community.id, userId);
          queryClient.invalidateQueries({ queryKey: queryKeys.communities });
          showToast(`Welcome to ${community.name}!`);
        } catch (err) {
          showToast(friendlyError(err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/** Full-width list row. */
export function CommunityRow({ community, showJoin = true }: { community: Community; showJoin?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => open(community.id)}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: colors.surface } : null]}
      accessibilityRole="button"
    >
      <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
        <AppText style={styles.emoji}>{community.icon}</AppText>
      </View>
      <View style={styles.meta}>
        <View style={styles.nameRow}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
            {community.name}
          </AppText>
          {community.is_official ? <Icon name="checkmark-circle" size={15} color={colors.link} /> : null}
        </View>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {memberLabel(community.member_count)} · {community.category}
        </AppText>
      </View>
      {showJoin ? <JoinButton community={community} /> : null}
    </Pressable>
  );
}

/** Horizontal carousel tile used on Explore. */
export function CommunityTile({ community }: { community: Community }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={() => open(community.id)}
      style={[styles.tile, shadow(colors.shadow, 1), { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={community.name}
    >
      <View style={styles.tileCover}>
        {community.cover_url ? (
          <Image source={{ uri: community.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        )}
        <View style={[styles.tileEmoji, { backgroundColor: colors.card }]}>
          <AppText style={styles.emoji}>{community.icon}</AppText>
        </View>
      </View>
      <View style={styles.tileBody}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {community.name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {memberLabel(community.member_count)}
        </AppText>
        <View style={styles.tileJoin}>
          <JoinButton community={community} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBox: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24, lineHeight: 30 },
  meta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flexShrink: { flexShrink: 1 },
  tile: { width: 190, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  tileCover: { height: 72 },
  tileEmoji: {
    position: 'absolute',
    left: spacing.md,
    bottom: -20,
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: { padding: spacing.md, paddingTop: spacing.xxl, gap: 2 },
  tileJoin: { marginTop: spacing.sm, alignItems: 'flex-start' },
});
