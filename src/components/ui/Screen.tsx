import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}

export function Screen({ children, scroll = false, padded = true }: Props) {
  const { colors } = useTheme();
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
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, padded && styles.padded]}>
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.container, padded && styles.padded]}>{children}</View>;
}
