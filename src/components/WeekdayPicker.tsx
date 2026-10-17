import { View, StyleSheet } from 'react-native';
import { Weekday } from '../lib/routines/types';
import { Chip } from './ui';

interface WeekdayPickerProps {
  selected: Weekday[];
  onChange: (weekdays: Weekday[]) => void;
}

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'L' },
  { key: 'tue', label: 'M' },
  { key: 'wed', label: 'X' },
  { key: 'thu', label: 'J' },
  { key: 'fri', label: 'V' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'D' },
];

export function WeekdayPicker({ selected, onChange }: WeekdayPickerProps) {
  function toggle(day: Weekday) {
    onChange(selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day]);
  }

  return (
    <View style={styles.row}>
      {WEEKDAYS.map(({ key, label }) => (
        <Chip key={key} label={label} selected={selected.includes(key)} onPress={() => toggle(key)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
});
