import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

type ToastKind = 'success' | 'error';

interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
}

const VISIBLE_MS = 2000;
// Clears the tab bar, so the message never covers the tab the user is about to tap.
const BOTTOM_OFFSET = 72;

const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

// A short message at the bottom of the screen that confirms a save, or says it failed, and goes away on its own.
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const nextId = useRef(0);

  const show = useCallback((text: string, kind: ToastKind = 'success') => {
    nextId.current += 1;
    setMessage({ id: nextId.current, text, kind });
  }, []);

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMessage((current) => (current?.id === message.id ? null : current));
      });
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, opacity]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        toast: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + BOTTOM_OFFSET,
          borderRadius: 8,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
        },
        success: { backgroundColor: colors.text },
        error: { backgroundColor: colors.danger },
        text: { fontSize: 15, fontWeight: '600' },
        successText: { color: colors.background },
        errorText: { color: colors.onAccent },
      }),
    [colors, insets.bottom]
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.toast, message.kind === 'error' ? styles.error : styles.success, { opacity }]}
        >
          <Text style={[styles.text, message.kind === 'error' ? styles.errorText : styles.successText]}>
            {message.text}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
