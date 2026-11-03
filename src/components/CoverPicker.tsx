import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { pickFromLibrary, PickedMedia } from '@/lib/media';
import { friendlyError } from '@/lib/validation';
import { useOverlay } from '@/providers/OverlayProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';
import { Icon } from './ui/Icon';

export type CoverValue = { kind: 'remote'; url: string } | { kind: 'local'; media: PickedMedia } | null;

type Props = { value: CoverValue; onChange: (value: CoverValue) => void; label?: string };

/** Optional 16:9 cover image used by events and communities. */
export function CoverPicker({ value, onChange, label = 'Add a cover photo' }: Props) {
  const { colors } = useTheme();
  const { showToast } = useOverlay();
  const uri = value?.kind === 'remote' ? value.url : value?.kind === 'local' ? value.media.uri : null;

  const pick = async () => {
    try {
      const [media] = await pickFromLibrary({ crop: [16, 9] });
      if (media) onChange({ kind: 'local', media });
    } catch (err) {
      showToast(friendlyError(err), 'error');
    }
  };

  return (
    <Pressable
      onPress={pick}
      style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
      accessibilityRole="button"
      accessibilityLabel={uri ? 'Change cover photo' : label}
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <Pressable onPress={() => onChange(null)} style={styles.remove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove cover photo">
            <Icon name="close" size={16} color="#FFFFFF" />
          </Pressable>
        </>
      ) : (
        <View style={styles.empty}>
          <Icon name="image-outline" size={28} color={colors.textMuted} />
          <AppText variant="label" tone="muted">
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { aspectRatio: 16 / 9, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  remove: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
