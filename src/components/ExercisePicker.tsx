import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
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
    if (!newName.trim() || !userId) return;
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
      <Text style={styles.title}>Elegir ejercicios</Text>
      <TextInput
        style={styles.input}
        placeholder="Buscar por nombre o sinónimo..."
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.segmented}>
          <Pressable style={[styles.segment, !muscle && styles.segmentSelected]} onPress={() => setMuscle(null)}>
            <Text style={!muscle ? styles.segmentTextSelected : styles.segmentText}>Todos los músculos</Text>
          </Pressable>
          {MUSCLES.map((m) => (
            <Pressable
              key={m}
              style={[styles.segment, muscle === m && styles.segmentSelected]}
              onPress={() => setMuscle(muscle === m ? null : m)}
            >
              <Text style={muscle === m ? styles.segmentTextSelected : styles.segmentText}>{MUSCLE_LABEL[m]}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.segmented}>
          <Pressable style={[styles.segment, !equipment && styles.segmentSelected]} onPress={() => setEquipment(null)}>
            <Text style={!equipment ? styles.segmentTextSelected : styles.segmentText}>Todo el equipamiento</Text>
          </Pressable>
          {EQUIPMENT.map((e) => (
            <Pressable
              key={e}
              style={[styles.segment, equipment === e && styles.segmentSelected]}
              onPress={() => setEquipment(equipment === e ? null : e)}
            >
              <Text style={equipment === e ? styles.segmentTextSelected : styles.segmentText}>{EQUIPMENT_LABEL[e]}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.list}>
        {visible.map((exercise) => {
          const checked = selectedIds.includes(exercise.id);
          return (
            <Pressable key={exercise.id} style={styles.row} onPress={() => toggle(exercise.id)}>
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <ExerciseThumbnail imagePath={exercise.image_path} muscle={exercise.primary_muscle} />
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{exercise.name}</Text>
                <Text style={styles.rowMeta}>
                  {isMuscle(exercise.primary_muscle) ? MUSCLE_LABEL[exercise.primary_muscle] : exercise.primary_muscle}
                  {' · '}
                  {isEquipment(exercise.equipment) ? EQUIPMENT_LABEL[exercise.equipment] : exercise.equipment}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {visible.length === 0 && <Text style={styles.hint}>Sin resultados.</Text>}
      </ScrollView>

      {addingCustom ? (
        <View style={styles.customForm}>
          <TextInput
            style={styles.input}
            placeholder="Nombre del ejercicio nuevo"
            value={newName}
            onChangeText={setNewName}
          />
          <Text style={styles.label}>Músculo principal</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.segmented}>
              {MUSCLES.map((m) => (
                <Pressable
                  key={m}
                  style={[styles.segment, newMuscle === m && styles.segmentSelected]}
                  onPress={() => setNewMuscle(m)}
                >
                  <Text style={newMuscle === m ? styles.segmentTextSelected : styles.segmentText}>{MUSCLE_LABEL[m]}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.label}>Equipamiento</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.segmented}>
              {EQUIPMENT.map((e) => (
                <Pressable
                  key={e}
                  style={[styles.segment, newEquipment === e && styles.segmentSelected]}
                  onPress={() => setNewEquipment(e)}
                >
                  <Text style={newEquipment === e ? styles.segmentTextSelected : styles.segmentText}>
                    {EQUIPMENT_LABEL[e]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Pressable style={styles.newButton} onPress={handleAddCustom}>
            <Text style={styles.newButtonText}>+ Agregar a la lista</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.newButton} onPress={() => setAddingCustom(true)}>
          <Text style={styles.newButtonText}>+ No está en la lista, crear nuevo</Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={handleConfirm} disabled={saving || selectedIds.length === 0}>
          <Text style={styles.buttonText}>
            {saving ? 'Agregando...' : `Agregar ${selectedIds.length || ''} ejercicio${selectedIds.length === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 },
  title: { fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  segmented: { flexDirection: 'row', gap: 6 },
  segment: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  segmentSelected: { backgroundColor: '#111', borderColor: '#111' },
  segmentText: { color: '#111' },
  segmentTextSelected: { color: '#fff' },
  list: { maxHeight: 260, borderWidth: 1, borderColor: '#eee', borderRadius: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#111', borderColor: '#111' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowText: { flex: 1 },
  rowName: { fontSize: 15 },
  label: { fontWeight: '600' },
  rowMeta: { color: '#666', fontSize: 12 },
  hint: { color: '#666', fontSize: 12, fontStyle: 'italic', padding: 10 },
  customForm: { gap: 8 },
  newButton: { borderWidth: 1, borderColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  newButtonText: { color: '#111', fontWeight: '600' },
  error: { color: '#dc2626' },
  actions: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, alignItems: 'center' },
  cancelButtonText: { color: '#111', fontWeight: '600' },
});
