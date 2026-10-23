import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '../../helpers/supabaseAdmin';
import { findOrCreateExercise } from '../../../src/lib/routines/mutations';

const admin = createAdminClient();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const PASSWORD = 'testpassword123';
const createdUserIds: string[] = [];

async function signedInUser(prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { client, userId: data.user.id };
}

afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
});

describe('researched exercise catalog', () => {
  it('seeds 150-200 catalog rows with a generated muscle_group', async () => {
    const { data, error } = await admin
      .from('exercises')
      .select('slug, primary_muscle, muscle_group')
      .not('slug', 'is', null);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(150);
    expect(data!.length).toBeLessThanOrEqual(200);
    for (const row of data!) {
      const lower = ['quadriceps', 'hamstrings', 'glutes', 'adductors_abductors', 'calves'].includes(
        row.primary_muscle
      );
      expect(row.muscle_group).toBe(row.primary_muscle === 'core' ? 'core' : lower ? 'lower' : 'upper');
    }
  });

  it('resolves an importer alias to the catalog row instead of creating one', async () => {
    const { userId } = await signedInUser('catalog-alias');
    const viaAlias = await findOrCreateExercise(admin, {
      name: 'press banca',
      primaryMuscle: 'chest',
      equipment: 'bodyweight',
      ownerId: userId,
    });
    expect(viaAlias.slug).not.toBeNull();
    expect(viaAlias.name).toBe('Press banca con barra');
  });

  it('keeps custom exercises private to their owner', async () => {
    const a = await signedInUser('catalog-owner-a');
    const b = await signedInUser('catalog-owner-b');
    const custom = await findOrCreateExercise(a.client, {
      name: 'Ejercicio inventado A',
      primaryMuscle: 'core',
      equipment: 'bodyweight',
      ownerId: a.userId,
    });
    expect(custom.owner_id).toBe(a.userId);

    const { data: seenByA } = await a.client.from('exercises').select('id').eq('id', custom.id);
    const { data: seenByB } = await b.client.from('exercises').select('id').eq('id', custom.id);
    expect(seenByA).toHaveLength(1);
    expect(seenByB).toHaveLength(0);
  });

  it("refuses a signed-in user writing a catalog row or another user's row", async () => {
    const a = await signedInUser('catalog-write-a');
    const b = await signedInUser('catalog-write-b');
    const { error: catalogError } = await a.client
      .from('exercises')
      .insert({ name: 'Intento catálogo', primary_muscle: 'core', equipment: 'bodyweight', owner_id: null });
    expect(catalogError).not.toBeNull();
    const { error: otherError } = await a.client
      .from('exercises')
      .insert({ name: 'Intento ajeno', primary_muscle: 'core', equipment: 'bodyweight', owner_id: b.userId });
    expect(otherError).not.toBeNull();
  });

  it('lets two users own custom exercises with the same name', async () => {
    const a = await signedInUser('catalog-same-a');
    const b = await signedInUser('catalog-same-b');
    const one = await findOrCreateExercise(a.client, {
      name: 'Mismo nombre',
      primaryMuscle: 'core',
      equipment: 'bodyweight',
      ownerId: a.userId,
    });
    const two = await findOrCreateExercise(b.client, {
      name: 'Mismo nombre',
      primaryMuscle: 'core',
      equipment: 'bodyweight',
      ownerId: b.userId,
    });
    expect(one.id).not.toBe(two.id);
  });
});
