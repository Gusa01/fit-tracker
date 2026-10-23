import { useEffect, useMemo, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, Switch, ActivityIndicator, Alert } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { router } from 'expo-router';
import { useAuthSession } from '../hooks/useAuthSession';
import { useRoutine } from '../hooks/useRoutine';
import { useRoutineDays } from '../hooks/useRoutineDays';
import { useRoutines } from '../hooks/useRoutines';
import { supabase } from '../lib/supabase';
import { createRoutine, updateRoutine, createDay, reorderDays, softDeleteDay } from '../lib/routines/mutations';
import { DayReorderList } from './DayReorderList';
import { DayCard } from './DayCard';
import { AppText, Button, Screen } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

interface RoutineBuilderProps {
  initialRoutineId?: string;
}

export function RoutineBuilder({ initialRoutineId }: RoutineBuilderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuthSession();
  const userId = session?.user.id;

  const [routineId, setRoutineId] = useState<string | undefined>(initialRoutineId);
  const { routine, isLoading: routineLoading, refetch: refetchRoutine } = useRoutine(routineId);
  const { days, refetch: refetchDays } = useRoutineDays(routineId);
  const { routines: allRoutines } = useRoutines(userId);

  const [name, setName] = useState('');
  const [usesTopSetBackoff, setUsesTopSetBackoff] = useState(false);
  const [suggestedDurationWeeks, setSuggestedDurationWeeks] = useState('');
  const [nextRoutineId, setNextRoutineId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [reorderingDays, setReorderingDays] = useState(false);

  useEffect(() => {
    if (routine && !initialized) {
      setName(routine.name);
      setUsesTopSetBackoff(routine.uses_top_set_backoff);
      setSuggestedDurationWeeks(
        routine.suggested_duration_weeks !== null ? String(routine.suggested_duration_weeks) : ''
      );
      setNextRoutineId(routine.next_routine_id);
      setInitialized(true);
    }
  }, [routine, initialized]);

  async function ensureRoutine(): Promise<string | null> {
    if (routineId) return routineId;
    if (!userId) return null;
    if (!name.trim()) {
      setNameError('Ponele un nombre a la rutina primero.');
      return null;
    }
    setNameError(null);
    const created = await createRoutine(supabase, userId, {
      name: name.trim(),
      usesTopSetBackoff,
      suggestedDurationWeeks: suggestedDurationWeeks ? Number(suggestedDurationWeeks) : null,
      nextRoutineId,
    });
    setInitialized(true);
    setRoutineId(created.id);
    return created.id;
  }

  async function handleNameBlur() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Ponele un nombre a la rutina.');
      return;
    }
    setNameError(null);
    if (routineId) await updateRoutine(supabase, routineId, { name: trimmed });
  }

  async function handleToggleTopSet(value: boolean) {
    setUsesTopSetBackoff(value);
    if (routineId) await updateRoutine(supabase, routineId, { usesTopSetBackoff: value });
  }

  async function handleDurationBlur() {
    if (!routineId) return;
    await updateRoutine(supabase, routineId, {
      suggestedDurationWeeks: suggestedDurationWeeks ? Number(suggestedDurationWeeks) : null,
    });
  }

  async function handleSelectNextRoutine(id: string) {
    const next = nextRoutineId === id ? null : id;
    setNextRoutineId(next);
    if (routineId) await updateRoutine(supabase, routineId, { nextRoutineId: next });
  }

  async function handleChanged() {
    await refetchRoutine();
    await refetchDays();
  }

  async function handleAddDay() {
    const id = await ensureRoutine();
    if (!id) return;
    await createDay(supabase, id, { name: `Día ${days.length + 1}`, isRestDay: false });
    await refetchDays();
  }

  async function handleReorderDays(orderedIds: string[]) {
    try {
      await reorderDays(supabase, orderedIds);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo reordenar los días.');
    }
    await refetchDays();
  }

  async function handleDeleteDay(dayId: string) {
    await softDeleteDay(supabase, dayId);
    await refetchDays();
  }

  if (initialRoutineId && (routineLoading || !routine)) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const weekdaySchedule = routine?.weekday_schedule ?? {};
  const pickableRoutines = allRoutines.filter((r) => r.id !== routineId);

  return (
    <NestableScrollContainer style={styles.container} contentContainerStyle={styles.content}>
      <AppText variant="label" style={styles.label}>
        Nombre
      </AppText>
      <TextInput
        style={styles.input}
        placeholder="Ej: Fuerza 5x5, Push/Pull/Legs..."
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        onBlur={handleNameBlur}
      />
      {nameError && <AppText color="danger">{nameError}</AppText>}

      <View style={styles.switchRow}>
        <AppText>Usa top set / back-off</AppText>
        <Switch
          value={usesTopSetBackoff}
          onValueChange={handleToggleTopSet}
          trackColor={{ false: colors.surfaceMuted, true: colors.accent }}
          thumbColor={colors.onDark}
        />
      </View>

      <AppText variant="label" style={styles.label}>
        Duración sugerida (semanas, opcional)
      </AppText>
      <TextInput
        style={styles.input}
        placeholder="Ej: 8"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        value={suggestedDurationWeeks}
        onChangeText={setSuggestedDurationWeeks}
        onBlur={handleDurationBlur}
      />

      {pickableRoutines.length > 0 && (
        <View style={styles.pickerSection}>
          <AppText variant="label">Rutina siguiente (opcional)</AppText>
          {pickableRoutines.map((r) => (
            <Pressable
              key={r.id}
              style={[styles.pickerRow, nextRoutineId === r.id && styles.pickerRowSelected]}
              onPress={() => handleSelectNextRoutine(r.id)}
            >
              <AppText>{r.name}</AppText>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.daysHeader}>
        <AppText variant="title">Días</AppText>
        {days.length > 1 && (
          <Button
            title={reorderingDays ? 'Listo' : 'Reordenar'}
            variant="ghost"
            onPress={() => setReorderingDays((current) => !current)}
          />
        )}
      </View>
      {reorderingDays ? (
        <>
          <AppText variant="muted">Mantené presionado un día y arrastralo.</AppText>
          <DayReorderList days={days} weekdaySchedule={weekdaySchedule} onReorder={handleReorderDays} />
        </>
      ) : (
        <>
          {days.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              routineId={routineId as string}
              weekdaySchedule={weekdaySchedule}
              onChanged={handleChanged}
              onDelete={handleDeleteDay}
            />
          ))}

          <Button title="+ Nuevo día" variant="secondary" onPress={handleAddDay} />
        </>
      )}

      <View style={styles.doneButton}>
        <Button title="Listo" onPress={() => router.back()} />
      </View>
    </NestableScrollContainer>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 12 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      color: c.text,
      borderRadius: 8,
      padding: 12,
    },
    label: { marginTop: 4 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pickerSection: { gap: 6 },
    pickerRow: { borderWidth: 1, borderColor: c.border, borderRadius: 6, padding: 10 },
    pickerRowSelected: { borderColor: c.accent, backgroundColor: c.surfaceMuted },
    daysHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    doneButton: { marginTop: 8 },
  });
}
