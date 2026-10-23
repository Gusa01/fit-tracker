import { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { CachedRoutineExercise } from '../lib/sqlite/cache';
import { LoggedSet, SetType } from '../lib/sessions/types';
import { buildPrescribedSets, formatTargetScheme } from '../lib/sessions/prescribedSets';
import { WeightStepper } from './WeightStepper';
import { StepperInput } from './StepperInput';
import { SetEditor } from './SetEditor';
import { SetCorrection } from '../lib/history/types';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { exerciseImageUrl } from '../lib/exercises/images';
import { AppText, Button, Card, Chip } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

interface SessionExerciseCardProps {
  exercise: CachedRoutineExercise;
  initialWeight: number | null;
  loggedSets: LoggedSet[];
  onLogSet: (setIndex: number, setType: SetType, weight: number, reps: number, rir: number | null) => Promise<void>;
  onCorrectSet: (setId: string, change: SetCorrection) => Promise<void>;
}

const RIR_OPTIONS = [0, 1, 2, 3, 4];

const SET_TYPE_LABELS: Record<SetType, string> = {
  top_set: 'Top set',
  back_off: 'Back-off',
  working: 'Serie de trabajo',
  warmup: 'Entrada en calor',
};

export function SessionExerciseCard({
  exercise,
  initialWeight,
  loggedSets,
  onLogSet,
  onCorrectSet,
}: SessionExerciseCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [weight, setWeight] = useState(initialWeight !== null ? String(initialWeight) : '0');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState<number | null>(exercise.rir_min);
  const [saving, setSaving] = useState(false);
  const [editingSet, setEditingSet] = useState<LoggedSet | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const imageUrl = exerciseImageUrl(exercise.image_path ?? null);

  const prescribed = buildPrescribedSets(exercise);
  const showRir = exercise.rir_min !== null;
  const unitLabel = exercise.rep_unit === 'seconds' ? 'Segundos' : 'Reps';

  const loggedByIndex = new Map(
    loggedSets.filter((s) => s.routine_exercise_id === exercise.id).map((s) => [s.set_index, s])
  );
  const nextSet = prescribed.find((set) => !loggedByIndex.has(set.setIndex));

  async function handleLogNext() {
    if (!nextSet || !weight || !reps) return;
    setSaving(true);
    try {
      await onLogSet(nextSet.setIndex, nextSet.setType, Number(weight), Number(reps), showRir ? rir : null);
      // Reps/weight/RIR usually repeat across sets of the same exercise — leave them as-is
      // so the next set is a single tap to confirm instead of retyping the same values.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Pressable disabled={!imageUrl} onPress={() => setViewerOpen(true)} accessibilityLabel="Ver ilustración">
          <ExerciseThumbnail
            imagePath={exercise.image_path ?? null}
            muscle={exercise.primary_muscle ?? (exercise.muscle_group === 'core' ? 'core' : '')}
            size={48}
          />
        </Pressable>
        <View style={styles.headerText}>
          <AppText variant="heading">{exercise.exercise_name}</AppText>
          <AppText variant="muted">{formatTargetScheme(exercise)}</AppText>
        </View>
      </View>

      {imageUrl && (
        <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
          <Pressable style={styles.viewerBackdrop} onPress={() => setViewerOpen(false)}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.viewerImage}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
            <Text style={styles.viewerCaption}>Ilustración: wger.de (Creative Commons)</Text>
          </Pressable>
        </Modal>
      )}

      {prescribed.map((set) => {
        const logged = loggedByIndex.get(set.setIndex);
        if (!logged) return null;
        return (
          <View key={set.setIndex} style={styles.loggedRow}>
            <Text style={[styles.loggedText, styles.loggedTextFlex]}>
              ✓ Serie {set.setIndex} ({SET_TYPE_LABELS[set.setType]}): {logged.weight}kg × {logged.reps}
              {exercise.rep_unit === 'seconds' ? 's' : ' reps'}
              {logged.rir !== null ? ` · RIR ${logged.rir}` : ''}
            </Text>
            <Pressable onPress={() => setEditingSet(logged)} hitSlop={12} accessibilityLabel="Corregir serie">
              <Text style={styles.editIcon}>✎</Text>
            </Pressable>
          </View>
        );
      })}

      {nextSet ? (
        <>
          <AppText variant="heading" style={styles.activeSetTitle}>
            Serie {nextSet.setIndex} de {prescribed.length} — {SET_TYPE_LABELS[nextSet.setType]}
          </AppText>

          <AppText variant="label" style={styles.label}>
            Peso (kg)
          </AppText>
          <WeightStepper value={weight} onChange={setWeight} />

          <AppText variant="label" style={styles.label}>
            {unitLabel}
          </AppText>
          <StepperInput
            value={reps}
            onChange={setReps}
            min={0}
            max={200}
            step={exercise.rep_unit === 'seconds' ? 5 : 1}
          />

          {showRir && (
            <>
              <AppText variant="label" style={styles.label}>
                RIR
              </AppText>
              <View style={styles.rirRow}>
                {RIR_OPTIONS.map((option) => (
                  <Chip key={option} label={String(option)} selected={rir === option} onPress={() => setRir(option)} />
                ))}
              </View>
            </>
          )}

          <View style={styles.saveWrap}>
            <Button
              title={saving ? 'Guardando...' : `Guardar serie ${nextSet.setIndex}`}
              disabled={!weight || !reps || saving}
              onPress={handleLogNext}
            />
          </View>
        </>
      ) : (
        <AppText color="success" style={styles.doneText}>
          ✓ Ejercicio completo
        </AppText>
      )}

      <SetEditor
        set={editingSet}
        exercise={exercise}
        onClose={() => setEditingSet(null)}
        onSave={async (change) => {
          if (!editingSet) return;
          await onCorrectSet(editingSet.id, change);
          setEditingSet(null);
        }}
        onDelete={async () => {
          if (!editingSet) return;
          await onCorrectSet(editingSet.id, { kind: 'delete' });
          setEditingSet(null);
        }}
      />
    </Card>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    card: { padding: 12 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerText: { flex: 1, gap: 2 },
    viewerBackdrop: { flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', gap: 12 },
    viewerImage: { width: '90%', aspectRatio: 1, backgroundColor: c.imageBackdrop, borderRadius: 8 },
    viewerCaption: { color: c.onDark },
    label: { marginTop: 4 },
    activeSetTitle: { marginTop: 4 },
    rirRow: { flexDirection: 'row', gap: 6 },
    loggedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.success,
      backgroundColor: c.successMuted,
      borderRadius: 8,
      padding: 10,
    },
    loggedText: { color: c.success },
    loggedTextFlex: { flex: 1 },
    editIcon: { fontSize: 18, color: c.success, paddingHorizontal: 4 },
    saveWrap: { marginTop: 4 },
    doneText: { fontWeight: '700', marginTop: 4 },
  });
}
