import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, Alert, Modal, ActivityIndicator } from 'react-native';
import { NestableDraggableFlatList, RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { hapticDrop, hapticLift, hapticTick } from '../lib/haptics';
import { Ionicons } from '@expo/vector-icons';
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
import { useScrollIntoView } from './ScrollIntoViewContext';
import { RoutineExerciseWithName } from '../lib/routines/types';
import { formatTargetScheme } from '../lib/sessions/prescribedSets';
import { AppText, Button, useToast } from './ui';
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

  // Local order so a drop shows the new order at once instead of waiting for a refetch.
  const [ordered, setOrdered] = useState(exercises);
  useEffect(() => setOrdered(exercises), [exercises]);

  const [addingExercise, setAddingExercise] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  // The row whose form was just saved: the form is much taller, so the row may land above the visible area.
  const [revealExerciseId, setRevealExerciseId] = useState<string | null>(null);
  const scrollIntoView = useScrollIntoView();
  const toast = useToast();

  async function handlePickerDone() {
    setAddingExercise(false);
    await refetch();
  }

  async function handleUpdateExercise(routineExerciseId: string, values: ExerciseFormValues) {
    try {
      const userId = session?.user.id;
      if (!userId) throw new Error('Iniciá sesión para guardar el ejercicio.');
      const exercise = await findOrCreateExercise(supabase, {
        name: values.exerciseName.trim(),
        primaryMuscle: values.primaryMuscle,
        equipment: values.equipment,
        ownerId: userId,
      });
      await updateRoutineExercise(supabase, routineExerciseId, {
        exerciseId: exercise.id,
        ...toMutationInput(values),
      });
      setEditingExerciseId(null);
      setRevealExerciseId(routineExerciseId);
      toast('Ejercicio guardado');
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
    setOrdered(data);
    try {
      await reorderRoutineExercises(
        supabase,
        data.map((exercise) => exercise.id)
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo reordenar el ejercicio.');
      await refetch();
    }
  }

  // Screen-reader alternative to dragging.
  function moveBy(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    handleReorder(next);
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

  // A refetch keeps the list on screen; collapsing it to a spinner would shrink the page and move the scroll.
  if (isLoading && ordered.length === 0) {
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
        data={ordered}
        keyExtractor={(exercise: RoutineExerciseWithName) => exercise.id}
        // Lower than the library default (20) so the lifted card follows the finger sooner, still high
        // enough that a vertical swipe over the list scrolls the screen.
        activationDistance={12}
        onDragBegin={hapticLift}
        onPlaceholderIndexChange={hapticTick}
        onDragEnd={({ data, from, to }) => {
          hapticDrop();
          if (from !== to) handleReorder(data);
        }}
        renderItem={({ item: exercise, drag, isActive, getIndex }: RenderItemParams<RoutineExerciseWithName>) =>
          editingExerciseId === exercise.id ? (
            <ExerciseForm
              exercises={catalog}
              initial={exercise}
              onSubmit={(values) => handleUpdateExercise(exercise.id, values)}
              onCancel={() => setEditingExerciseId(null)}
            />
          ) : (
            <ScaleDecorator activeScale={1.03}>
              {/* Long-press anywhere on the card lifts it; a tap opens the editor. */}
              <Pressable
                style={[styles.exerciseRow, isActive && styles.exerciseRowActive]}
                onLayout={
                  revealExerciseId === exercise.id
                    ? (event) => {
                        setRevealExerciseId(null);
                        scrollIntoView(event.currentTarget as unknown as View);
                      }
                    : undefined
                }
                onPress={() => setEditingExerciseId(exercise.id)}
                onLongPress={drag}
                delayLongPress={250}
                disabled={isActive}
                accessibilityRole="button"
                accessibilityHint="Tocá para editar. Mantené presionado y arrastrá para reordenar."
                accessibilityActions={[
                  { name: 'moveUp', label: 'Subir' },
                  { name: 'moveDown', label: 'Bajar' },
                ]}
                onAccessibilityAction={(event) => {
                  const index = getIndex();
                  if (index === undefined) return;
                  moveBy(index, event.nativeEvent.actionName === 'moveUp' ? -1 : 1);
                }}
              >
                <View style={styles.exerciseRowMain}>
                  <AppText variant="heading">{exercise.exercise_name}</AppText>
                  <AppText variant="muted">{formatTargetScheme(exercise)}</AppText>
                </View>
                <View style={styles.exerciseActions}>
                  {/* The handle drags on touch, without the long-press wait. */}
                  <Pressable
                    onPressIn={drag}
                    disabled={isActive}
                    hitSlop={8}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  >
                    <Ionicons name="reorder-three" size={24} color={colors.textMuted} style={styles.dragHandle} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteExercise(exercise.id, exercise.exercise_name)} hitSlop={8}>
                    <AppText color="danger" style={styles.deleteButton}>
                      Eliminar
                    </AppText>
                  </Pressable>
                </View>
              </Pressable>
            </ScaleDecorator>
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
    exerciseRowActive: {
      borderColor: c.accent,
      backgroundColor: c.surfaceMuted,
      elevation: 6,
      shadowColor: c.text,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    exerciseRowMain: { flex: 1 },
    exerciseActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    dragHandle: { paddingHorizontal: 4 },
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
