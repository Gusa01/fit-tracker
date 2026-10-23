import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '../../helpers/supabaseAdmin';

const admin = createAdminClient();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const NAMES = {
  alias: 'Sentadilla (o Prensa)', // alias of the catalog "Sentadilla con barra"
  soloA: '[test-fixture] Solo de A',
  shared: '[test-fixture] Compartido',
  junk: '[test-fixture] Basura',
};

async function createUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'testpassword123',
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

async function insertLegacy(name: string) {
  const { data, error } = await admin
    .from('exercises')
    .insert({ name, primary_muscle: 'chest', equipment: 'bodyweight' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function addRoutineExercise(userId: string, exerciseId: string) {
  const { data: routine, error: e1 } = await admin
    .from('routines')
    .insert({ user_id: userId, name: `Legacy merge ${Date.now()}${Math.random()}`, uses_top_set_backoff: false })
    .select('id')
    .single();
  if (e1) throw e1;
  const { data: day, error: e2 } = await admin
    .from('routine_days')
    .insert({ routine_id: routine.id, name: 'Día Test', order_index: 0 })
    .select('id')
    .single();
  if (e2) throw e2;
  const { data: re, error: e3 } = await admin
    .from('routine_exercises')
    .insert({
      routine_day_id: day.id,
      exercise_id: exerciseId,
      order_index: 0,
      role: 'main',
      scheme_type: 'normal',
      sets: 3,
      rep_min: 8,
      rep_max: 10,
    })
    .select('id')
    .single();
  if (e3) throw e3;
  return re.id as string;
}

async function addState(userId: string, exerciseId: string, updatedAt: string, weight: number) {
  const { error } = await admin
    .from('user_exercise_state')
    .insert({ user_id: userId, exercise_id: exerciseId, current_weight: weight, updated_at: updatedAt });
  if (error) throw error;
}

describe('merge_legacy_exercises', () => {
  const suffix = Date.now();
  let userA: string;
  let userB: string;
  let catalogId: string;
  let legacyAlias: string;
  let soloA: string;
  let shared: string;
  let junk: string;
  let reAlias: string;

  beforeAll(async () => {
    userA = await createUser(`legacy-a-${suffix}@example.com`);
    userB = await createUser(`legacy-b-${suffix}@example.com`);

    const { data: cat, error } = await admin.from('exercises').select('id').eq('slug', 'barbell-squat').single();
    if (error) throw error;
    catalogId = cat.id;

    legacyAlias = await insertLegacy(NAMES.alias);
    soloA = await insertLegacy(NAMES.soloA);
    shared = await insertLegacy(NAMES.shared);
    junk = await insertLegacy(NAMES.junk);

    reAlias = await addRoutineExercise(userA, legacyAlias);
    await addState(userA, legacyAlias, '2026-10-10T00:00:00Z', 100); // newer
    await addState(userA, catalogId, '2026-01-01T00:00:00Z', 60); // older
    await addRoutineExercise(userA, soloA);
    await addRoutineExercise(userA, shared);
    await addRoutineExercise(userB, shared);

    const { error: rpcError } = await admin.rpc('merge_legacy_exercises');
    if (rpcError) throw rpcError;
  });

  afterAll(async () => {
    // Deleting the users cascades their routines; the shared row can only go after that.
    await admin.auth.admin.deleteUser(userA);
    await admin.auth.admin.deleteUser(userB);
    await admin.from('exercises').delete().eq('id', shared);
  });

  it('merges an alias-matched legacy row into the catalog, keeping the newer progression state', async () => {
    const { data: re } = await admin.from('routine_exercises').select('exercise_id').eq('id', reAlias).single();
    expect(re!.exercise_id).toBe(catalogId);

    const { data: gone } = await admin.from('exercises').select('id').eq('id', legacyAlias);
    expect(gone).toHaveLength(0);

    const { data: states } = await admin
      .from('user_exercise_state')
      .select('current_weight')
      .eq('user_id', userA)
      .eq('exercise_id', catalogId);
    expect(states).toHaveLength(1);
    expect(Number(states![0].current_weight)).toBe(100);
  });

  it('makes an unmapped row used by one user private to them', async () => {
    const { data } = await admin.from('exercises').select('owner_id').eq('id', soloA).single();
    expect(data!.owner_id).toBe(userA);
  });

  it('keeps an unmapped row used by several users shared', async () => {
    const { data } = await admin.from('exercises').select('owner_id').eq('id', shared).single();
    expect(data!.owner_id).toBeNull();
  });

  it('deletes an unreferenced unmapped row', async () => {
    const { data } = await admin.from('exercises').select('id').eq('id', junk);
    expect(data).toHaveLength(0);
  });

  it('is not callable by a signed-in user', async () => {
    const email = `legacy-c-${suffix}@example.com`;
    const userC = await createUser(email);
    try {
      const client = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password: 'testpassword123' });
      if (signInError) throw signInError;
      const { error } = await client.rpc('merge_legacy_exercises');
      expect(error).not.toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(userC);
    }
  });
});
