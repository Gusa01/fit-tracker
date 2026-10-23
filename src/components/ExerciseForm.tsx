import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthSession } from '../hooks/useAuthSession';
import { View, TextInput, Pressable, StyleSheet, Switch, ScrollView } from 'react-native';
import {
  Exercise,
  RoutineExerciseRole,
  RoutineExerciseSchemeType,
  RoutineExerciseRepUnit,
  RoutineExerciseWithName,
} from '../lib/routines/types';
import { StepperInput } from './StepperInput';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { AppText, Button, Chip } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';
import { filterExercises, findMatchingExercise } from '../lib/exercises/search';
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

function initialValues(initial?: RoutineExerciseWithName, current?: Exercise): ExerciseFormValues {
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
    primaryMuscle: current && isMuscle(current.primary_muscle) ? current.primary_muscle : 'chest',
    equipment: current && isEquipment(current.equipment) ? current.equipment : 'dumbbell',
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuthSession();
  const currentExercise = initial ? exercises.find((e) => e.id === initial.exercise_id) : undefined;
  const [values, setValues] = useState<ExerciseFormValues>(initialValues(initial, currentExercise));
  const touchedKind = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [browseMuscle, setBrowseMuscle] = useState<Muscle | null>(null);

  const unitLabel = values.repUnit === 'seconds' ? 'Segundos' : 'Reps';

  const suggestions =
    values.exerciseName.trim().length > 0 || browseMuscle
      ? filterExercises(exercises, {
          query: values.exerciseName,
          muscle: browseMuscle,
          equipment: null,
        }).slice(0, browseMuscle ? 20 : 5)
      : [];

  function selectSuggestion(exercise: Exercise) {
    update('exerciseName', exercise.name);
    if (isMuscle(exercise.primary_muscle)) update('primaryMuscle', exercise.primary_muscle);
    if (isEquipment(exercise.equipment)) update('equipment', exercise.equipment);
  }

  // The exercise list may load after the form mounts: seed muscle/equipment once, unless the user already chose.
  useEffect(() => {
    if (!currentExercise || touchedKind.current) return;
    const { primary_muscle: muscle, equipment } = currentExercise;
    setValues((prev) => ({
      ...prev,
      primaryMuscle: isMuscle(muscle) ? muscle : prev.primaryMuscle,
      equipment: isEquipment(equipment) ? equipment : prev.equipment,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExercise?.id]);

  const matchesExisting = findMatchingExercise(exercises, values.exerciseName, session?.user.id ?? null) !== null;

  function update<K extends keyof ExerciseFormValues>(key: K, value: ExerciseFormValues[K]) {
    if (key === 'primaryMuscle' || key === 'equipment') touchedKind.current = true;
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
      <AppText variant="label" style={styles.label}>
        Nombre del ejercicio
      </AppText>
      <TextInput
        style={styles.input}
        placeholder="Ej: Press banca, Sentadilla, Remo..."
        placeholderTextColor={colors.textMuted}
        value={values.exerciseName}
        onChangeText={(text) => update('exerciseName', text)}
      />

      <AppText variant="label" style={styles.label}>
        Explorar ejercicios comunes
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.segmented}>
          {MUSCLES.map((m) => (
            <Chip
              key={m}
              label={MUSCLE_LABEL[m]}
              selected={browseMuscle === m}
              onPress={() => setBrowseMuscle(browseMuscle === m ? null : m)}
            />
          ))}
        </View>
      </ScrollView>

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <Pressable key={s.id} onPress={() => selectSuggestion(s)} style={styles.suggestionRow}>
              <ExerciseThumbnail imagePath={s.image_path} muscle={s.primary_muscle} size={32} />
              <AppText style={styles.suggestionName}>{s.name}</AppText>
              <AppText variant="muted" style={styles.suggestionMeta}>
                {isMuscle(s.primary_muscle) ? MUSCLE_LABEL[s.primary_muscle] : s.primary_muscle}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
      {browseMuscle && suggestions.length === 0 && (
        <AppText variant="muted" style={styles.hint}>
          No hay ejercicios cargados todavía en "{MUSCLE_LABEL[browseMuscle]}".
        </AppText>
      )}

      {!matchesExisting && (
        <>
          <AppText variant="label" style={styles.label}>
            Músculo principal
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.segmented}>
              {MUSCLES.map((m) => (
                <Chip
                  key={m}
                  label={MUSCLE_LABEL[m]}
                  selected={values.primaryMuscle === m}
                  onPress={() => update('primaryMuscle', m)}
                />
              ))}
            </View>
          </ScrollView>

          <AppText variant="label" style={styles.label}>
            Equipamiento
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.segmented}>
              {EQUIPMENT.map((e) => (
                <Chip
                  key={e}
                  label={EQUIPMENT_LABEL[e]}
                  selected={values.equipment === e}
                  onPress={() => update('equipment', e)}
                />
              ))}
            </View>
          </ScrollView>
        </>
      )}

      <AppText variant="label" style={styles.label}>
        Rol
      </AppText>
      <View style={styles.segmented}>
        {(['main', 'accessory', 'core'] as const).map((option) => (
          <Chip key={option} label={option} selected={values.role === option} onPress={() => update('role', option)} />
        ))}
      </View>

      <View style={styles.switchRow}>
        <AppText>Top set / back-off</AppText>
        <Switch
          value={values.schemeType === 'top_set_backoff'}
          onValueChange={(value) => update('schemeType', value ? 'top_set_backoff' : 'normal')}
          trackColor={{ false: colors.surfaceMuted, true: colors.accent }}
          thumbColor={colors.onDark}
        />
      </View>

      <View style={styles.switchRow}>
        <AppText>Medido en segundos</AppText>
        <Switch
          value={values.repUnit === 'seconds'}
          onValueChange={(value) => update('repUnit', value ? 'seconds' : 'reps')}
          trackColor={{ false: colors.surfaceMuted, true: colors.accent }}
          thumbColor={colors.onDark}
        />
      </View>

      {values.schemeType === 'normal' ? (
        <>
          <AppText variant="label" style={styles.label}>
            Series
          </AppText>
          <StepperInput value={values.sets} onChange={(text) => update('sets', text)} min={1} max={10} />
          <AppText variant="label" style={styles.label}>
            {unitLabel} mínimas
          </AppText>
          <StepperInput value={values.repMin} onChange={(text) => update('repMin', text)} min={1} max={50} />
          <AppText variant="label" style={styles.label}>
            {unitLabel} máximas
          </AppText>
          <StepperInput value={values.repMax} onChange={(text) => update('repMax', text)} min={1} max={50} />
        </>
      ) : (
        <>
          <AppText variant="label" style={styles.label}>
            {unitLabel} del top set
          </AppText>
          <StepperInput value={values.topSetReps} onChange={(text) => update('topSetReps', text)} min={1} max={20} />
          <AppText variant="label" style={styles.label}>
            Series de back-off
          </AppText>
          <StepperInput value={values.backoffSets} onChange={(text) => update('backoffSets', text)} min={1} max={10} />
          <AppText variant="label" style={styles.label}>
            {unitLabel} mínimas de back-off
          </AppText>
          <StepperInput
            value={values.backoffRepMin}
            onChange={(text) => update('backoffRepMin', text)}
            min={1}
            max={50}
          />
          <AppText variant="label" style={styles.label}>
            {unitLabel} máximas de back-off
          </AppText>
          <StepperInput
            value={values.backoffRepMax}
            onChange={(text) => update('backoffRepMax', text)}
            min={1}
            max={50}
          />
        </>
      )}

      <AppText variant="label" style={styles.label}>
        RIR mínimo (opcional)
      </AppText>
      <StepperInput value={values.rirMin} onChange={(text) => update('rirMin', text)} min={0} max={10} />
      <AppText variant="label" style={styles.label}>
        RIR máximo (opcional)
      </AppText>
      <StepperInput value={values.rirMax} onChange={(text) => update('rirMax', text)} min={0} max={10} />

      {error && <AppText color="danger">{error}</AppText>}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title={saving ? 'Guardando...' : 'Guardar'} onPress={handleSubmit} disabled={saving} />
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
    form: {
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
    suggestions: { borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    suggestionName: { flex: 1 },
    suggestionMeta: { fontSize: 12 },
    hint: { fontSize: 12, fontStyle: 'italic' },
    label: { marginTop: 4 },
    segmented: { flexDirection: 'row', gap: 6 },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actions: { flexDirection: 'row', gap: 8 },
    action: { flex: 1 },
  });
}
