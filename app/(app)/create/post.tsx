import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { fetchUserCommunities } from '@/api/communities';
import { queryKeys } from '@/api/keys';
import { createPost } from '@/api/posts';
import { MediaItem, MediaPickerStrip } from '@/components/MediaPickerStrip';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { MAX_POST_IMAGES } from '@/lib/constants';
import { PickedMedia, pickFromLibrary, takePhoto, uploadManyPublic } from '@/lib/media';
import { uuid } from '@/lib/uuid';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

const MAX_LENGTH = 2000;

type Picked = PickedMedia & { key: string };

export default function CreatePost() {
  const params = useLocalSearchParams<{ communityId?: string; text?: string }>();
  const { colors } = useTheme();
  const { userId, profile } = useCurrentUser();
  const { showToast } = useOverlay();
  const queryClient = useQueryClient();

  const [body, setBody] = useState(params.text ?? '');
  const [media, setMedia] = useState<Picked[]>([]);
  const [communityId, setCommunityId] = useState<string | null>(params.communityId ?? null);
  const [posting, setPosting] = useState(false);

  const communities = useQuery({ queryKey: queryKeys.myCommunities, queryFn: () => fetchUserCommunities(userId) });
  const postable = (communities.data ?? []).filter((c) => c.my_role && c.my_role !== 'banned');

  const hasVideo = media.some((m) => m.kind === 'video');
  const canPost = (body.trim().length > 0 || media.length > 0) && !posting;

  const addFromLibrary = async () => {
    try {
      const picked = await pickFromLibrary({
        allowVideo: media.length === 0,
        multiple: true,
        max: MAX_POST_IMAGES - media.length,
      });
      if (!picked.length) return;
      const video = picked.find((p) => p.kind === 'video');
      if (video) {
        setMedia([{ ...video, key: uuid() }]);
        if (picked.length > 1) showToast('Posts can have one video or up to 4 photos, so we kept the video.', 'info');
        return;
      }
      setMedia((current) => [...current, ...picked.map((p) => ({ ...p, key: uuid() }))].slice(0, MAX_POST_IMAGES));
    } catch (err) {
      showToast(friendlyError(err), 'error');
    }
  };

  const addFromCamera = async () => {
    try {
      const photo = await takePhoto();
      if (photo) setMedia((current) => [...current, { ...photo, key: uuid() }].slice(0, MAX_POST_IMAGES));
    } catch (err) {
      showToast(friendlyError(err), 'error');
    }
  };

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      const urls = await uploadManyPublic(userId, media);
      await createPost({
        authorId: userId,
        body,
        mediaUrls: urls,
        mediaType: media.length ? (hasVideo ? 'video' : 'image') : null,
        communityId,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.posts });
      queryClient.invalidateQueries({ queryKey: queryKeys.communities });
      showToast('Posted!');
      router.back();
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setPosting(false);
    }
  };

  const items: MediaItem[] = media.map((m) => ({ key: m.key, uri: m.uri, kind: m.kind }));

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title="New post"
        close
        right={<Button title="Post" size="sm" variant="gradient" onPress={submit} disabled={!canPost} loading={posting} />}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.row}>
            <Avatar uri={profile.avatar_url} name={profile.display_name} size={42} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{profile.display_name}</AppText>
              <AppText variant="caption" tone="muted">
                Posting to {communityId ? postable.find((c) => c.id === communityId)?.name ?? 'community' : 'everyone at Leeds Beckett'}
              </AppText>
            </View>
          </View>

          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What’s happening on campus? Use #hashtags and @mentions."
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus
            maxLength={MAX_LENGTH}
            style={[styles.input, typography.h3, { color: colors.text, fontWeight: '400' }]}
          />

          {items.length ? (
            <MediaPickerStrip
              items={items}
              max={hasVideo ? 1 : MAX_POST_IMAGES}
              onRemove={(key) => setMedia((current) => current.filter((m) => m.key !== key))}
              onAdd={hasVideo ? undefined : addFromLibrary}
              size={110}
            />
          ) : null}

          {postable.length ? (
            <View style={styles.destinations}>
              <AppText variant="label" tone="muted">
                POST TO
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="Everyone" icon="globe-outline" selected={!communityId} onPress={() => setCommunityId(null)} />
                {postable.map((c) => (
                  <Chip key={c.id} label={`${c.icon} ${c.name}`} selected={communityId === c.id} onPress={() => setCommunityId(c.id)} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.toolbar, { borderTopColor: colors.border }]}>
          <IconButton
            icon="images-outline"
            color={colors.link}
            accessibilityLabel="Add photos or a video"
            onPress={addFromLibrary}
            disabled={hasVideo || media.length >= MAX_POST_IMAGES}
          />
          <IconButton
            icon="camera-outline"
            color={colors.link}
            accessibilityLabel="Take a photo"
            onPress={addFromCamera}
            disabled={hasVideo || media.length >= MAX_POST_IMAGES}
          />
          <View style={styles.flex} />
          <AppText variant="caption" tone={body.length > MAX_LENGTH - 100 ? 'danger' : 'muted'}>
            {body.length}/{MAX_LENGTH}
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  input: { minHeight: 140, textAlignVertical: 'top' },
  destinations: { gap: spacing.sm },
  chips: { gap: spacing.sm },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.lg,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
