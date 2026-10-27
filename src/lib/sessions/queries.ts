import { SupabaseClient } from '@supabase/supabase-js';
import { Routine } from '../routines/types';
import { WorkoutSession, LoggedSet } from './types';

export async function getActiveRoutine(supabase: SupabaseClient, userId: string): Promise<Routine | null> {
  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSessionForDate(
  supabase: SupabaseClient,
  userId: string,
  dayId: string,
  sessionDate: string
): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('routine_day_id', dayId)
    .eq('session_date', sessionDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Which routine days were trained (started or finished) from `fromDate` on, for the "pending day" check. */
export async function listSessionsSince(
  supabase: SupabaseClient,
  userId: string,
  fromDate: string
): Promise<{ routineDayId: string; sessionDate: string }[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('routine_day_id, session_date')
    .eq('user_id', userId)
    .gte('session_date', fromDate);
  if (error) throw error;
  return (data as { routine_day_id: string; session_date: string }[]).map((row) => ({
    routineDayId: row.routine_day_id,
    sessionDate: row.session_date,
  }));
}

export async function listSessionSets(supabase: SupabaseClient, sessionId: string): Promise<LoggedSet[]> {
  const { data, error } = await supabase
    .from('logged_sets')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_deleted', false)
    .order('created_at');
  if (error) throw error;
  return data;
}

/** Raw row of the recent-sessions select, with its joined day. */
interface RecentSessionRow {
  id: string;
  session_date: string;
  routine_days: { name: string } | null;
}

export async function listRecentCompletedSessions(
  supabase: SupabaseClient,
  userId: string,
  limit = 30
): Promise<{ sessionId: string; sessionDate: string; dayName: string }[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, session_date, routine_days(name)')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('session_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  // routine_days is a to-one relation: the untyped client infers an array, PostgREST returns an object.
  return (data as unknown as RecentSessionRow[]).map((row) => ({
    sessionId: row.id,
    sessionDate: row.session_date,
    dayName: row.routine_days?.name ?? '',
  }));
}
