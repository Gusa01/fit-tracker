export const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'adductors_abductors',
  'calves',
  'core',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  quadriceps: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  adductors_abductors: 'Aductores/abductores',
  calves: 'Gemelos',
  core: 'Core',
};

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'ez_bar',
  'smith',
  'band',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barra',
  dumbbell: 'Mancuernas',
  machine: 'Máquina',
  cable: 'Polea',
  bodyweight: 'Peso corporal',
  kettlebell: 'Kettlebell',
  ez_bar: 'Barra EZ',
  smith: 'Máquina Smith',
  band: 'Banda elástica',
};

const LOWER: ReadonlySet<Muscle> = new Set(['quadriceps', 'hamstrings', 'glutes', 'adductors_abductors', 'calves']);

/** Mirrors the generated `exercises.muscle_group` column (used for weight increments). */
export function muscleGroupFor(muscle: Muscle): 'upper' | 'lower' | 'core' {
  if (muscle === 'core') return 'core';
  return LOWER.has(muscle) ? 'lower' : 'upper';
}

const FREE_DB_MUSCLE: Record<string, Muscle | null> = {
  chest: 'chest',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  adductors: 'adductors_abductors',
  abductors: 'adductors_abductors',
  calves: 'calves',
  abdominals: 'core',
  neck: null,
};

export function mapFreeDbMuscle(name: string): Muscle | null {
  return FREE_DB_MUSCLE[name] ?? null;
}

export function isMuscle(value: string): value is Muscle {
  return (MUSCLES as readonly string[]).includes(value);
}

export function isEquipment(value: string): value is Equipment {
  return (EQUIPMENT as readonly string[]).includes(value);
}
