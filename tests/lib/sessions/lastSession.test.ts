import { lastSessionSets } from '../../../src/lib/sessions/lastSession';
import { ExerciseSetRow } from '../../../src/lib/progress/types';

function row(overrides: Partial<ExerciseSetRow>): ExerciseSetRow {
  return {
    logged_set_id: 'ls',
    user_id: 'u1',
    exercise_id: 'bench',
    exercise_name: 'Press banca',
    rep_unit: 'reps',
    session_id: 's1',
    session_date: '2026-11-02',
    set_index: 1,
    set_type: 'working',
    weight: 60,
    reps: 10,
    created_at: '2026-11-02T10:00:00Z',
    ...overrides,
  };
}

describe('lastSessionSets', () => {
  it('returns nothing without history', () => {
    expect(lastSessionSets([])).toEqual([]);
  });

  it('keeps only the most recent session per exercise, every set of it', () => {
    const result = lastSessionSets([
      row({ logged_set_id: 'a', session_id: 'old', session_date: '2026-10-26', weight: 55 }),
      row({ logged_set_id: 'b', session_id: 'new', session_date: '2026-11-02', set_index: 1, weight: 60 }),
      row({ logged_set_id: 'c', session_id: 'new', session_date: '2026-11-02', set_index: 2, weight: 60, reps: 9 }),
    ]);
    expect(result.map((s) => s.logged_set_id)).toEqual(['b', 'c']);
    expect(result[1]).toEqual({
      exercise_id: 'bench',
      set_index: 2,
      session_date: '2026-11-02',
      weight: 60,
      reps: 9,
      logged_set_id: 'c',
    });
  });

  it('picks the later session when two share a date', () => {
    const result = lastSessionSets([
      row({ logged_set_id: 'morning', session_id: 'am', created_at: '2026-11-02T09:00:00Z' }),
      row({ logged_set_id: 'evening', session_id: 'pm', created_at: '2026-11-02T19:00:00Z' }),
    ]);
    expect(result.map((s) => s.logged_set_id)).toEqual(['evening']);
  });

  it('tracks each exercise on its own, even when trained in different sessions', () => {
    const result = lastSessionSets([
      row({ logged_set_id: 'bench', exercise_id: 'bench', session_id: 'mon', session_date: '2026-11-02' }),
      row({ logged_set_id: 'row-old', exercise_id: 'row', session_id: 'mon', session_date: '2026-11-02' }),
      row({ logged_set_id: 'row-new', exercise_id: 'row', session_id: 'wed', session_date: '2026-11-04' }),
    ]);
    expect(result.map((s) => s.logged_set_id).sort()).toEqual(['bench', 'row-new']);
  });
});
