import { useMemo } from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { ColorTokens } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'label';

interface Props extends TextProps {
  variant?: Variant;
  color?: keyof ColorTokens;
}

export function AppText({ variant = 'body', color, style, ...rest }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: { fontSize: 20, fontWeight: '700', color: colors.text },
        heading: { fontSize: 16, fontWeight: '700', color: colors.text },
        body: { fontSize: 15, fontWeight: '400', color: colors.text },
        muted: { fontSize: 13, fontWeight: '400', color: colors.textMuted },
        label: { fontSize: 14, fontWeight: '600', color: colors.text },
      }),
    [colors]
  );
  return <Text {...rest} style={[styles[variant], color ? { color: colors[color] } : null, style]} />;
}
