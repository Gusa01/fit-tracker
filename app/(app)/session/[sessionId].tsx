import { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getDatabase } from '../../../src/lib/sqlite/db';
import { getCachedRoutineDays, resolveToday } from '../../../src/lib/sqlite/cache';
import { loadCurrentSession } from '../../../src/lib/sessions/currentSessionStorage';
import { useSessionSets } from '../../../src/hooks/useSessionSets';
import { SessionExerciseCard } from '../../../src/components/SessionExerciseCard';
import { PrBanner } from '../../../src/components/PrBanner';
import { AppText, Button, Screen } from '../../../src/components/ui';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function SessionScreen() {
  const { colors } = useTheme();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const {
    dayName,
    exercises,
    loggedSets,
    weightByExercise,
    loading,
    loadForDay,
    logSet,
    completeSession,
    correctSet,
    prBanner,
    dismissPrBanner,
  } = useSessionSets(sessionId);
  const [resolvedDayName, setResolvedDayName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const resolved = resolveToday(getDatabase());
      if (!resolved) return;
      // The session may be for a day other than today's scheduled one (a missed or picked day), and Home
      // records which in the current-session pointer before opening this screen.
      const pointer = await loadCurrentSession();
      const days = getCachedRoutineDays(getDatabase(), resolved.routine.id);
      const day =
        (pointer?.sessionId === sessionId ? days.find((d) => d.id === pointer.dayId) : undefined) ?? resolved.day;
      if (!day) return;
      setResolvedDayName(day.name);
      loadForDay(day.id, day.name);
    })().catch((err) => console.warn('Could not resolve the session day', err));
  }, [loadForDay, sessionId]);

  async function handleFinish() {
    await completeSession();
    router.dismissTo('/(app)/(tabs)');
  }

  if (loading) {
    return (
      <Screen safeBottom>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeBottom>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <AppText variant="title" style={styles.title}>
          {resolvedDayName ?? dayName ?? 'Entrenamiento'}
        </AppText>

        {exercises.map((exercise) => (
          <SessionExerciseCard
            key={exercise.id}
            exercise={exercise}
            initialWeight={weightByExercise[exercise.id] ?? null}
            loggedSets={loggedSets}
            onLogSet={(setIndex, setType, weight, reps, rir) =>
              logSet(exercise.id, setIndex, setType, weight, reps, rir)
            }
            onCorrectSet={correctSet}
          />
        ))}

        <Button
          title="Terminar entrenamiento"
          onPress={() =>
            Alert.alert('Terminar entrenamiento', '¿Marcar esta sesión como completada?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Terminar', onPress: handleFinish },
            ])
          }
        />
      </ScrollView>
      <PrBanner banner={prBanner} onDismiss={dismissPrBanner} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, marginBottom: 8 },
});
