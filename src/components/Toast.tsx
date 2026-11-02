import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S, T, shadow } from '../constants/design';
import { alpha } from '../utils/colors';

type ToastType = 'success' | 'error' | 'info';

interface ToastData {
  message: string;
  subtitle?: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, subtitle?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

const CONFIG: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { icon: 'checkmark-circle', color: C.success },
  error: { icon: 'alert-circle', color: C.danger },
  info: { icon: 'information-circle', color: C.brand2 },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success', subtitle?: string) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);

    setToast({ message, subtitle, type });

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -150, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setToast(null));
    }, 3200);
  }, [translateY, opacity]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrapper, { transform: [{ translateY }], opacity }]}
        >
          <View style={[styles.toast, shadow('#000', 10)]}>
            <View style={[styles.iconWrap, { backgroundColor: alpha(CONFIG[toast.type].color, 0.16) }]}>
              <Ionicons name={CONFIG[toast.type].icon} size={22} color={CONFIG[toast.type].color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.bodyStrong} numberOfLines={2}>{toast.message}</Text>
              {toast.subtitle ? (
                <Text style={[T.caption, { marginTop: 2 }]} numberOfLines={3}>{toast.subtitle}</Text>
              ) : null}
            </View>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: S.lg,
    right: S.lg,
    zIndex: 999,
    elevation: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceAlt,
    borderRadius: R.xl,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    borderWidth: 1,
    borderColor: C.borderStrong,
    gap: S.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
