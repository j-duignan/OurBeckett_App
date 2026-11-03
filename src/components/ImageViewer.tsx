import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './ui/AppText';
import { IconButton } from './ui/IconButton';

type Props = {
  images: string[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
};

/** Full-screen swipeable photo viewer. */
export function ImageViewer({ images, initialIndex, visible, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {images.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width, height }} contentFit="contain" transition={100} />
          ))}
        </ScrollView>
        <View style={[styles.top, { top: insets.top + 8 }]}>
          <IconButton icon="close" color="#FFFFFF" onPress={onClose} accessibilityLabel="Close photo" />
          {images.length > 1 ? (
            <AppText variant="label" style={styles.counter}>
              {index + 1} / {images.length}
            </AppText>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', left: 8, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: '#FFFFFF' },
});
