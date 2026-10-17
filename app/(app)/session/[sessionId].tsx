import { useEffect, useMemo, useState } from 'react';
import { Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getDatabase } from '../../../src/lib/sqlite/db';
import { resolveToday } from '../../../src/lib/sqlite/cache';
import { useSessionSets } from '../../../src/hooks/useSessionSets';
import { SessionExerciseCard } from '../../../src/components/SessionExerciseCard';
import { PrBanner } from '../../../src/components/PrBanner';
import { AppText, Screen } from '../../../src/components/ui';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { ColorTokens } from '../../../src/theme/colors';

export default function SessionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
    const resolved = resolveToday(getDatabase());
    if (!resolved || !resolved.day) return;
    setResolvedDayName(resolved.day.name);
    loadForDay(resolved.day.id, resolved.day.name);
  }, [loadForDay]);

  async function handleFinish() {
    await completeSession();
    router.replace('/(app)/(tabs)' as any);
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
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

        <Pressable
          accessibilityRole="button"
          style={styles.finishButton}
          onPress={() =>
            Alert.alert('Terminar entrenamiento', '¿Marcar esta sesión como completada?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Terminar', onPress: handleFinish },
            ])
          }
        >
          <Text style={styles.finishButtonText}>Terminar entrenamiento</Text>
        </Pressable>
      </ScrollView>
      <PrBanner banner={prBanner} onDismiss={dismissPrBanner} />
    </Screen>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 16, gap: 12 },
    title: { fontSize: 22, marginBottom: 8 },
    finishButton: {
      backgroundColor: c.success,
      borderRadius: 8,
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
    finishButtonText: { color: c.onAccent, fontWeight: '700' },
  });
}
