import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';
import { useRealtime } from '@/providers/RealtimeProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { shadow, spacing } from '@/theme/tokens';

import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Icon, IconName } from './ui/Icon';
import { PressableScale } from './ui/PressableScale';

const ICONS: Record<string, { active: IconName; inactive: IconName; label: string }> = {
  index: { active: 'home', inactive: 'home-outline', label: 'Home' },
  explore: { active: 'compass', inactive: 'compass-outline', label: 'Explore' },
  messages: { active: 'chatbubbles', inactive: 'chatbubbles-outline', label: 'Messages' },
  profile: { active: 'person', inactive: 'person-outline', label: 'Profile' },
};

function TabItem({
  focused,
  routeName,
  onPress,
  onLongPress,
  badge,
}: {
  focused: boolean;
  routeName: string;
  onPress: () => void;
  onLongPress: () => void;
  badge?: number;
}) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: focused ? 1 : 0, useNativeDriver: true, bounciness: 10, speed: 16 }).start();
  }, [focused, anim]);

  const config = ICONS[routeName];
  if (!config) return null;
  const color = focused ? colors.text : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={config.label}
    >
      <Animated.View style={{ transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
        {routeName === 'profile' && profile ? (
          <View style={[styles.avatarRing, { borderColor: focused ? colors.text : 'transparent' }]}>
            <Avatar uri={profile.avatar_url} name={profile.display_name} size={26} />
          </View>
        ) : (
          <Icon name={focused ? config.active : config.inactive} size={26} color={color} />
        )}
        {badge ? (
          <View style={styles.badge}>
            <Badge count={badge} />
          </View>
        ) : null}
      </Animated.View>
      <Animated.View style={[styles.indicator, { backgroundColor: colors.primary, opacity: anim, transform: [{ scaleX: anim }] }]} />
    </Pressable>
  );
}

export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { unreadMessages } = useRealtime();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;

        if (route.name === 'new') {
          return (
            <View key={route.key} style={styles.item}>
              <PressableScale
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
                  router.push('/create');
                }}
                scaleTo={0.9}
                style={[styles.create, shadow(colors.primary, 2)]}
                accessibilityRole="button"
                accessibilityLabel="Create"
              >
                <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createGradient}>
                  <Icon name="add" size={30} color="#FFFFFF" />
                </LinearGradient>
              </PressableScale>
            </View>
          );
        }

        // Same contract as the built-in tab bar: emitting tabPress on the
        // focused tab lets screens scroll to top (useScrollToTop).
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync().catch(() => undefined);
            navigateToTab(route.key);
          }
        };
        const onLongPress = () => {
          emitter.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TabItem
            key={route.key}
            focused={focused}
            routeName={route.name}
            onPress={onPress}
            onLongPress={onLongPress}
            badge={route.name === 'messages' ? unreadMessages : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48 },
  indicator: { width: 16, height: 3, borderRadius: 2, marginTop: 5 },
  badge: { position: 'absolute', top: -4, right: -10 },
  avatarRing: { borderWidth: 2, borderRadius: 16, padding: 1 },
  create: { width: 52, height: 40, borderRadius: 16 },
  createGradient: { flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
