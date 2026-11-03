import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EVENT_CATEGORY_LABELS } from '@/lib/constants';
import { eventDateBadge, formatEventDate } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, spacing } from '@/theme/tokens';
import type { EventItem } from '@/types/models';

import { AppText } from './ui/AppText';
import { Icon } from './ui/Icon';
import { PressableScale } from './ui/PressableScale';

function open(id: string) {
  router.push({ pathname: '/event/[id]', params: { id } });
}

function DateBadge({ iso }: { iso: string }) {
  const { colors } = useTheme();
  const { day, month } = eventDateBadge(iso);
  return (
    <View style={[styles.dateBadge, { backgroundColor: colors.card }]}>
      <AppText variant="tiny" tone="accent">
        {month}
      </AppText>
      <AppText variant="h3" style={styles.day}>
        {day}
      </AppText>
    </View>
  );
}

function Cover({ event, height }: { event: EventItem; height: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height }}>
      {event.cover_url ? (
        <Image source={{ uri: event.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <View style={styles.badgePos}>
        <DateBadge iso={event.starts_at} />
      </View>
      {event.going_by_me ? (
        <View style={[styles.goingPill, { backgroundColor: colors.success }]}>
          <Icon name="checkmark" size={12} color="#FFFFFF" />
          <AppText variant="tiny" style={styles.white}>
            Going
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** Carousel tile (Explore). */
export function EventTile({ event }: { event: EventItem }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={() => open(event.id)}
      style={[styles.tile, shadow(colors.shadow, 1), { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={event.title}
    >
      <Cover event={event} height={110} />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {event.title}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {formatEventDate(event.starts_at)}
        </AppText>
        <View style={styles.metaRow}>
          <Icon name="people-outline" size={13} color={colors.textMuted} />
          <AppText variant="caption" tone="muted">
            {event.attendee_count} going
          </AppText>
        </View>
      </View>
    </PressableScale>
  );
}

/** Full-width card (Events screen). */
export function EventCard({ event }: { event: EventItem }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={() => open(event.id)}
      scaleTo={0.98}
      style={[styles.card, shadow(colors.shadow, 1), { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={event.title}
    >
      <Cover event={event} height={140} />
      <View style={styles.body}>
        <AppText variant="tiny" tone="link">
          {EVENT_CATEGORY_LABELS[event.category].toUpperCase()}
        </AppText>
        <AppText variant="h3" numberOfLines={2}>
          {event.title}
        </AppText>
        <View style={styles.metaRow}>
          <Icon name="time-outline" size={14} color={colors.textMuted} />
          <AppText variant="caption" tone="secondary">
            {formatEventDate(event.starts_at)}
          </AppText>
        </View>
        <View style={styles.metaRow}>
          <Icon name="location-outline" size={14} color={colors.textMuted} />
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
            {event.location}
          </AppText>
        </View>
        <View style={styles.metaRow}>
          <Icon name="people-outline" size={14} color={colors.textMuted} />
          <AppText variant="caption" tone="secondary">
            {event.attendee_count} going · by {event.creator_display_name}
          </AppText>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: { width: 230, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  body: { padding: spacing.md, gap: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgePos: { position: 'absolute', left: spacing.md, top: spacing.md },
  dateBadge: { borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs, alignItems: 'center', minWidth: 46 },
  day: { lineHeight: 20 },
  goingPill: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  white: { color: '#FFFFFF' },
  flex: { flex: 1 },
});
