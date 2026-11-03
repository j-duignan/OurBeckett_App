import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { createEvent, fetchEvent, updateEvent } from '@/api/events';
import { queryKeys } from '@/api/keys';
import { CoverPicker, CoverValue } from '@/components/CoverPicker';
import { DateTimeField } from '@/components/DateTimeField';
import { FormScaffold } from '@/components/FormScaffold';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { IconName } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { EVENT_CATEGORIES, EVENT_CATEGORY_ICONS, EVENT_CATEGORY_LABELS, EventCategory } from '@/lib/constants';
import { uploadPublic } from '@/lib/media';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

function defaultStart(): Date {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(19, 0, 0, 0);
  return d;
}

export default function EventForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const { colors } = useTheme();
  const { userId } = useCurrentUser();
  const { showToast } = useOverlay();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('Social');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState<Date>(defaultStart);
  const [hasEnd, setHasEnd] = useState(false);
  const [endsAt, setEndsAt] = useState<Date>(() => new Date(defaultStart().getTime() + 2 * 60 * 60 * 1000));
  const [cover, setCover] = useState<CoverValue>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const existing = useQuery({ queryKey: queryKeys.event(id ?? ''), queryFn: () => fetchEvent(id as string), enabled: editing });

  useEffect(() => {
    const e = existing.data;
    if (!e) return;
    if (e.creator_id !== userId) {
      showToast('You can only edit your own events', 'error');
      router.back();
      return;
    }
    setTitle(e.title);
    setDescription(e.description);
    setCategory(e.category);
    setLocation(e.location);
    setStartsAt(new Date(e.starts_at));
    setHasEnd(Boolean(e.ends_at));
    if (e.ends_at) setEndsAt(new Date(e.ends_at));
    setCover(e.cover_url ? { kind: 'remote', url: e.cover_url } : null);
  }, [existing.data, userId, showToast]);

  const submit = async () => {
    const next = {
      title: title.trim().length < 3 ? 'Give your event a title (at least 3 characters).' : null,
      location: location.trim().length < 2 ? 'Where is it happening?' : null,
      startsAt: !editing && startsAt.getTime() < Date.now() ? 'Pick a time in the future.' : null,
      endsAt: hasEnd && endsAt.getTime() <= startsAt.getTime() ? 'The end needs to be after the start.' : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    try {
      const coverUrl = cover?.kind === 'local' ? await uploadPublic('media', userId, cover.media) : cover?.kind === 'remote' ? cover.url : null;
      const input = { title, description, category, location, startsAt, endsAt: hasEnd ? endsAt : null, coverUrl };
      if (editing && id) {
        await updateEvent(id, input);
        showToast('Event updated. Attendees have been notified.');
      } else {
        await createEvent(userId, input);
        showToast('Your event is live!');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      router.back();
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScaffold title={editing ? 'Edit event' : 'New event'} submitLabel={editing ? 'Save' : 'Publish'} onSubmit={submit} submitting={saving} loading={editing && existing.isPending}>
      <CoverPicker value={cover} onChange={setCover} />
      <TextField label="Title" placeholder="e.g. Friday Football Social" value={title} onChangeText={setTitle} maxLength={100} error={errors.title} />
      <View style={styles.group}>
        <AppText variant="label" tone="secondary" style={styles.groupLabel}>
          Category
        </AppText>
        <View style={styles.wrap}>
          {EVENT_CATEGORIES.map((c) => (
            <Chip key={c} label={EVENT_CATEGORY_LABELS[c]} icon={EVENT_CATEGORY_ICONS[c] as IconName} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </View>
      <TextField
        label="Location"
        placeholder="e.g. Rose Bowl, City Campus"
        leftIcon="location-outline"
        value={location}
        onChangeText={setLocation}
        maxLength={200}
        error={errors.location}
      />
      <DateTimeField label="Starts" value={startsAt} onChange={setStartsAt} minimumDate={editing ? undefined : new Date()} error={errors.startsAt} />
      <View style={styles.switchRow}>
        <AppText variant="bodyStrong">Add an end time</AppText>
        <Switch value={hasEnd} onValueChange={setHasEnd} trackColor={{ true: colors.primary, false: colors.border }} />
      </View>
      {hasEnd ? <DateTimeField label="Ends" value={endsAt} onChange={setEndsAt} minimumDate={startsAt} error={errors.endsAt} /> : null}
      <TextField
        label="Description"
        placeholder="What should people expect? Anything to bring?"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        showCount
      />
    </FormScaffold>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  groupLabel: { marginLeft: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
});
