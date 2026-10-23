import { SupabaseClient } from '@supabase/supabase-js';
import { RoutineExerciseRepUnit, RoutineExerciseSchemeType } from '../routines/types';
import { LoggedSet } from '../sessions/types';
import { HistoryExercise, HistorySessionRow, SessionDetail } from './types';
import { summarizeSession } from './logic';

export const HISTORY_PAGE_SIZE = 30;

// Raw row shapes of the selects below. The untyped client infers to-one relations (routine_days, exercises) as
// arrays, but PostgREST returns them as objects, so the casts go through unknown.

/** Raw row of the `workout_sessions` list select, with its joined relations. */
interface SessionListRow {
  id: string;
  session_date: string;
  routine_days: { name: string } | null;
  logged_sets: { routine_exercise_id: string; is_deleted: boolean }[] | null;
}

/** Raw row of the single-session select. */
interface SessionHeaderRow {
  id: string;
  session_date: string;
  routine_days: { name: string } | null;
}

/** Raw row of the `routine_exercises` select used by the session detail. */
interface HistoryExerciseRow {
  id: string;
  order_index: number;
  scheme_type: RoutineExerciseSchemeType;
  rep_unit: RoutineExerciseRepUnit;
  rir_min: number | null;
  exercises: { name: string } | null;
}

export async function listCompletedSessions(
  supabase: SupabaseClient,
  userId: string,
  page: number
): Promise<{ sessions: HistorySessionRow[]; hasMore: boolean }> {
  const from = page * HISTORY_PAGE_SIZE;
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, session_date, routine_days(name), logged_sets(routine_exercise_id, is_deleted)')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('session_date', { ascending: false })
    .order('id')
    .range(from, from + HISTORY_PAGE_SIZE - 1);
  if (error) throw error;

  const sessions = (data as unknown as SessionListRow[]).map((row): HistorySessionRow => ({
    id: row.id,
    sessionDate: row.session_date,
    dayName: row.routine_days?.name ?? '',
    ...summarizeSession(row.logged_sets ?? []),
  }));
  return { sessions, hasMore: sessions.length === HISTORY_PAGE_SIZE };
}

export async function getSessionDetail(supabase: SupabaseClient, sessionId: string): Promise<SessionDetail> {
  const { data, error: sessionError } = await supabase
    .from('workout_sessions')
    .select('id, session_date, routine_days(name)')
    .eq('id', sessionId)
    .single();
  if (sessionError) throw sessionError;
  const session = data as unknown as SessionHeaderRow;

  const { data: sets, error: setsError } = await supabase
    .from('logged_sets')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_deleted', false)
    .order('set_index');
  if (setsError) throw setsError;

  const exerciseIds = [...new Set((sets ?? []).map((s) => s.routine_exercise_id as string))];
  let exercises: HistoryExercise[] = [];
  if (exerciseIds.length > 0) {
    // No is_deleted filter: the history shows exercises later removed from the routine.
    const { data, error } = await supabase
      .from('routine_exercises')
      .select('id, order_index, scheme_type, rep_unit, rir_min, exercises(name)')
      .in('id', exerciseIds);
    if (error) throw error;
    exercises = (data as unknown as HistoryExerciseRow[]).map((e) => ({
      id: e.id,
      exercise_name: e.exercises?.name ?? '',
      order_index: e.order_index,
      scheme_type: e.scheme_type,
      rep_unit: e.rep_unit,
      rir_min: e.rir_min,
    }));
  }

  return {
    id: session.id,
    sessionDate: session.session_date,
    dayName: session.routine_days?.name ?? '',
    sets: (sets ?? []).map((s) => ({ ...s, weight: Number(s.weight), reps: Number(s.reps) }) as LoggedSet),
    exercises,
  };
}
