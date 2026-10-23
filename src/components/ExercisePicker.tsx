import { useMemo, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useExercises } from '../hooks/useExercises';
import { useAuthSession } from '../hooks/useAuthSession';
import {
  EQUIPMENT,
  EQUIPMENT_LABEL,
  Equipment,
  MUSCLES,
  MUSCLE_LABEL,
  Muscle,
  isEquipment,
  isMuscle,
} from '../lib/exercises/taxonomy';
import { filterExercises } from '../lib/exercises/search';
import { supabase } from '../lib/supabase';
import { createRoutineExercise, findOrCreateExercise } from '../lib/routines/mutations';
import { Exercise } from '../lib/routines/types';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { AppText, Button, Chip } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

interface ExercisePickerProps {
  dayId: string;
  onDone: () => void | Promise<void>;
  onCancel: () => void;
}

const DEFAULTS = {
  role: 'accessory' as const,
  schemeType: 'normal' as const,
  repUnit: 'reps' as const,
  sets: 3,
  repMin: 8,
  repMax: 12,
  rirMin: null,
  rirMax: null,
  topSetReps: null,
  backoffSets: null,
  backoffRepMin: null,
  backoffRepMax: null,
};

export function ExercisePicker({ dayId, onDone, onCancel }: ExercisePickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { exercises: catalog, refetch: refetchCatalog } = useExercises();
  const { session } = useAuthSession();
  const [extraCatalog, setExtraCatalog] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<Muscle>('chest');
  const [newEquipment, setNewEquipment] = useState<Equipment>('dumbbell');
  const [addingCustom, setAddingCustom] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allExercises = [...extraCatalog, ...catalog.filter((e) => !extraCatalog.some((x) => x.id === e.id))];
  const visible = filterExercises(allExercises, { query: search, muscle, equipment });

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleAddCustom() {
    const userId = session?.user.id;
    if (!newName.trim()) return;
    if (!userId) {
      Alert.alert('Error', 'Iniciá sesión para crear un ejercicio.');
      return;
    }
    try {
      const exercise = await findOrCreateExercise(supabase, {
        name: newName.trim(),
        primaryMuscle: newMuscle,
        equipment: newEquipment,
        ownerId: userId,
      });
      setExtraCatalog((prev) => (prev.some((e) => e.id === exercise.id) ? prev : [...prev, exercise]));
      setSelectedIds((prev) => (prev.includes(exercise.id) ? prev : [...prev, exercise.id]));
      setNewName('');
      setAddingCustom(false);
      refetchCatalog();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear el ejercicio.');
    }
  }

  async function handleConfirm() {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const exerciseId of selectedIds) {
        await createRoutineExercise(supabase, dayId, { exerciseId, ...DEFAULTS });
      }
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron agregar los ejercicios.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <AppText variant="heading">Elegir ejercicios</AppText>
      <TextInput
        style={styles.input}
        placeholder="Buscar por nombre o sinónimo..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.segmented}>
          <Chip label="Todos los músculos" selected={!muscle} onPress={() => setMuscle(null)} />
          {MUSCLES.map((m) => (
            <Chip
              key={m}
              label={MUSCLE_LABEL[m]}
              selected={muscle === m}
              onPress={() => setMuscle(muscle === m ? null : m)}
            />
          ))}
        </View>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.segmented}>
          <Chip label="Todo el equipamiento" selected={!equipment} onPress={() => setEquipment(null)} />
          {EQUIPMENT.map((e) => (
            <Chip
              key={e}
              label={EQUIPMENT_LABEL[e]}
              selected={equipment === e}
              onPress={() => setEquipment(equipment === e ? null : e)}
            />
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.list}>
        {visible.map((exercise) => {
          const checked = selectedIds.includes(exercise.id);
          return (
            <Pressable key={exercise.id} style={styles.row} onPress={() => toggle(exercise.id)}>
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && (
                  <AppText color="onAccent" style={styles.checkmark}>
                    ✓
                  </AppText>
                )}
              </View>
              <ExerciseThumbnail imagePath={exercise.image_path} muscle={exercise.primary_muscle} />
              <View style={styles.rowText}>
                <AppText>{exercise.name}</AppText>
                <AppText variant="muted" style={styles.rowMeta}>
                  {isMuscle(exercise.primary_muscle) ? MUSCLE_LABEL[exercise.primary_muscle] : exercise.primary_muscle}
                  {' · '}
                  {isEquipment(exercise.equipment) ? EQUIPMENT_LABEL[exercise.equipment] : exercise.equipment}
                </AppText>
              </View>
            </Pressable>
          );
        })}
        {visible.length === 0 && (
          <AppText variant="muted" style={styles.hint}>
            Sin resultados.
          </AppText>
        )}
      </ScrollView>

      {addingCustom ? (
        <View style={styles.customForm}>
          <TextInput
            style={styles.input}
            placeholder="Nombre del ejercicio nuevo"
            placeholderTextColor={colors.textMuted}
            value={newName}
            onChangeText={setNewName}
          />
          <AppText variant="label">Músculo principal</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.segmented}>
              {MUSCLES.map((m) => (
                <Chip key={m} label={MUSCLE_LABEL[m]} selected={newMuscle === m} onPress={() => setNewMuscle(m)} />
              ))}
            </View>
          </ScrollView>
          <AppText variant="label">Equipamiento</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.segmented}>
              {EQUIPMENT.map((e) => (
                <Chip
                  key={e}
                  label={EQUIPMENT_LABEL[e]}
                  selected={newEquipment === e}
                  onPress={() => setNewEquipment(e)}
                />
              ))}
            </View>
          </ScrollView>
          <Button title="+ Agregar a la lista" variant="secondary" onPress={handleAddCustom} />
        </View>
      ) : (
        <Button title="+ No está en la lista, crear nuevo" variant="secondary" onPress={() => setAddingCustom(true)} />
      )}

      {error && <AppText color="danger">{error}</AppText>}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title={
              saving
                ? 'Agregando...'
                : `Agregar ${selectedIds.length || ''} ejercicio${selectedIds.length === 1 ? '' : 's'}`
            }
            onPress={handleConfirm}
            disabled={saving || selectedIds.length === 0}
          />
        </View>
        <View style={styles.action}>
          <Button title="Cancelar" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </View>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    container: {
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: 8,
      padding: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      color: c.text,
      borderRadius: 8,
      padding: 10,
    },
    segmented: { flexDirection: 'row', gap: 6 },
    list: { maxHeight: 260, borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderWidth: 1,
      borderColor: c.textMuted,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: c.accent, borderColor: c.accent },
    checkmark: { fontSize: 14, fontWeight: '700' },
    rowText: { flex: 1 },
    rowMeta: { fontSize: 12 },
    hint: { fontSize: 12, fontStyle: 'italic', padding: 10 },
    customForm: { gap: 8 },
    actions: { flexDirection: 'row', gap: 8 },
    action: { flex: 1 },
  });
}
