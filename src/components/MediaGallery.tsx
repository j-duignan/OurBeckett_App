import { Image } from 'expo-image';
import { memo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { ImageViewer } from './ImageViewer';
import { VideoPlayer } from './VideoPlayer';

type Props = {
  urls: string[];
  type: 'image' | 'video' | null;
  /** Called on a double tap (used for "double-tap to like"). */
  onDoubleTap?: () => void;
};

export const MediaGallery = memo(function MediaGallery({ urls, type, onDoubleTap }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!urls.length || !type) return null;

  if (type === 'video') {
    return <VideoPlayer uri={urls[0]} style={styles.media} />;
  }

  const handlePress = (index: number) => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTap.current = 0;
      onDoubleTap?.();
      return;
    }
    lastTap.current = now;
    singleTapTimer.current = setTimeout(() => setViewerIndex(index), 280);
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={styles.media}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={urls.length > 1}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ borderRadius: radius.lg }}
        >
          {urls.map((uri, index) => (
            <Pressable key={uri} onPress={() => handlePress(index)} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${index + 1} of ${urls.length}`}>
              <Image
                source={{ uri }}
                style={{ width, aspectRatio: urls.length > 1 ? 1 : 4 / 5, backgroundColor: colors.skeleton }}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                recyclingKey={uri}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={{ aspectRatio: 1, backgroundColor: colors.skeleton, borderRadius: radius.lg }} />
      )}
      {urls.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {urls.map((uri, i) => (
            <View key={uri} style={[styles.dot, { backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.5)', width: i === page ? 16 : 6 }]} />
          ))}
        </View>
      ) : null}
      {viewerIndex !== null ? (
        <ImageViewer images={urls} initialIndex={viewerIndex} visible onClose={() => setViewerIndex(null)} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  media: { marginTop: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  dots: { position: 'absolute', bottom: spacing.md, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { height: 6, borderRadius: 3 },
});
