import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        chip: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
          minHeight: 36,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: selected ? colors.accent : colors.surfaceMuted,
        },
        text: { fontSize: 14, fontWeight: '600', color: selected ? colors.onAccent : colors.text },
      }),
    [colors, selected]
  );
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={styles.chip}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}
