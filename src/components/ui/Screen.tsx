import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  surface?: boolean;
};

export function Screen({ children, edges = ['top'], style, surface }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: surface ? colors.surface : colors.background }]}>
      <View style={[styles.root, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
