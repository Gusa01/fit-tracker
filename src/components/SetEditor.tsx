import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, Modal, StyleSheet, Alert } from 'react-native';
import { RoutineExerciseRepUnit } from '../lib/routines/types';
import { LoggedSet } from '../lib/sessions/types';
import { SetCorrection, SetEditValues } from '../lib/history/types';
import { editFromValues, validateSetEdit } from '../lib/history/logic';
import { formatSetLabel } from '../lib/history/format';
import { WeightStepper } from './WeightStepper';
import { StepperInput } from './StepperInput';
import { AppText, Button, Chip } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

const RIR_OPTIONS = [0, 1, 2, 3, 4];

interface SetEditorProps {
  set: LoggedSet | null;
  exercise: { exercise_name: string; rep_unit: RoutineExerciseRepUnit; rir_min: number | null } | null;
  onSave: (change: SetCorrection) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

function valuesFrom(set: LoggedSet): SetEditValues {
  return { weight: String(set.weight), reps: String(set.reps), rir: set.rir };
}

export function SetEditor({ set, exercise, onSave, onDelete, onClose }: SetEditorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [values, setValues] = useState<SetEditValues>({ weight: '', reps: '', rir: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (set) setValues(valuesFrom(set));
  }, [set?.id]);

  if (!set || !exercise) return null;

  const timeBased = exercise.rep_unit === 'seconds';
  const showRir = exercise.rir_min !== null;
  const problem = validateSetEdit(values, exercise);

  async function handleSave() {
    if (!set || !exercise || problem) return;
    setSaving(true);
    try {
      await onSave(editFromValues(values, exercise, set));
    } catch {
      Alert.alert('Error', 'No se pudo guardar la corrección. Probá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert('Borrar serie', '¿Borrar esta serie?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await onDelete();
          } catch {
            Alert.alert('Error', 'No se pudo guardar la corrección. Probá de nuevo.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <AppText variant="heading" style={styles.title}>
          {exercise.exercise_name}
        </AppText>
        <AppText variant="muted">{formatSetLabel(set)}</AppText>

        {!timeBased && (
          <>
            <AppText variant="label" style={styles.label}>
              Peso (kg)
            </AppText>
            <WeightStepper value={values.weight} onChange={(weight) => setValues((v) => ({ ...v, weight }))} />
          </>
        )}

        <AppText variant="label" style={styles.label}>
          {timeBased ? 'Segundos' : 'Reps'}
        </AppText>
        <StepperInput
          value={values.reps}
          onChange={(reps) => setValues((v) => ({ ...v, reps }))}
          min={0}
          max={200}
          step={timeBased ? 5 : 1}
        />

        {showRir && (
          <>
            <AppText variant="label" style={styles.label}>
              RIR
            </AppText>
            <View style={styles.rirRow}>
              {RIR_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={String(option)}
                  selected={values.rir === option}
                  onPress={() => setValues((v) => ({ ...v, rir: option }))}
                />
              ))}
            </View>
          </>
        )}

        {problem && <AppText color="danger">{problem}</AppText>}

        <View style={styles.saveWrap}>
          <Button
            title={saving ? 'Guardando...' : 'Guardar'}
            disabled={problem !== null || saving}
            onPress={handleSave}
          />
        </View>
        <View style={styles.secondaryRow}>
          <View style={styles.secondaryCell}>
            <Button title="Borrar serie" variant="danger" disabled={saving} onPress={handleDelete} />
          </View>
          <View style={styles.secondaryCell}>
            <Button title="Cancelar" variant="secondary" disabled={saving} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.overlay },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      padding: 16,
      gap: 8,
    },
    title: { fontSize: 17 },
    label: { marginTop: 4 },
    rirRow: { flexDirection: 'row', gap: 6 },
    saveWrap: { marginTop: 8 },
    secondaryRow: { flexDirection: 'row', gap: 8 },
    secondaryCell: { flex: 1 },
  });
}
