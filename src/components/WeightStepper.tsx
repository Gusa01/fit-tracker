import { useMemo } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { AppText } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

interface WeightStepperProps {
  value: string;
  onChange: (value: string) => void;
}

const STEPS = [5, 2.5, 1.25];

export function WeightStepper({ value, onChange }: WeightStepperProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function bump(delta: number) {
    const current = value === '' ? 0 : Number(value);
    if (Number.isNaN(current)) return;
    const next = Math.max(0, current + delta);
    onChange(String(next));
  }

  return (
    <View style={styles.row}>
      {[...STEPS].reverse().map((step) => (
        <Pressable key={`minus-${step}`} style={styles.button} onPress={() => bump(-step)}>
          <AppText style={styles.buttonText}>-{step}</AppText>
        </Pressable>
      ))}
      <TextInput style={styles.input} keyboardType="numeric" value={value} onChangeText={onChange} />
      {STEPS.map((step) => (
        <Pressable key={`plus-${step}`} style={styles.button} onPress={() => bump(step)}>
          <AppText style={styles.buttonText}>+{step}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    button: {
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceMuted,
      borderRadius: 6,
    },
    buttonText: { fontSize: 12, fontWeight: '600' },
    input: {
      width: 60,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      color: c.text,
      borderRadius: 8,
      padding: 8,
      textAlign: 'center',
    },
  });
}
