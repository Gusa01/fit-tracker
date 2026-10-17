import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Switch, ScrollView } from 'react-native';
import {
  Exercise,
  RoutineExerciseRole,
  RoutineExerciseSchemeType,
  RoutineExerciseRepUnit,
  RoutineExerciseWithName,
} from '../lib/routines/types';
import { StepperInput } from './StepperInput';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { filterExercises } from '../lib/exercises/search';
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

export interface ExerciseFormValues {
  exerciseName: string;
  primaryMuscle: Muscle;
  equipment: Equipment;
  role: RoutineExerciseRole;
  schemeType: RoutineExerciseSchemeType;
  repUnit: RoutineExerciseRepUnit;
  sets: string;
  repMin: string;
  repMax: string;
  rirMin: string;
  rirMax: string;
  topSetReps: string;
  backoffSets: string;
  backoffRepMin: string;
  backoffRepMax: string;
}

interface ExerciseFormProps {
  exercises: Exercise[];
  initial?: RoutineExerciseWithName;
  onSubmit: (values: ExerciseFormValues) => Promise<void>;
  onCancel: () => void;
}

function initialValues(initial?: RoutineExerciseWithName): ExerciseFormValues {
  if (!initial) {
    return {
      exerciseName: '',
      primaryMuscle: 'chest',
      equipment: 'dumbbell',
      role: 'accessory',
      schemeType: 'normal',
      repUnit: 'reps',
      sets: '',
      repMin: '',
      repMax: '',
      rirMin: '',
      rirMax: '',
      topSetReps: '',
      backoffSets: '',
      backoffRepMin: '',
      backoffRepMax: '',
    };
  }
  return {
    exerciseName: initial.exercise_name,
    primaryMuscle: 'chest',
    equipment: 'dumbbell',
    role: initial.role,
    schemeType: initial.scheme_type,
    repUnit: initial.rep_unit,
    sets: initial.sets !== null ? String(initial.sets) : '',
    repMin: initial.rep_min !== null ? String(initial.rep_min) : '',
    repMax: initial.rep_max !== null ? String(initial.rep_max) : '',
    rirMin: initial.rir_min !== null ? String(initial.rir_min) : '',
    rirMax: initial.rir_max !== null ? String(initial.rir_max) : '',
    topSetReps: initial.top_set_reps !== null ? String(initial.top_set_reps) : '',
    backoffSets: initial.backoff_sets !== null ? String(initial.backoff_sets) : '',
    backoffRepMin: initial.backoff_rep_min !== null ? String(initial.backoff_rep_min) : '',
    backoffRepMax: initial.backoff_rep_max !== null ? String(initial.backoff_rep_max) : '',
  };
}

export function ExerciseForm({ exercises, initial, onSubmit, onCancel }: ExerciseFormProps) {
  const [values, setValues] = useState<ExerciseFormValues>(initialValues(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [browseMuscle, setBrowseMuscle] = useState<Muscle | null>(null);

  const unitLabel = values.repUnit === 'seconds' ? 'Segundos' : 'Reps';

  const suggestions =
    values.exerciseName.trim().length > 0 || browseMuscle
      ? filterExercises(exercises, { query: values.exerciseName, muscle: browseMuscle, equipment: null }).slice(
          0,
          browseMuscle ? 20 : 5
        )
      : [];

  function selectSuggestion(exercise: Exercise) {
    update('exerciseName', exercise.name);
    if (isMuscle(exercise.primary_muscle)) update('primaryMuscle', exercise.primary_muscle);
    if (isEquipment(exercise.equipment)) update('equipment', exercise.equipment);
  }

  function update<K extends keyof ExerciseFormValues>(key: K, value: ExerciseFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!values.exerciseName.trim()) return 'Ponele un nombre al ejercicio.';
    if (values.schemeType === 'normal') {
      if (!values.sets || !values.repMin || !values.repMax) {
        return 'Series, reps mínimas y reps máximas son obligatorias.';
      }
      if (Number(values.repMin) > Number(values.repMax)) {
        return 'Las reps mínimas no pueden ser mayores a las máximas.';
      }
    } else {
      if (!values.topSetReps || !values.backoffSets || !values.backoffRepMin || !values.backoffRepMax) {
        return 'Top set y back-off son obligatorios para este esquema.';
      }
      if (Number(values.backoffRepMin) > Number(values.backoffRepMax)) {
        return 'El rango de back-off es inválido.';
      }
    }
    if (values.rirMin && values.rirMax && Number(values.rirMin) > Number(values.rirMax)) {
      return 'El rango de RIR es inválido.';
    }
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el ejercicio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Nombre del ejercicio</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Press banca, Sentadilla, Remo..."
        value={values.exerciseName}
        onChangeText={(text) => update('exerciseName', text)}
      />

      <Text style={styles.label}>Explorar ejercicios comunes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.segmented}>
          {MUSCLES.map((m) => (
            <Pressable
              key={m}
              style={[styles.segment, browseMuscle === m && styles.segmentSelected]}
              onPress={() => setBrowseMuscle(browseMuscle === m ? null : m)}
            >
              <Text style={browseMuscle === m ? styles.segmentTextSelected : styles.segmentText}>{MUSCLE_LABEL[m]}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <Pressable key={s.id} onPress={() => selectSuggestion(s)} style={styles.suggestionRow}>
              <ExerciseThumbnail imagePath={s.image_path} muscle={s.primary_muscle} size={32} />
              <Text style={styles.suggestionName}>{s.name}</Text>
              <Text style={styles.suggestionMeta}>
                {isMuscle(s.primary_muscle) ? MUSCLE_LABEL[s.primary_muscle] : s.primary_muscle}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {browseMuscle && suggestions.length === 0 && (
        <Text style={styles.hint}>No hay ejercicios cargados todavía en "{MUSCLE_LABEL[browseMuscle]}".</Text>
      )}

      <Text style={styles.label}>Músculo principal</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.segmented}>
          {MUSCLES.map((m) => (
            <Pressable
              key={m}
              style={[styles.segment, values.primaryMuscle === m && styles.segmentSelected]}
              onPress={() => update('primaryMuscle', m)}
            >
              <Text style={values.primaryMuscle === m ? styles.segmentTextSelected : styles.segmentText}>
                {MUSCLE_LABEL[m]}
              </Text>
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
              style={[styles.segment, values.equipment === e && styles.segmentSelected]}
              onPress={() => update('equipment', e)}
            >
              <Text style={values.equipment === e ? styles.segmentTextSelected : styles.segmentText}>
                {EQUIPMENT_LABEL[e]}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.label}>Rol</Text>
      <View style={styles.segmented}>
        {(['main', 'accessory', 'core'] as const).map((option) => (
          <Pressable
            key={option}
            style={[styles.segment, values.role === option && styles.segmentSelected]}
            onPress={() => update('role', option)}
          >
            <Text style={values.role === option ? styles.segmentTextSelected : styles.segmentText}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text>Top set / back-off</Text>
        <Switch
          value={values.schemeType === 'top_set_backoff'}
          onValueChange={(value) => update('schemeType', value ? 'top_set_backoff' : 'normal')}
        />
      </View>

      <View style={styles.switchRow}>
        <Text>Medido en segundos</Text>
        <Switch
          value={values.repUnit === 'seconds'}
          onValueChange={(value) => update('repUnit', value ? 'seconds' : 'reps')}
        />
      </View>

      {values.schemeType === 'normal' ? (
        <>
          <Text style={styles.label}>Series</Text>
          <StepperInput value={values.sets} onChange={(text) => update('sets', text)} min={1} max={10} />
          <Text style={styles.label}>{unitLabel} mínimas</Text>
          <StepperInput value={values.repMin} onChange={(text) => update('repMin', text)} min={1} max={50} />
          <Text style={styles.label}>{unitLabel} máximas</Text>
          <StepperInput value={values.repMax} onChange={(text) => update('repMax', text)} min={1} max={50} />
        </>
      ) : (
        <>
          <Text style={styles.label}>{unitLabel} del top set</Text>
          <StepperInput value={values.topSetReps} onChange={(text) => update('topSetReps', text)} min={1} max={20} />
          <Text style={styles.label}>Series de back-off</Text>
          <StepperInput value={values.backoffSets} onChange={(text) => update('backoffSets', text)} min={1} max={10} />
          <Text style={styles.label}>{unitLabel} mínimas de back-off</Text>
          <StepperInput
            value={values.backoffRepMin}
            onChange={(text) => update('backoffRepMin', text)}
            min={1}
            max={50}
          />
          <Text style={styles.label}>{unitLabel} máximas de back-off</Text>
          <StepperInput
            value={values.backoffRepMax}
            onChange={(text) => update('backoffRepMax', text)}
            min={1}
            max={50}
          />
        </>
      )}

      <Text style={styles.label}>RIR mínimo (opcional)</Text>
      <StepperInput value={values.rirMin} onChange={(text) => update('rirMin', text)} min={0} max={10} />
      <Text style={styles.label}>RIR máximo (opcional)</Text>
      <StepperInput value={values.rirMax} onChange={(text) => update('rirMax', text)} min={0} max={10} />

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={handleSubmit} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  suggestions: { borderWidth: 1, borderColor: '#eee', borderRadius: 8 },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  suggestionName: { flex: 1 },
  suggestionMeta: { color: '#666', fontSize: 12 },
  hint: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  label: { fontWeight: '600', marginTop: 4 },
  segmented: { flexDirection: 'row', gap: 6 },
  segment: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  segmentSelected: { backgroundColor: '#111', borderColor: '#111' },
  segmentText: { color: '#111' },
  segmentTextSelected: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { color: '#dc2626' },
  actions: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, alignItems: 'center' },
  cancelButtonText: { color: '#111', fontWeight: '600' },
});
