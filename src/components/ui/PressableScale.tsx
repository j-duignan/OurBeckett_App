import { ReactNode, useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far to shrink while pressed. */
  scaleTo?: number;
};

/** Pressable with a subtle spring "squish" used across the app. */
export function PressableScale({ children, style, scaleTo = 0.96, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        if (!disabled) animate(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        animate(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
