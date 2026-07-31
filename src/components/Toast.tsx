import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

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

const CONFIG: Record<ToastType, { icon: string; border: string }> = {
  success: { icon: '✅', border: '#34c759' },
  error: { icon: '⚠️', border: '#ff3b30' },
  info: { icon: 'ℹ️', border: '#0a84ff' },
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
          <View style={[styles.toast, { borderLeftColor: CONFIG[toast.type].border }]}>
            <Text style={styles.icon}>{CONFIG[toast.type].icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
              {toast.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={3}>{toast.subtitle}</Text>
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
    top: Platform.OS === 'ios' ? 56 : 30,
    left: 16,
    right: 16,
    zIndex: 999,
    elevation: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  icon: { fontSize: 22, marginRight: 12 },
  message: { color: '#fff', fontSize: 15, fontWeight: '700' },
  subtitle: { color: '#a1a1a6', fontSize: 13, marginTop: 2 },
});
