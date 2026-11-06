import { SupabaseClient } from '@supabase/supabase-js';

export interface PendingWrite {
  id: string;
  entity: 'workout_sessions' | 'logged_sets' | 'user_exercise_state';
  payload: Record<string, unknown>;
}

export interface FlushResult {
  succeededIds: string[];
  failedIds: string[];
  droppedIds: string[];
}

const CONFLICT_TARGETS: Partial<Record<PendingWrite['entity'], string>> = {
  user_exercise_state: 'user_id,exercise_id',
};

export async function flushPendingWrites(supabase: SupabaseClient, writes: PendingWrite[]): Promise<FlushResult> {
  const succeededIds: string[] = [];
  const failedIds: string[] = [];
  const droppedIds: string[] = [];
  const blockedRows = new Set<string>();
  for (const write of writes) {
    const rowId = typeof write.payload.id === 'string' ? write.payload.id : null;
    if (rowId && blockedRows.has(rowId)) continue;
    const onConflict = CONFLICT_TARGETS[write.entity];
    // The session screen's "finish" write is status-only. It can't be an upsert: Postgres rejects the
    // missing NOT NULL columns before it ever sees the existing row, so it has to be a plain update.
    const isStatusOnlySession = write.entity === 'workout_sessions' && rowId && !('user_id' in write.payload);
    const { error } = isStatusOnlySession
      ? await supabase.from(write.entity).update(write.payload).eq('id', rowId)
      : await supabase.from(write.entity).upsert(write.payload, onConflict ? { onConflict } : undefined);
    if (error) {
      if (write.entity === 'user_exercise_state' && error.code === '23503') {
        // The exercise no longer exists (catalog replaced); retrying can never succeed.
        droppedIds.push(write.id);
        continue;
      }
      failedIds.push(write.id);
      if (rowId) blockedRows.add(rowId);
    } else {
      succeededIds.push(write.id);
    }
  }
  return { succeededIds, failedIds, droppedIds };
}
