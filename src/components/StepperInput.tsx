import { useMemo } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { AppText } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

interface StepperInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function StepperInput({ value, onChange, min = 0, max = 99, step = 1 }: StepperInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function bump(delta: number) {
    const current = value === '' ? 0 : Number(value);
    if (Number.isNaN(current)) return;
    const next = Math.min(max, Math.max(min, current + delta));
    onChange(String(next));
  }

  return (
    <View style={styles.row}>
      <Pressable style={styles.button} onPress={() => bump(-step)}>
        <AppText style={styles.buttonText}>−</AppText>
      </Pressable>
      <TextInput style={styles.input} keyboardType="number-pad" value={value} onChangeText={onChange} />
      <Pressable style={styles.button} onPress={() => bump(step)}>
        <AppText style={styles.buttonText}>+</AppText>
      </Pressable>
    </View>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    button: {
      width: 44,
      height: 44,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceMuted,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { fontSize: 20, fontWeight: '600' },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      color: c.text,
      borderRadius: 8,
      padding: 10,
      textAlign: 'center',
    },
  });
}
