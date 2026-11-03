import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';
import { Icon } from './ui/Icon';

export type MediaItem = { key: string; uri: string; kind: 'image' | 'video' };

type Props = {
  items: MediaItem[];
  onRemove: (key: string) => void;
  onAdd?: () => void;
  max: number;
  size?: number;
};

/** Thumbnails of selected (or already uploaded) media with remove buttons. */
export function MediaPickerStrip({ items, onRemove, onAdd, max, size = 96 }: Props) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item) => (
        <View key={item.key} style={[styles.thumb, { width: size, height: size, backgroundColor: colors.surface }]}>
          {item.kind === 'image' ? (
            <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.video, { backgroundColor: colors.text }]}>
              <Icon name="videocam" size={28} color={colors.background} />
              <AppText variant="tiny" style={{ color: colors.background }}>
                Video
              </AppText>
            </View>
          )}
          <Pressable
            onPress={() => onRemove(item.key)}
            style={styles.remove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove"
          >
            <Icon name="close" size={14} color="#FFFFFF" />
          </Pressable>
        </View>
      ))}
      {onAdd && items.length < max ? (
        <Pressable
          onPress={onAdd}
          style={[styles.thumb, styles.add, { width: size, height: size, borderColor: colors.borderStrong }]}
          accessibilityRole="button"
          accessibilityLabel="Add photos"
        >
          <Icon name="add" size={26} color={colors.textMuted} />
          <AppText variant="tiny" tone="muted">
            {items.length}/{max}
          </AppText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  thumb: { borderRadius: radius.md, overflow: 'hidden' },
  video: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  add: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
