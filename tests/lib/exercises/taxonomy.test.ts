import {
  MUSCLES,
  MUSCLE_LABEL,
  EQUIPMENT,
  EQUIPMENT_LABEL,
  muscleGroupFor,
  mapFreeDbMuscle,
} from '../../../src/lib/exercises/taxonomy';

describe('taxonomy', () => {
  it('lists the 12 muscles and 9 equipment types with Spanish labels', () => {
    expect(MUSCLES).toHaveLength(12);
    expect(EQUIPMENT).toHaveLength(9);
    expect(MUSCLE_LABEL.hamstrings).toBe('Isquiotibiales');
    expect(MUSCLE_LABEL.adductors_abductors).toBe('Aductores/abductores');
    expect(EQUIPMENT_LABEL.cable).toBe('Polea');
    expect(EQUIPMENT_LABEL.smith).toBe('Máquina Smith');
  });

  it('derives the progression group from the primary muscle', () => {
    expect(muscleGroupFor('chest')).toBe('upper');
    expect(muscleGroupFor('forearms')).toBe('upper');
    expect(muscleGroupFor('glutes')).toBe('lower');
    expect(muscleGroupFor('calves')).toBe('lower');
    expect(muscleGroupFor('core')).toBe('core');
  });

  it('maps free-exercise-db muscles onto the 12 groups', () => {
    expect(mapFreeDbMuscle('lats')).toBe('back');
    expect(mapFreeDbMuscle('middle back')).toBe('back');
    expect(mapFreeDbMuscle('lower back')).toBe('back');
    expect(mapFreeDbMuscle('traps')).toBe('back');
    expect(mapFreeDbMuscle('abdominals')).toBe('core');
    expect(mapFreeDbMuscle('abductors')).toBe('adductors_abductors');
    expect(mapFreeDbMuscle('quadriceps')).toBe('quadriceps');
    expect(mapFreeDbMuscle('neck')).toBeNull();
    expect(mapFreeDbMuscle('unknown')).toBeNull();
  });
});
