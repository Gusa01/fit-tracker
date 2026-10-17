import { buildCatalogSeedSql } from '../../scripts/build-catalog-migration';

const entry = {
  slug: 'barbell-bench-press',
  name: "Press banca con barra",
  aliases: ['Press banca', "O'Brien's press"],
  primary_muscle: 'chest',
  secondary_muscles: ['triceps', 'shoulders'],
  equipment: 'barbell',
  source_id: 'Barbell_Bench_Press',
  image: { url: 'https://wger.de/media/exercise-images/1/bench.png', author: 'Jane', license: 'CC-BY-SA 4', source_url: 'https://wger.de/exercise/1/' },
};

describe('buildCatalogSeedSql', () => {
  const sql = buildCatalogSeedSql([entry, { ...entry, slug: 'plank', name: 'Plancha abdominal', aliases: [], image: null }]);

  it('upserts every entry by slug', () => {
    expect(sql).toContain('on conflict (slug) do update');
    expect(sql).toContain("'barbell-bench-press'");
    expect(sql).toContain("'plank'");
  });

  it("escapes single quotes", () => {
    expect(sql).toContain("'O''Brien''s press'");
  });

  it('writes the image path from the slug and the url extension, with its credit', () => {
    expect(sql).toContain("'barbell-bench-press.png'");
    expect(sql).toContain('"author": "Jane"');
  });

  it('writes null image fields when there is no image', () => {
    expect(sql).toMatch(/'plank'[\s\S]*?null,\s*null/);
  });

  it('defines the merge as a service-only function, calls it, then adds the uniqueness indexes', () => {
    const define = sql.indexOf('create or replace function public.merge_legacy_exercises()');
    const revoke = sql.indexOf('revoke all on function public.merge_legacy_exercises() from public, anon, authenticated');
    const call = sql.indexOf('select public.merge_legacy_exercises();');
    const index = sql.indexOf('create unique index exercises_catalog_name_key');
    expect(define).toBeGreaterThan(0);
    expect(revoke).toBeGreaterThan(define);
    expect(call).toBeGreaterThan(revoke);
    expect(index).toBeGreaterThan(call);
    expect(sql).toContain('update public.routine_exercises');
    expect(sql).toContain('security definer set search_path = public');
  });

  it('counts routine and progression-state references when privatizing leftovers', () => {
    expect(sql).toContain('select s.exercise_id, s.user_id from public.user_exercise_state s');
  });
});
