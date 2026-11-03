import * as Haptics from 'expo-haptics';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Icon, IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, spacing } from '@/theme/tokens';

export type SheetOption = {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
};

type SheetConfig = { title?: string; message?: string; options: SheetOption[] };
type ToastKind = 'success' | 'error' | 'info';
type ToastState = { id: number; message: string; kind: ToastKind } | null;

type OverlayContextValue = {
  showSheet: (config: SheetConfig) => void;
  showToast: (message: string, kind?: ToastKind) => void;
};

const OverlayContext = createContext<OverlayContextValue>({
  showSheet: () => undefined,
  showToast: () => undefined,
});

export function OverlayProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<SheetConfig | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const pendingAction = useRef<(() => void) | null>(null);

  const showSheet = useCallback(
    (config: SheetConfig) => {
      Haptics.selectionAsync().catch(() => undefined);
      setSheet(config);
      sheetAnim.setValue(0);
      Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4, speed: 18 }).start();
    },
    [sheetAnim],
  );

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      setSheet(null);
      const action = pendingAction.current;
      pendingAction.current = null;
      // Run after the modal is gone so actions can open alerts/other sheets.
      if (action) setTimeout(action, 50);
    });
  }, [sheetAnim]);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    setToast({ id: Date.now(), message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    toastAnim.setValue(0);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, bounciness: 6 }).start();
    const timer = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
    }, 2600);
    return () => clearTimeout(timer);
  }, [toast, toastAnim]);

  const value = useMemo(() => ({ showSheet, showToast }), [showSheet, showToast]);

  const toastIcon: Record<ToastKind, IconName> = {
    success: 'checkmark-circle',
    error: 'alert-circle',
    info: 'information-circle',
  };
  const toastColor: Record<ToastKind, string> = {
    success: colors.success,
    error: colors.danger,
    info: colors.link,
  };

  return (
    <OverlayContext.Provider value={value}>
      {children}

      <Modal visible={Boolean(sheet)} transparent animationType="none" onRequestClose={closeSheet} statusBarTranslucent>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: sheetAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} accessibilityLabel="Close menu" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            shadow(colors.shadow, 3),
            {
              backgroundColor: colors.elevated,
              paddingBottom: insets.bottom + spacing.md,
              transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
          {sheet?.title ? (
            <AppText variant="h3" align="center" style={styles.sheetTitle}>
              {sheet.title}
            </AppText>
          ) : null}
          {sheet?.message ? (
            <AppText variant="caption" tone="muted" align="center" style={styles.sheetMessage}>
              {sheet.message}
            </AppText>
          ) : null}
          <ScrollView style={styles.options} bounces={false}>
            {sheet?.options.map((option) => (
              <Pressable
                key={option.label}
                onPress={() => {
                  pendingAction.current = option.onPress;
                  closeSheet();
                }}
                style={({ pressed }) => [styles.option, pressed ? { backgroundColor: colors.surface } : null]}
                accessibilityRole="button"
              >
                {option.icon ? (
                  <Icon name={option.icon} size={22} color={option.destructive ? colors.danger : colors.text} />
                ) : null}
                <AppText variant="bodyStrong" tone={option.destructive ? 'danger' : 'default'}>
                  {option.label}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={closeSheet}
            style={({ pressed }) => [styles.cancel, { backgroundColor: pressed ? colors.border : colors.surface }]}
            accessibilityRole="button"
          >
            <AppText variant="bodyStrong">Cancel</AppText>
          </Pressable>
        </Animated.View>
      </Modal>

      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            shadow(colors.shadow, 2),
            {
              top: insets.top + spacing.sm,
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
            },
          ]}
        >
          <Icon name={toastIcon[toast.kind]} size={20} color={toastColor[toast.kind]} />
          <AppText variant="callout" style={styles.toastText}>
            {toast.message}
          </AppText>
        </Animated.View>
      ) : null}
    </OverlayContext.Provider>
  );
}

export function useOverlay(): OverlayContextValue {
  return useContext(OverlayContext);
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '80%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: spacing.md },
  sheetTitle: { marginBottom: spacing.xs },
  sheetMessage: { marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  options: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  cancel: {
    marginTop: spacing.sm,
    height: 50,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toastText: { flex: 1 },
});
