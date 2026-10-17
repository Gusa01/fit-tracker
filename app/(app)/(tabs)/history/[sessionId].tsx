import { useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSessionDetail } from '../../../../src/hooks/useSessionHistory';
import { groupSessionSets } from '../../../../src/lib/history/logic';
import { formatSessionTitle, formatSetLabel, formatSetValues } from '../../../../src/lib/history/format';
import { HistoryExercise } from '../../../../src/lib/history/types';
import { LoggedSet } from '../../../../src/lib/sessions/types';
import { SetEditor } from '../../../../src/components/SetEditor';
import { AppText, Banner, Button, Card, Screen } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { ColorTokens } from '../../../../src/theme/colors';

export default function SessionHistoryDetail() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { detail, isLoading, error, refetch, correctSet } = useSessionDetail(sessionId);
  const [editing, setEditing] = useState<{ set: LoggedSet; exercise: HistoryExercise } | null>(null);
  const [corrected, setCorrected] = useState(false);

  const groups = useMemo(() => (detail ? groupSessionSets(detail.sets, detail.exercises) : []), [detail]);

  if (isLoading && !detail) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <View style={styles.centered}>
          <AppText variant="muted" style={styles.message}>
            {error ?? 'Conectate para ver tu historial'}
          </AppText>
          <View style={styles.retry}>
            <Button title="Reintentar" onPress={refetch} />
          </View>
        </View>
      </Screen>
    );
  }

  async function finish(change: Parameters<typeof correctSet>[1]) {
    if (!editing) return;
    await correctSet(editing.set.id, change);
    setEditing(null);
    setCorrected(true);
  }

  return (
    <Screen padded={false}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
          <AppText style={styles.back}>←</AppText>
          <AppText variant="title" style={styles.title}>
            {formatSessionTitle(detail.sessionDate, detail.dayName)}
          </AppText>
        </Pressable>

        {error ? (
          <Pressable onPress={refetch}>
            <Banner tone="danger">No se pudo actualizar. Tocá para reintentar.</Banner>
          </Pressable>
        ) : null}

        {corrected && (
          <Banner tone="success">
            Corregido. El peso sugerido no cambia; si quedó mal, ajustalo en tu próxima sesión.
          </Banner>
        )}

        {groups.length === 0 && (
          <AppText variant="muted" style={styles.message}>
            Esta sesión no tiene series.
          </AppText>
        )}

        {groups.map(({ exercise, sets }) => (
          <Card key={exercise.id} style={styles.card}>
            <AppText variant="heading">{exercise.exercise_name}</AppText>
            {sets.map((set) => (
              <View key={set.id} style={styles.setRow}>
                <AppText variant="muted" style={styles.setLabel}>
                  {formatSetLabel(set)}
                </AppText>
                <AppText variant="label" style={styles.setValues}>
                  {formatSetValues(set, exercise.rep_unit)}
                </AppText>
                <Pressable
                  onPress={() => setEditing({ set, exercise })}
                  hitSlop={12}
                  accessibilityLabel="Corregir serie"
                >
                  <AppText style={styles.editIcon}>✎</AppText>
                </Pressable>
              </View>
            ))}
          </Card>
        ))}

        <SetEditor
          set={editing?.set ?? null}
          exercise={editing?.exercise ?? null}
          onClose={() => setEditing(null)}
          onSave={finish}
          onDelete={() => finish({ kind: 'delete' })}
        />
      </ScrollView>
    </Screen>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 16, gap: 12 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    message: { textAlign: 'center' },
    retry: { marginTop: 16 },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
    back: { fontSize: 22, color: c.accent },
    title: { flexShrink: 1 },
    card: { padding: 12, gap: 6 },
    setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    setLabel: { width: 84 },
    setValues: { flex: 1 },
    editIcon: { fontSize: 18, paddingHorizontal: 4 },
  });
}
