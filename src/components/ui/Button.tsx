import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ title, onPress, variant = 'primary', disabled = false, loading = false }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const contentColor = variant === 'primary' || variant === 'danger' ? colors.onAccent : colors.accent;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          minHeight: 48,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          flexDirection: 'row',
          gap: 8,
          backgroundColor: variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : 'transparent',
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.accent,
        },
        disabled: { opacity: 0.5 },
        text: { color: contentColor, fontSize: 15, fontWeight: '600' },
      }),
    [colors, variant, contentColor]
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[styles.button, inactive && styles.disabled]}
    >
      {loading && <ActivityIndicator color={contentColor} />}
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}
