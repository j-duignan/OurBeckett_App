import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { fetchPopularCommunities, joinCommunity } from '@/api/communities';
import { updateProfile } from '@/api/profiles';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { Campus, CAMPUSES, INTERESTS } from '@/lib/constants';
import { pickFromLibrary, PickedMedia, uploadPublic } from '@/lib/media';
import { friendlyError } from '@/lib/validation';
import { useCurrentUser, useAuth } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const STEPS = ['About you', 'Your interests', 'Find your communities'] as const;

export default function Onboarding() {
  const { colors } = useTheme();
  const { userId, profile } = useCurrentUser();
  const { refreshProfile, signOut } = useAuth();
  const { showToast } = useOverlay();

  const [step, setStep] = useState(0);
  const [avatar, setAvatar] = useState<PickedMedia | null>(null);
  const [bio, setBio] = useState(profile.bio);
  const [course, setCourse] = useState(profile.course ?? '');
  const [campus, setCampus] = useState<Campus | null>(profile.campus);
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const communities = useQuery({
    queryKey: ['onboarding-communities'],
    queryFn: () => fetchPopularCommunities(12),
    enabled: step === 2,
  });

  const chooseAvatar = async () => {
    try {
      const [picked] = await pickFromLibrary({ crop: [1, 1] });
      if (picked) setAvatar(picked);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((i) => i !== interest)
        : current.length >= 15
          ? current
          : [...current, interest],
    );
  };

  const toggleCommunity = (id: string) => {
    setJoined((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finish = async () => {
    setSaving(true);
    try {
      const avatarUrl = avatar ? await uploadPublic('avatars', userId, avatar) : profile.avatar_url;
      await Promise.all(Array.from(joined).map((id) => joinCommunity(id, userId)));
      await updateProfile(userId, {
        bio: bio.trim(),
        course: course.trim() || null,
        campus,
        interests,
        avatar_url: avatarUrl,
        onboarded: true,
      });
      await refreshProfile();
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        {step > 0 ? (
          <Pressable onPress={() => setStep(step - 1)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <Pressable onPress={signOut} hitSlop={12} accessibilityRole="button">
            <AppText variant="label" tone="muted">
              Sign out
            </AppText>
          </Pressable>
        )}
        <View style={styles.progress}>
          {STEPS.map((label, i) => (
            <View key={label} style={[styles.progressBar, { backgroundColor: i <= step ? colors.primary : colors.border }]} />
          ))}
        </View>
        <Pressable onPress={next} hitSlop={12} accessibilityRole="button" disabled={saving}>
          <AppText variant="label" tone="muted">
            Skip
          </AppText>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="label" tone="link">
            STEP {step + 1} OF {STEPS.length}
          </AppText>
          <AppText variant="h1" style={styles.title}>
            {step === 0 ? `Hey ${profile.display_name.split(' ')[0]} 👋` : STEPS[step]}
          </AppText>

          {step === 0 ? (
            <View style={styles.section}>
              <AppText tone="secondary">Add a photo and a little about yourself so people know who you are. You can change this later.</AppText>
              <Pressable onPress={chooseAvatar} style={styles.avatarPicker} accessibilityRole="button" accessibilityLabel="Choose a profile photo">
                {avatar ? (
                  <Image source={{ uri: avatar.uri }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Avatar uri={profile.avatar_url} name={profile.display_name} size={112} />
                )}
                <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                  <Icon name="camera" size={16} color="#FFFFFF" />
                </View>
              </Pressable>
              <TextField
                label="Bio"
                placeholder="2nd year Computer Science. Probably in the library. Ask me about F1."
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={300}
                showCount
              />
              <TextField
                label="Course (optional)"
                placeholder="e.g. BSc Computer Science"
                leftIcon="school-outline"
                value={course}
                onChangeText={setCourse}
                maxLength={100}
              />
              <View style={styles.gapSm}>
                <AppText variant="label" tone="secondary">
                  Campus (optional)
                </AppText>
                <View style={styles.wrap}>
                  {CAMPUSES.map((c) => (
                    <Chip key={c} label={c} icon="location-outline" selected={campus === c} onPress={() => setCampus(campus === c ? null : c)} />
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.section}>
              <AppText tone="secondary">
                Pick a few things you’re into. We’ll use them to suggest people, posts and communities. ({interests.length} selected)
              </AppText>
              <View style={styles.wrap}>
                {INTERESTS.map((interest) => (
                  <Chip key={interest} label={interest} selected={interests.includes(interest)} onPress={() => toggleInterest(interest)} />
                ))}
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.section}>
              <AppText tone="secondary">Join a few to fill your feed. You can always leave later.</AppText>
              {communities.isPending ? (
                <LoadingState />
              ) : communities.isError ? (
                <ErrorState error={communities.error} onRetry={() => communities.refetch()} />
              ) : (
                communities.data.map((c) => {
                  const selected = joined.has(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => toggleCommunity(c.id)}
                      style={[
                        styles.communityRow,
                        { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.card },
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      <AppText style={styles.emoji}>{c.icon}</AppText>
                      <View style={styles.flex}>
                        <AppText variant="bodyStrong">{c.name}</AppText>
                        <AppText variant="caption" tone="muted" numberOfLines={1}>
                          {c.description}
                        </AppText>
                      </View>
                      <Icon name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={26} color={selected ? colors.primary : colors.textMuted} />
                    </Pressable>
                  );
                })
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button
          title={step === STEPS.length - 1 ? 'Start exploring' : 'Continue'}
          iconRight={step === STEPS.length - 1 ? 'sparkles' : 'arrow-forward'}
          variant="gradient"
          size="lg"
          fullWidth
          loading={saving}
          onPress={next}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  content: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  title: { marginTop: spacing.xs },
  section: { marginTop: spacing.lg, gap: spacing.lg },
  avatarPicker: { alignSelf: 'center', marginVertical: spacing.sm },
  avatarImage: { width: 112, height: 112, borderRadius: 56 },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapSm: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  emoji: { fontSize: 26, lineHeight: 32 },
  footer: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.md, paddingTop: spacing.sm },
});
