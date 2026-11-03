import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { createCommunity, fetchCommunity, updateCommunity } from '@/api/communities';
import { queryKeys } from '@/api/keys';
import { CoverPicker, CoverValue } from '@/components/CoverPicker';
import { FormScaffold } from '@/components/FormScaffold';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { COMMUNITY_CATEGORIES, COMMUNITY_ICONS, CommunityCategory } from '@/lib/constants';
import { uploadPublic } from '@/lib/media';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function CommunityForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const { colors } = useTheme();
  const { userId } = useCurrentUser();
  const { showToast } = useOverlay();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CommunityCategory>('General');
  const [icon, setIcon] = useState(COMMUNITY_ICONS[0]);
  const [cover, setCover] = useState<CoverValue>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const existing = useQuery({ queryKey: queryKeys.community(id ?? ''), queryFn: () => fetchCommunity(id as string), enabled: editing });

  useEffect(() => {
    const c = existing.data;
    if (!c) return;
    if (c.my_role !== 'owner' && c.my_role !== 'moderator') {
      showToast('Only owners and moderators can edit this community', 'error');
      router.back();
      return;
    }
    setName(c.name);
    setDescription(c.description);
    setCategory(c.category);
    setIcon(c.icon);
    setCover(c.cover_url ? { kind: 'remote', url: c.cover_url } : null);
  }, [existing.data, showToast]);

  const submit = async () => {
    const trimmed = name.trim();
    const next = {
      name: trimmed.length < 3 ? 'Names need at least 3 characters.' : trimmed.length > 60 ? 'Keep it under 60 characters.' : null,
    };
    setErrors(next);
    if (next.name) return;

    setSaving(true);
    try {
      const coverUrl = cover?.kind === 'local' ? await uploadPublic('media', userId, cover.media) : cover?.kind === 'remote' ? cover.url : null;
      const input = { name: trimmed, description, category, icon, coverUrl };
      if (editing && id) {
        await updateCommunity(id, input);
        showToast('Community updated');
        router.back();
      } else {
        const newId = await createCommunity(userId, input);
        showToast(`${trimmed} is live! Invite people to join.`);
        router.replace({ pathname: '/community/[id]', params: { id: newId } });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    } catch (err) {
      setErrors({ name: friendlyError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScaffold title={editing ? 'Edit community' : 'New community'} submitLabel={editing ? 'Save' : 'Create'} onSubmit={submit} submitting={saving} loading={editing && existing.isPending}>
      <CoverPicker value={cover} onChange={setCover} label="Add a banner (optional)" />
      <View style={styles.group}>
        <AppText variant="label" tone="secondary" style={styles.groupLabel}>
          Icon
        </AppText>
        <View style={styles.wrap}>
          {COMMUNITY_ICONS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => setIcon(emoji)}
              style={[styles.emojiBox, { backgroundColor: icon === emoji ? colors.primarySoft : colors.surface, borderColor: icon === emoji ? colors.primary : 'transparent' }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: icon === emoji }}
            >
              <AppText style={styles.emoji}>{emoji}</AppText>
            </Pressable>
          ))}
        </View>
      </View>
      <TextField label="Name" placeholder="e.g. Leeds Beckett Climbing" value={name} onChangeText={setName} maxLength={60} error={errors.name} />
      <TextField
        label="Description"
        placeholder="Who is it for and what will you talk about?"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
        showCount
      />
      <View style={styles.group}>
        <AppText variant="label" tone="secondary" style={styles.groupLabel}>
          Category
        </AppText>
        <View style={styles.wrap}>
          {COMMUNITY_CATEGORIES.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </View>
      {!editing ? (
        <AppText variant="caption" tone="muted">
          You’ll be the owner. You can appoint moderators, remove posts and ban members who break the rules.
        </AppText>
      ) : null}
    </FormScaffold>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  groupLabel: { marginLeft: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiBox: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  emoji: { fontSize: 22, lineHeight: 28 },
});
