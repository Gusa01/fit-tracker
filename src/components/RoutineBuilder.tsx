import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, Pressable, ScrollView, StyleSheet, Switch, ActivityIndicator } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { router, Stack } from 'expo-router';
import { useAuthSession } from '../hooks/useAuthSession';
import { useRoutine } from '../hooks/useRoutine';
import { useRoutineDays } from '../hooks/useRoutineDays';
import { useRoutines } from '../hooks/useRoutines';
import { SaveStatus, useSaveTracker } from '../hooks/useSaveTracker';
import { supabase } from '../lib/supabase';
import { createRoutine, updateRoutine, createDay, reorderDays, softDeleteDay } from '../lib/routines/mutations';
import { DayReorderList } from './DayReorderList';
import { DayCard } from './DayCard';
import { ScrollIntoViewContext } from './ScrollIntoViewContext';
import { AppText, Button, Screen, useToast } from './ui';
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
  const { routine, refetch: refetchRoutine } = useRoutine(routineId);
  const { days, refetch: refetchDays } = useRoutineDays(routineId);
  const { routines: allRoutines } = useRoutines(userId);

  const [name, setName] = useState('');
  const [usesTopSetBackoff, setUsesTopSetBackoff] = useState(false);
  const [suggestedDurationWeeks, setSuggestedDurationWeeks] = useState('');
  const [nextRoutineId, setNextRoutineId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [reorderingDays, setReorderingDays] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const { status: saveStatus, track, settle } = useSaveTracker();
  const toast = useToast();

  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null!);
  const scrollIntoView = useCallback((target: View) => {
    const scroll = scrollRef.current as unknown as View | null;
    const content = contentRef.current;
    if (!scroll || !content) return;
    scroll.measureInWindow((_x, scrollTop) => {
      target.measureInWindow((_tx, targetTop) => {
        if (targetTop >= scrollTop) return;
        target.measureLayout(content, (_lx, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 16) }));
      });
    });
  }, []);

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
    const creating = createRoutine(supabase, userId, {
      name: name.trim(),
      usesTopSetBackoff,
      suggestedDurationWeeks: suggestedDurationWeeks ? Number(suggestedDurationWeeks) : null,
      nextRoutineId,
    });
    if (!(await track(creating))) return null;
    const created = await creating;
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
    if (routineId && trimmed !== routine?.name) await track(updateRoutine(supabase, routineId, { name: trimmed }));
  }

  async function handleToggleTopSet(value: boolean) {
    setUsesTopSetBackoff(value);
    if (routineId) await track(updateRoutine(supabase, routineId, { usesTopSetBackoff: value }));
  }

  async function handleDurationBlur() {
    if (!routineId) return;
    await track(
      updateRoutine(supabase, routineId, {
        suggestedDurationWeeks: suggestedDurationWeeks ? Number(suggestedDurationWeeks) : null,
      })
    );
  }

  async function handleSelectNextRoutine(id: string) {
    const next = nextRoutineId === id ? null : id;
    setNextRoutineId(next);
    if (routineId) await track(updateRoutine(supabase, routineId, { nextRoutineId: next }));
  }

  async function handleDone() {
    setFinishing(true);
    const saved = await settle();
    setFinishing(false);
    // A save that failed stays on screen so the change isn't lost without the user noticing.
    if (!saved) return;
    if (routineId) toast('Rutina guardada');
    router.back();
  }

  async function handleChanged() {
    await refetchRoutine();
    await refetchDays();
  }

  async function handleAddDay() {
    const id = await ensureRoutine();
    if (!id) return;
    await track(createDay(supabase, id, { name: `Día ${days.length + 1}`, isRestDay: false }));
    await refetchDays();
  }

  async function handleReorderDays(orderedIds: string[]) {
    await track(reorderDays(supabase, orderedIds));
    await refetchDays();
  }

  async function handleDeleteDay(dayId: string) {
    await track(softDeleteDay(supabase, dayId));
    await refetchDays();
  }

  // Only the first load shows the spinner: swapping the editor for it on every refetch remounts the whole
  // screen, which flashes and throws the scroll position back to the top.
  if (initialRoutineId && !routine) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const weekdaySchedule = routine?.weekday_schedule ?? {};
  const pickableRoutines = allRoutines.filter((r) => r.id !== routineId);

  return (
    <ScrollIntoViewContext.Provider value={scrollIntoView}>
      <NestableScrollContainer
        // The library types this ref as gesture-handler's ScrollView component; the instance is React Native's ScrollView.
        ref={scrollRef as never}
        innerViewRef={contentRef}
        style={styles.container}
        contentContainerStyle={styles.content}
      >
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
                track={track}
                onChanged={handleChanged}
                onDelete={handleDeleteDay}
              />
            ))}

            <Button title="+ Nuevo día" variant="secondary" onPress={handleAddDay} />
          </>
        )}

        <View style={styles.doneButton}>
          <Button title="Listo" onPress={handleDone} loading={finishing} />
        </View>
      </NestableScrollContainer>
      <Stack.Screen options={{ headerRight: () => <SaveStatusLabel status={saveStatus} /> }} />
    </ScrollIntoViewContext.Provider>
  );
}

const SAVE_STATUS_TEXT: Record<SaveStatus, string | null> = {
  idle: null,
  saving: 'Guardando...',
  saved: 'Cambios guardados',
  error: 'Sin guardar',
};

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  const text = SAVE_STATUS_TEXT[status];
  if (!text) return null;
  return (
    <AppText variant="muted" color={status === 'error' ? 'danger' : undefined} accessibilityLiveRegion="polite">
      {text}
    </AppText>
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
