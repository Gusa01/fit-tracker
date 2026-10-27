import { useMemo, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, Switch, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { updateDay, setDayWeekdays } from '../lib/routines/mutations';
import { RoutineDay, Weekday } from '../lib/routines/types';
import { WeekdayPicker } from './WeekdayPicker';
import { DayExercisesSection } from './DayExercisesSection';
import { AppText, Card } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

const ALL_WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface DayCardProps {
  day: RoutineDay;
  routineId: string;
  weekdaySchedule: Record<string, unknown>;
  // Reports each save to the editor's "Guardando... / Cambios guardados" status.
  track: (save: Promise<unknown>) => Promise<boolean>;
  onChanged: () => void;
  onDelete: (dayId: string) => void;
}

export function DayCard({ day, routineId, weekdaySchedule, track, onChanged, onDelete }: DayCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState(day.name);
  const [isRestDay, setIsRestDay] = useState(day.is_rest_day);
  const [weekdays, setWeekdays] = useState<Weekday[]>(ALL_WEEKDAYS.filter((w) => weekdaySchedule[w] === day.id));

  async function handleNameBlur() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(day.name);
      return;
    }
    if (trimmed === day.name) return;
    await track(updateDay(supabase, day.id, { name: trimmed }));
    onChanged();
  }

  async function handleToggleRest(value: boolean) {
    setIsRestDay(value);
    const saved = await track(updateDay(supabase, day.id, { isRestDay: value }));
    if (saved && value && weekdays.length > 0) {
      setWeekdays([]);
      await track(setDayWeekdays(supabase, routineId, day.id, []));
    }
    onChanged();
  }

  async function handleWeekdaysChange(next: Weekday[]) {
    setWeekdays(next);
    await track(setDayWeekdays(supabase, routineId, day.id, next));
    onChanged();
  }

  function handleDeletePress() {
    Alert.alert('Eliminar día', `¿Eliminar "${day.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(day.id) },
    ]);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <TextInput
          style={styles.dayNameInput}
          placeholder="Ej: Día A, Empuje, Piernas..."
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          onBlur={handleNameBlur}
        />
        <View style={styles.headerActions}>
          <Pressable onPress={handleDeletePress}>
            <AppText color="danger" style={styles.deleteButton}>
              Eliminar
            </AppText>
          </Pressable>
        </View>
      </View>

      <View style={styles.switchRow}>
        <AppText>Día de descanso</AppText>
        <Switch
          value={isRestDay}
          onValueChange={handleToggleRest}
          trackColor={{ false: colors.surfaceMuted, true: colors.accent }}
          thumbColor={colors.onDark}
        />
      </View>

      {!isRestDay && (
        <>
          <AppText variant="label" style={styles.label}>
            Días de la semana (opcional)
          </AppText>
          <WeekdayPicker selected={weekdays} onChange={handleWeekdaysChange} />
          <DayExercisesSection dayId={day.id} />
        </>
      )}
    </Card>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    card: { gap: 10, padding: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dayNameInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      color: c.text,
      borderRadius: 8,
      padding: 10,
      fontWeight: '600',
    },
    headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    deleteButton: { fontWeight: '600' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { marginTop: 4 },
  });
}
