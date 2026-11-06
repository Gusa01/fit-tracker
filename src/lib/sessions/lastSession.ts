import { ExerciseSetRow } from '../progress/types';

export interface LastSessionSet {
  exercise_id: string;
  set_index: number;
  session_date: string;
  weight: number;
  reps: number;
  logged_set_id: string;
}

/**
 * Each exercise's sets from the most recent completed session that included it, across every routine
 * (history is keyed by the catalog exercise). The view already drops warmups and deleted sets.
 */
export function lastSessionSets(history: ExerciseSetRow[]): LastSessionSet[] {
  const latest = new Map<string, { sessionId: string; date: string; createdAt: string }>();
  for (const row of history) {
    const current = latest.get(row.exercise_id);
    if (
      !current ||
      row.session_date > current.date ||
      (row.session_date === current.date && row.created_at > current.createdAt)
    ) {
      latest.set(row.exercise_id, { sessionId: row.session_id, date: row.session_date, createdAt: row.created_at });
    }
  }
  return history
    .filter((row) => latest.get(row.exercise_id)?.sessionId === row.session_id)
    .map((row) => ({
      exercise_id: row.exercise_id,
      set_index: row.set_index,
      session_date: row.session_date,
      weight: row.weight,
      reps: row.reps,
      logged_set_id: row.logged_set_id,
    }));
}
