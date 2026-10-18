import { flushPendingWrites, PendingWrite } from '../../../src/lib/sync/flushQueue';

function fakeSupabase(behavior: (table: string, payload: Record<string, unknown>) => { error: unknown }) {
  const calls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      return {
        upsert(payload: Record<string, unknown>) {
          calls.push({ table, payload });
          return Promise.resolve(behavior(table, payload));
        },
      };
    },
  };
  return { client, calls };
}

describe('flushPendingWrites ordering per row', () => {
  it('skips later writes for an id whose earlier write failed, leaving them queued', async () => {
    const { client, calls } = fakeSupabase(() => ({ error: { message: 'network' } }));
    const writes: PendingWrite[] = [
      { id: 'q1', entity: 'logged_sets', payload: { id: 'X', weight: 50 } },
      { id: 'q2', entity: 'logged_sets', payload: { id: 'X', weight: 60 } },
    ];
    const result = await flushPendingWrites(client as any, writes);
    expect(calls).toHaveLength(1);
    expect(result).toEqual({ succeededIds: [], failedIds: ['q1'], droppedIds: [] });
  });

  it('still runs writes for other ids after a failure', async () => {
    const { client, calls } = fakeSupabase((_t, payload) => ({ error: payload.id === 'X' ? { message: 'x' } : null }));
    const writes: PendingWrite[] = [
      { id: 'q1', entity: 'logged_sets', payload: { id: 'X', weight: 50 } },
      { id: 'q2', entity: 'logged_sets', payload: { id: 'Y', weight: 60 } },
      { id: 'q3', entity: 'logged_sets', payload: { id: 'X', weight: 70 } },
    ];
    const result = await flushPendingWrites(client as any, writes);
    expect(calls.map((c) => c.payload.id)).toEqual(['X', 'Y']);
    expect(result).toEqual({ succeededIds: ['q2'], failedIds: ['q1'], droppedIds: [] });
  });

  it('runs a later write for the same id when the earlier one succeeded', async () => {
    const { client, calls } = fakeSupabase(() => ({ error: null }));
    const writes: PendingWrite[] = [
      { id: 'q1', entity: 'logged_sets', payload: { id: 'X', weight: 50 } },
      { id: 'q2', entity: 'logged_sets', payload: { id: 'X', weight: 60 } },
    ];
    const result = await flushPendingWrites(client as any, writes);
    expect(calls).toHaveLength(2);
    expect(result).toEqual({ succeededIds: ['q1', 'q2'], failedIds: [], droppedIds: [] });
  });

  it('drops a user_exercise_state write that fails with an FK violation', async () => {
    const { client } = fakeSupabase(() => ({ error: { code: '23503', message: 'fk' } }));
    const writes: PendingWrite[] = [{ id: 'q1', entity: 'user_exercise_state', payload: { exercise_id: 'gone' } }];
    const result = await flushPendingWrites(client as any, writes);
    expect(result).toEqual({ succeededIds: [], failedIds: [], droppedIds: ['q1'] });
  });

  it('keeps an FK violation on logged_sets as failed', async () => {
    const { client } = fakeSupabase(() => ({ error: { code: '23503', message: 'fk' } }));
    const writes: PendingWrite[] = [{ id: 'q1', entity: 'logged_sets', payload: { id: 'X' } }];
    const result = await flushPendingWrites(client as any, writes);
    expect(result).toEqual({ succeededIds: [], failedIds: ['q1'], droppedIds: [] });
  });

  it('keeps other user_exercise_state errors as failed', async () => {
    const { client } = fakeSupabase(() => ({ error: { code: '08006', message: 'net' } }));
    const writes: PendingWrite[] = [{ id: 'q1', entity: 'user_exercise_state', payload: { exercise_id: 'e' } }];
    const result = await flushPendingWrites(client as any, writes);
    expect(result).toEqual({ succeededIds: [], failedIds: ['q1'], droppedIds: [] });
  });
});
