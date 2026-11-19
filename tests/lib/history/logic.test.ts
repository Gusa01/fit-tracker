import {
  summarizeSession,
  groupSessionSets,
  draftNewSet,
  validateSetEdit,
  editFromValues,
  buildCorrectionPayload,
  applyCorrection,
} from '../../../src/lib/history/logic';
import { HistoryExercise } from '../../../src/lib/history/types';
import { LoggedSet } from '../../../src/lib/sessions/types';

function set(overrides: Partial<LoggedSet>): LoggedSet {
  return {
    id: 's1',
    session_id: 'sess',
    routine_exercise_id: 're-bench',
    set_index: 1,
    set_type: 'working',
    weight: 80,
    reps: 8,
    rir: 2,
    created_at: '2026-10-01T18:00:00Z',
    is_deleted: false,
    ...overrides,
  };
}

function exercise(overrides: Partial<HistoryExercise>): HistoryExercise {
  return {
    id: 're-bench',
    exercise_name: 'Press banca',
    order_index: 0,
    scheme_type: 'normal',
    rep_unit: 'reps',
    rir_min: 1,
    sets: 3,
    backoff_sets: null,
    ...overrides,
  };
}

describe('summarizeSession', () => {
  it('counts distinct exercises and sets, ignoring deleted sets', () => {
    expect(
      summarizeSession([
        { routine_exercise_id: 'a' },
        { routine_exercise_id: 'a' },
        { routine_exercise_id: 'b', is_deleted: false },
        { routine_exercise_id: 'c', is_deleted: true },
      ])
    ).toEqual({ exerciseCount: 2, setCount: 3 });
  });

  it('returns zeros for a session with no sets', () => {
    expect(summarizeSession([])).toEqual({ exerciseCount: 0, setCount: 0 });
  });
});

describe('groupSessionSets', () => {
  const bench = exercise({ id: 're-bench', order_index: 1 });
  const squat = exercise({ id: 're-squat', exercise_name: 'Sentadilla', order_index: 0 });
  const curl = exercise({ id: 're-curl', exercise_name: 'Curl', order_index: 2 });

  it('orders exercises by routine order and sets by set index, dropping deleted sets but keeping the exercise', () => {
    const groups = groupSessionSets(
      [
        set({ id: 'b2', routine_exercise_id: 're-bench', set_index: 2 }),
        set({ id: 'b1', routine_exercise_id: 're-bench', set_index: 1 }),
        set({ id: 's1', routine_exercise_id: 're-squat', set_index: 1 }),
        set({ id: 'c1', routine_exercise_id: 're-curl', set_index: 1, is_deleted: true }),
      ],
      [bench, curl, squat]
    );
    expect(groups.map((g) => [g.exercise.id, g.sets.map((s) => s.id)])).toEqual([
      ['re-squat', ['s1']],
      ['re-bench', ['b1', 'b2']],
      ['re-curl', []],
    ]);
  });

  it('skips sets whose exercise is unknown', () => {
    expect(groupSessionSets([set({ routine_exercise_id: 'gone' })], [bench])).toEqual([{ exercise: bench, sets: [] }]);
  });
});

describe('draftNewSet', () => {
  const bench = exercise({ id: 're-bench', sets: 3 });

  it('fills the first prescribed set that is missing, starting from the last set logged', () => {
    const draft = draftNewSet(
      bench,
      [set({ set_index: 1, weight: 80, reps: 8, rir: 2 }), set({ set_index: 3, weight: 82.5, reps: 6, rir: 1 })],
      'sess',
      'new-id',
      '2026-11-19T12:00:00Z'
    );
    expect(draft).toEqual({
      id: 'new-id',
      session_id: 'sess',
      routine_exercise_id: 're-bench',
      set_index: 2,
      set_type: 'working',
      weight: 82.5,
      reps: 6,
      rir: 1,
      created_at: '2026-11-19T12:00:00Z',
      is_deleted: false,
    });
  });

  it('adds one past the last set once every prescribed set is logged', () => {
    const sets = [1, 2, 3].map((i) => set({ id: `s${i}`, set_index: i }));
    expect(draftNewSet(bench, sets, 'sess', 'n', 't').set_index).toBe(4);
  });

  it('starts an exercise with nothing logged at its first set, empty, with the routine RIR', () => {
    const draft = draftNewSet(exercise({ rir_min: 2 }), [], 'sess', 'n', 't');
    expect(draft).toMatchObject({ set_index: 1, set_type: 'working', weight: 0, reps: 0, rir: 2 });
  });

  it('follows a top set / back-off scheme', () => {
    const topSet = exercise({ scheme_type: 'top_set_backoff', sets: null, backoff_sets: 2 });
    expect(draftNewSet(topSet, [], 's', 'n', 't').set_type).toBe('top_set');
    expect(draftNewSet(topSet, [set({ set_index: 1, set_type: 'top_set' })], 's', 'n', 't')).toMatchObject({
      set_index: 2,
      set_type: 'back_off',
    });
    const full = [1, 2, 3].map((i) => set({ id: `s${i}`, set_index: i }));
    expect(draftNewSet(topSet, full, 's', 'n', 't')).toMatchObject({ set_index: 4, set_type: 'back_off' });
  });
});

describe('validateSetEdit', () => {
  const weighted = { rep_unit: 'reps' as const, rir_min: 1 };
  const plank = { rep_unit: 'seconds' as const, rir_min: null };
  const noRir = { rep_unit: 'reps' as const, rir_min: null };

  it('accepts valid values', () => {
    expect(validateSetEdit({ weight: '82.5', reps: '6', rir: 2 }, weighted)).toBeNull();
    expect(validateSetEdit({ weight: '0', reps: '12', rir: 0 }, weighted)).toBeNull();
  });

  it('rejects an empty or non-numeric weight', () => {
    expect(validateSetEdit({ weight: '', reps: '6', rir: 2 }, weighted)).toBe('Ingresá un peso válido.');
    expect(validateSetEdit({ weight: 'abc', reps: '6', rir: 2 }, weighted)).toBe('Ingresá un peso válido.');
    expect(validateSetEdit({ weight: 'Infinity', reps: '6', rir: 2 }, weighted)).toBe('Ingresá un peso válido.');
  });

  it('rejects a negative weight', () => {
    expect(validateSetEdit({ weight: '-5', reps: '6', rir: 2 }, weighted)).toBe('El peso no puede ser negativo.');
  });

  it('requires whole reps of at least 1', () => {
    expect(validateSetEdit({ weight: '80', reps: '0', rir: 2 }, weighted)).toBe(
      'Las reps tienen que ser un número entero mayor a 0.'
    );
    expect(validateSetEdit({ weight: '80', reps: '6.5', rir: 2 }, weighted)).toBe(
      'Las reps tienen que ser un número entero mayor a 0.'
    );
  });

  it('talks about seconds and ignores weight for time-based exercises', () => {
    expect(validateSetEdit({ weight: '', reps: '45', rir: null }, plank)).toBeNull();
    expect(validateSetEdit({ weight: '', reps: '0', rir: null }, plank)).toBe(
      'Los segundos tienen que ser un número entero mayor a 0.'
    );
  });

  it('requires an RIR in 0-10 only when the exercise has an RIR target', () => {
    expect(validateSetEdit({ weight: '80', reps: '6', rir: null }, weighted)).toBe('Elegí el RIR.');
    expect(validateSetEdit({ weight: '80', reps: '6', rir: 11 }, weighted)).toBe(
      'El RIR tiene que estar entre 0 y 10.'
    );
    expect(validateSetEdit({ weight: '80', reps: '6', rir: null }, noRir)).toBeNull();
  });
});

describe('editFromValues', () => {
  it('parses the values into an edit', () => {
    expect(editFromValues({ weight: '82.5', reps: '6', rir: 1 }, { rep_unit: 'reps', rir_min: 1 }, set({}))).toEqual({
      kind: 'edit',
      weight: 82.5,
      reps: 6,
      rir: 1,
    });
  });

  it('keeps the original weight for time-based exercises and the original RIR when none is shown', () => {
    expect(
      editFromValues(
        { weight: '999', reps: '50', rir: 3 },
        { rep_unit: 'seconds', rir_min: null },
        set({ weight: 0, rir: null })
      )
    ).toEqual({ kind: 'edit', weight: 0, reps: 50, rir: null });
  });
});

describe('buildCorrectionPayload', () => {
  const original = set({});

  it('sends the full row with the new values for an edit', () => {
    expect(buildCorrectionPayload(original, { kind: 'edit', weight: 70, reps: 10, rir: 3 })).toEqual({
      id: 's1',
      session_id: 'sess',
      routine_exercise_id: 're-bench',
      set_index: 1,
      set_type: 'working',
      weight: 70,
      reps: 10,
      rir: 3,
      created_at: '2026-10-01T18:00:00Z',
      is_deleted: false,
    });
  });

  it('sends the full row flagged deleted for a delete', () => {
    expect(buildCorrectionPayload(original, { kind: 'delete' })).toEqual({
      id: 's1',
      session_id: 'sess',
      routine_exercise_id: 're-bench',
      set_index: 1,
      set_type: 'working',
      weight: 80,
      reps: 8,
      rir: 2,
      created_at: '2026-10-01T18:00:00Z',
      is_deleted: true,
    });
  });
});

describe('applyCorrection', () => {
  const sets = [set({ id: 'a' }), set({ id: 'b', set_index: 2 })];

  it('updates the edited set in place without mutating the input', () => {
    const result = applyCorrection(sets, 'b', { kind: 'edit', weight: 60, reps: 12, rir: 1 });
    expect(result.find((s) => s.id === 'b')).toMatchObject({ weight: 60, reps: 12, rir: 1 });
    expect(sets.find((s) => s.id === 'b')).toMatchObject({ weight: 80, reps: 8, rir: 2 });
  });

  it('removes a deleted set', () => {
    expect(applyCorrection(sets, 'a', { kind: 'delete' }).map((s) => s.id)).toEqual(['b']);
  });
});
