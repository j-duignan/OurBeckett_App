import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radius } from '@/theme/tokens';

type Props = { uri: string; style?: StyleProp<ViewStyle> };

/** Inline video with native controls. Never autoplays; students tap play. */
export function VideoPlayer({ uri, style }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
  });

  return (
    <View style={[styles.wrap, style]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls fullscreenOptions={{ enable: true }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
});
