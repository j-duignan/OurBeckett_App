import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ExpoLinking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteEvent, fetchEvent, fetchEventAttendees, setAttending } from '@/api/events';
import { queryKeys } from '@/api/keys';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Icon, IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useReport } from '@/hooks/useModeration';
import { EVENT_CATEGORY_LABELS } from '@/lib/constants';
import { formatEventRange } from '@/lib/time';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { SheetOption, useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

function InfoRow({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.infoRow} accessibilityRole={onPress ? 'button' : 'text'}>
      <View style={[styles.infoIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={20} color={colors.link} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone={onPress ? 'link' : 'muted'}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {onPress ? <Icon name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useCurrentUser();
  const { showSheet, showToast } = useOverlay();
  const report = useReport();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const query = useQuery({ queryKey: queryKeys.event(id), queryFn: () => fetchEvent(id) });
  const attendees = useQuery({ queryKey: queryKeys.eventAttendees(id), queryFn: () => fetchEventAttendees(id, 12) });

  if (query.isPending || query.isError || !query.data) {
    return (
      <Screen>
        <Header title="Event" />
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <EmptyState icon="calendar-outline" title="Event not found" message="It may have been cancelled." />
        )}
      </Screen>
    );
  }

  const event = query.data;
  const isMine = event.creator_id === userId;
  const isPast = new Date(event.ends_at ?? event.starts_at).getTime() < Date.now();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.events });
  };

  const toggleGoing = async () => {
    setBusy(true);
    try {
      await setAttending(event.id, userId, !event.going_by_me);
      invalidate();
      if (!event.going_by_me) showToast('You’re going! We’ll let you know if anything changes.');
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openMaps = () => {
    const q = encodeURIComponent(`${event.location}, Leeds`);
    const url = Platform.OS === 'ios' ? `http://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
    Linking.openURL(url).catch(() => showToast('Couldn’t open maps', 'error'));
  };

  const share = () => {
    const link = ExpoLinking.createURL(`/event/${event.id}`);
    Share.share({ message: `${event.title}\n${formatEventRange(event.starts_at, event.ends_at)} · ${event.location}\n${link}` }).catch(() => undefined);
  };

  const remove = () =>
    Alert.alert('Delete event?', 'Everyone who RSVP’d will lose it from their plans.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(event.id);
            invalidate();
            showToast('Event deleted');
            router.back();
          } catch (err) {
            showToast(friendlyError(err), 'error');
          }
        },
      },
    ]);

  const openMenu = () => {
    const options: SheetOption[] = [{ label: 'Share event', icon: 'share-outline', onPress: share }];
    if (isMine) {
      options.push({ label: 'Edit event', icon: 'create-outline', onPress: () => router.push({ pathname: '/create/event', params: { id: event.id } }) });
      options.push({ label: 'Delete event', icon: 'trash-outline', destructive: true, onPress: remove });
    } else {
      options.push({ label: 'Report event', icon: 'flag-outline', destructive: true, onPress: () => report('event', event.id, 'event') });
    }
    showSheet({ options });
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View style={styles.cover}>
          {event.cover_url ? (
            <Image source={{ uri: event.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          )}
          <View style={[styles.coverActions, { paddingTop: insets.top + spacing.xs }]}>
            <IconButton icon="chevron-back" color="#FFFFFF" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.coverButton} />
            <IconButton icon="ellipsis-horizontal" color="#FFFFFF" accessibilityLabel="Event options" onPress={openMenu} style={styles.coverButton} />
          </View>
        </View>

        <View style={styles.body}>
          <AppText variant="label" tone="link">
            {EVENT_CATEGORY_LABELS[event.category].toUpperCase()}
          </AppText>
          <AppText variant="h1">{event.title}</AppText>

          <View style={styles.infoList}>
            <InfoRow icon="time-outline" title={formatEventRange(event.starts_at, event.ends_at)} subtitle={isPast ? 'This event has ended' : undefined} />
            <InfoRow icon="location-outline" title={event.location} subtitle="Open in maps" onPress={openMaps} />
            <InfoRow
              icon="person-outline"
              title={event.creator_display_name}
              subtitle={`Organiser · @${event.creator_username}`}
              onPress={() => router.push({ pathname: '/user/[username]', params: { username: event.creator_username } })}
            />
          </View>

          <View style={[styles.attendeesCard, { backgroundColor: colors.surface }]}>
            <View style={styles.avatarStack}>
              {(attendees.data ?? []).slice(0, 6).map((a, i) => (
                <View key={a.id} style={[styles.stacked, { marginLeft: i === 0 ? 0 : -10, borderColor: colors.surface }]}>
                  <Avatar uri={a.avatar_url} name={a.display_name} size={32} />
                </View>
              ))}
            </View>
            <AppText variant="bodyStrong" style={styles.flex}>
              {event.attendee_count} {event.attendee_count === 1 ? 'person' : 'people'} going
            </AppText>
          </View>

          {event.description ? (
            <>
              <AppText variant="h3" style={styles.aboutTitle}>
                About
              </AppText>
              <AppText tone="secondary">{event.description}</AppText>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button title="Share" icon="share-outline" variant="outline" onPress={share} />
        {isMine ? (
          <Button
            title="Edit event"
            icon="create-outline"
            variant="secondary"
            style={styles.flex}
            onPress={() => router.push({ pathname: '/create/event', params: { id: event.id } })}
          />
        ) : (
          <Button
            title={event.going_by_me ? 'You’re going' : isPast ? 'Event ended' : 'I’m going'}
            icon={event.going_by_me ? 'checkmark-circle' : 'add-circle-outline'}
            variant={event.going_by_me ? 'secondary' : 'gradient'}
            onPress={toggleGoing}
            loading={busy}
            disabled={isPast && !event.going_by_me}
            style={styles.flex}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cover: { height: 240 },
  coverActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  coverButton: { backgroundColor: 'rgba(0,0,0,0.3)' },
  body: { padding: spacing.lg, gap: spacing.xs },
  infoList: { marginTop: spacing.lg, gap: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  attendeesCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, marginTop: spacing.xl },
  avatarStack: { flexDirection: 'row' },
  stacked: { borderWidth: 2, borderRadius: 18 },
  aboutTitle: { marginTop: spacing.xl, marginBottom: spacing.xs },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
