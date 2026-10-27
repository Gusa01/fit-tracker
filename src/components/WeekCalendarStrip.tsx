import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeekCalendarDay } from '../lib/home/weekCalendar';
import { ColorTokens } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';

interface WeekCalendarStripProps {
  days: WeekCalendarDay[];
}

export function WeekCalendarStrip({ days }: WeekCalendarStripProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {days.map((day) => (
        <View key={day.weekday} style={[styles.cell, day.isToday && styles.cellToday]}>
          <Text style={[styles.label, day.isToday && styles.labelToday]}>{day.label}</Text>
          {day.isRestDay ? (
            // One word that never fits a seventh of a phone: shrink it instead of breaking it mid-word.
            <Text
              style={[styles.dayName, day.isToday && styles.labelToday]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              Descanso
            </Text>
          ) : (
            <Text style={[styles.dayName, day.isToday && styles.labelToday]} numberOfLines={2}>
              {day.dayName}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: 4 },
    cell: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 2,
      alignItems: 'center',
      gap: 4,
      minHeight: 60,
    },
    cellToday: { backgroundColor: c.accent, borderColor: c.accent },
    label: { fontSize: 12, fontWeight: '700', color: c.text },
    labelToday: { color: c.onAccent },
    dayName: { fontSize: 10, color: c.textMuted, textAlign: 'center' },
  });
}
