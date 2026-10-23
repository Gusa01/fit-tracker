import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Reserve the bottom safe area; for screens outside the tab bar, which already handles it. */
  safeBottom?: boolean;
}

export function Screen({ children, scroll = false, padded = true, safeBottom = false }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        padded: { padding: 16 },
        content: { gap: 12 },
      }),
    [colors]
  );

  if (scroll) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          padded && styles.padded,
          safeBottom && { paddingBottom: insets.bottom },
        ]}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={[styles.container, padded && styles.padded, safeBottom && { paddingBottom: insets.bottom }]}>
      {children}
    </View>
  );
}
