import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

type Tone = 'success' | 'warning' | 'danger' | 'info';

interface Props {
  tone: Tone;
  children: ReactNode;
}

export function Banner({ tone, children }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => {
    const palette = {
      success: { background: colors.successMuted, strong: colors.success },
      warning: { background: colors.warningMuted, strong: colors.warning },
      danger: { background: colors.dangerMuted, strong: colors.danger },
      info: { background: colors.accentMuted, strong: colors.text },
    }[tone];
    return StyleSheet.create({
      banner: { backgroundColor: palette.background, borderRadius: 8, padding: 12, gap: 8 },
      text: { color: palette.strong, fontSize: 14 },
    });
  }, [colors, tone]);
  return (
    <View style={styles.banner}>
      {typeof children === 'string' ? <Text style={styles.text}>{children}</Text> : children}
    </View>
  );
}
