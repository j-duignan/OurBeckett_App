import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/keys';
import { isUsernameAvailable, updateProfile } from '@/api/profiles';
import { FormScaffold } from '@/components/FormScaffold';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { Campus, CAMPUSES, INTERESTS } from '@/lib/constants';
import { pickFromLibrary, PickedMedia, takePhoto, uploadPublic } from '@/lib/media';
import { friendlyError, normaliseUsername, validateDisplayName, validateUsername } from '@/lib/validation';
import { useAuth, useCurrentUser } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function EditProfile() {
  const { colors } = useTheme();
  const { userId, profile } = useCurrentUser();
  const { refreshProfile } = useAuth();
  const { showSheet, showToast } = useOverlay();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [course, setCourse] = useState(profile.course ?? '');
  const [campus, setCampus] = useState<Campus | null>(profile.campus);
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [avatar, setAvatar] = useState<PickedMedia | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const chooseAvatar = () =>
    showSheet({
      title: 'Profile photo',
      options: [
        {
          label: 'Choose from library',
          icon: 'images-outline',
          onPress: async () => {
            try {
              const [picked] = await pickFromLibrary({ crop: [1, 1] });
              if (picked) {
                setAvatar(picked);
                setRemoveAvatar(false);
              }
            } catch (err) {
              showToast(friendlyError(err), 'error');
            }
          },
        },
        {
          label: 'Take a photo',
          icon: 'camera-outline',
          onPress: async () => {
            try {
              const photo = await takePhoto([1, 1]);
              if (photo) {
                setAvatar(photo);
                setRemoveAvatar(false);
              }
            } catch (err) {
              showToast(friendlyError(err), 'error');
            }
          },
        },
        ...(profile.avatar_url || avatar
          ? [
              {
                label: 'Remove photo',
                icon: 'trash-outline' as const,
                destructive: true,
                onPress: () => {
                  setAvatar(null);
                  setRemoveAvatar(true);
                },
              },
            ]
          : []),
      ],
    });

  const toggleInterest = (interest: string) =>
    setInterests((current) =>
      current.includes(interest) ? current.filter((i) => i !== interest) : current.length >= 15 ? current : [...current, interest],
    );

  const submit = async () => {
    const cleanUsername = normaliseUsername(username);
    const next: Record<string, string | null> = {
      displayName: validateDisplayName(displayName),
      username: validateUsername(cleanUsername),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    try {
      if (cleanUsername !== profile.username && !(await isUsernameAvailable(cleanUsername))) {
        setErrors({ username: 'That username is already taken.' });
        return;
      }
      const avatarUrl = avatar ? await uploadPublic('avatars', userId, avatar) : removeAvatar ? null : profile.avatar_url;
      await updateProfile(userId, {
        display_name: displayName.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        course: course.trim() || null,
        campus,
        interests,
        avatar_url: avatarUrl,
      });
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: queryKeys.profileById(userId) });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts });
      showToast('Profile updated');
      router.back();
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScaffold title="Edit profile" submitLabel="Save" onSubmit={submit} submitting={saving}>
      <Pressable onPress={chooseAvatar} style={styles.avatar} accessibilityRole="button" accessibilityLabel="Change profile photo">
        {avatar ? (
          <Image source={{ uri: avatar.uri }} style={styles.avatarImage} contentFit="cover" />
        ) : (
          <Avatar uri={removeAvatar ? null : profile.avatar_url} name={displayName || profile.display_name} size={96} />
        )}
        <AppText variant="label" tone="link" style={styles.changePhoto}>
          Change photo
        </AppText>
      </Pressable>
      <TextField label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={50} error={errors.displayName} />
      <TextField
        label="Username"
        leftIcon="at"
        value={username}
        onChangeText={(v) => setUsername(normaliseUsername(v))}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        error={errors.username}
      />
      <TextField label="Bio" value={bio} onChangeText={setBio} multiline maxLength={300} showCount placeholder="Tell people a bit about yourself" />
      <TextField label="Course (optional)" leftIcon="school-outline" value={course} onChangeText={setCourse} maxLength={100} placeholder="e.g. BA Journalism" />
      <View style={styles.group}>
        <AppText variant="label" tone="secondary" style={styles.groupLabel}>
          Campus (optional)
        </AppText>
        <View style={styles.wrap}>
          {CAMPUSES.map((c) => (
            <Chip key={c} label={c} icon="location-outline" selected={campus === c} onPress={() => setCampus(campus === c ? null : c)} />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <AppText variant="label" tone="secondary" style={styles.groupLabel}>
          Interests ({interests.length}/15)
        </AppText>
        <View style={styles.wrap}>
          {INTERESTS.map((interest) => (
            <Chip key={interest} label={interest} small selected={interests.includes(interest)} onPress={() => toggleInterest(interest)} />
          ))}
        </View>
      </View>
      <View style={[styles.privacy, { backgroundColor: colors.surface }]}>
        <AppText variant="caption" tone="muted">
          Your student email is private and never shown on your profile.
        </AppText>
      </View>
    </FormScaffold>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', gap: spacing.sm },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  changePhoto: { marginTop: spacing.xs },
  group: { gap: spacing.sm },
  groupLabel: { marginLeft: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  privacy: { padding: spacing.md, borderRadius: 12 },
});
