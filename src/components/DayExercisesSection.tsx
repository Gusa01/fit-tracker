import { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, Alert, Modal, ActivityIndicator } from 'react-native';
import { NestableDraggableFlatList, RenderItemParams } from 'react-native-draggable-flatlist';
import { useDayExercises } from '../hooks/useDayExercises';
import { useExercises } from '../hooks/useExercises';
import { useAuthSession } from '../hooks/useAuthSession';
import { supabase } from '../lib/supabase';
import {
  updateRoutineExercise,
  softDeleteRoutineExercise,
  reorderRoutineExercises,
  findOrCreateExercise,
} from '../lib/routines/mutations';
import { ExerciseForm, ExerciseFormValues } from './ExerciseForm';
import { ExercisePicker } from './ExercisePicker';
import { RoutineExerciseWithName } from '../lib/routines/types';
import { formatTargetScheme } from '../lib/sessions/prescribedSets';
import { AppText, Button } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

interface DayExercisesSectionProps {
  dayId: string;
}

function toMutationInput(values: ExerciseFormValues) {
  const isTopSet = values.schemeType === 'top_set_backoff';
  return {
    role: values.role,
    schemeType: values.schemeType,
    repUnit: values.repUnit,
    sets: isTopSet ? null : values.sets ? Number(values.sets) : null,
    repMin: isTopSet ? null : values.repMin ? Number(values.repMin) : null,
    repMax: isTopSet ? null : values.repMax ? Number(values.repMax) : null,
    rirMin: values.rirMin ? Number(values.rirMin) : null,
    rirMax: values.rirMax ? Number(values.rirMax) : null,
    topSetReps: isTopSet ? (values.topSetReps ? Number(values.topSetReps) : null) : null,
    backoffSets: isTopSet ? (values.backoffSets ? Number(values.backoffSets) : null) : null,
    backoffRepMin: isTopSet ? (values.backoffRepMin ? Number(values.backoffRepMin) : null) : null,
    backoffRepMax: isTopSet ? (values.backoffRepMax ? Number(values.backoffRepMax) : null) : null,
  };
}

export function DayExercisesSection({ dayId }: DayExercisesSectionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { exercises, isLoading, error, refetch } = useDayExercises(dayId);
  const { exercises: catalog } = useExercises();
  const { session } = useAuthSession();

  const [addingExercise, setAddingExercise] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  async function handlePickerDone() {
    setAddingExercise(false);
    await refetch();
  }

  async function handleUpdateExercise(routineExerciseId: string, values: ExerciseFormValues) {
    try {
      if (!session?.user.id) throw new Error('Iniciá sesión para guardar el ejercicio.');
      const exercise = await findOrCreateExercise(supabase, {
        name: values.exerciseName.trim(),
        primaryMuscle: values.primaryMuscle,
        equipment: values.equipment,
        ownerId: session?.user.id ?? null,
      });
      await updateRoutineExercise(supabase, routineExerciseId, {
        exerciseId: exercise.id,
        ...toMutationInput(values),
      });
      setEditingExerciseId(null);
      await refetch();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el ejercicio.');
    }
  }

  function handleDeleteExercise(routineExerciseId: string, exerciseName: string) {
    Alert.alert('Eliminar ejercicio', `¿Eliminar "${exerciseName}" de este día?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await softDeleteRoutineExercise(supabase, routineExerciseId);
            await refetch();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo eliminar el ejercicio.');
          }
        },
      },
    ]);
  }

  async function handleReorder(data: RoutineExerciseWithName[]) {
    try {
      await reorderRoutineExercises(
        supabase,
        data.map((exercise) => exercise.id)
      );
      await refetch();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo reordenar el ejercicio.');
    }
  }

  if (error) {
    return (
      <View style={styles.section}>
        <AppText variant="title" style={styles.sectionTitle}>
          Ejercicios
        </AppText>
        <AppText color="danger">{error}</AppText>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.section}>
        <AppText variant="title" style={styles.sectionTitle}>
          Ejercicios
        </AppText>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <AppText variant="title" style={styles.sectionTitle}>
        Ejercicios
      </AppText>
      <NestableDraggableFlatList
        data={exercises}
        keyExtractor={(exercise: RoutineExerciseWithName) => exercise.id}
        onDragEnd={({ data }) => handleReorder(data)}
        renderItem={({ item: exercise, drag, isActive }: RenderItemParams<RoutineExerciseWithName>) =>
          editingExerciseId === exercise.id ? (
            <ExerciseForm
              exercises={catalog}
              initial={exercise}
              onSubmit={(values) => handleUpdateExercise(exercise.id, values)}
              onCancel={() => setEditingExerciseId(null)}
            />
          ) : (
            <View style={[styles.exerciseRow, isActive && styles.exerciseRowActive]}>
              <Pressable style={styles.exerciseRowMain} onPress={() => setEditingExerciseId(exercise.id)}>
                <AppText variant="heading">{exercise.exercise_name}</AppText>
                <AppText variant="muted">{formatTargetScheme(exercise)}</AppText>
              </Pressable>
              <View style={styles.exerciseActions}>
                <Pressable onLongPress={drag} disabled={isActive}>
                  <AppText color="textMuted" style={styles.dragHandle}>
                    ☰
                  </AppText>
                </Pressable>
                <Pressable onPress={() => handleDeleteExercise(exercise.id, exercise.exercise_name)}>
                  <AppText color="danger" style={styles.deleteButton}>
                    Eliminar
                  </AppText>
                </Pressable>
              </View>
            </View>
          )
        }
      />

      <Button title="+ Agregar ejercicios" variant="secondary" onPress={() => setAddingExercise(true)} />

      <Modal visible={addingExercise} transparent animationType="slide" onRequestClose={() => setAddingExercise(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAddingExercise(false)} />
          <View style={styles.modalSheet}>
            <ExercisePicker dayId={dayId} onDone={handlePickerDone} onCancel={() => setAddingExercise(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    section: { gap: 12 },
    sectionTitle: { marginTop: 12 },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    exerciseRowActive: { borderColor: c.accent, backgroundColor: c.surfaceMuted },
    exerciseRowMain: { flex: 1 },
    exerciseActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    dragHandle: { fontSize: 20, paddingHorizontal: 6 },
    deleteButton: { fontWeight: '600' },
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay },
    modalSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      maxHeight: '85%',
    },
  });
}
