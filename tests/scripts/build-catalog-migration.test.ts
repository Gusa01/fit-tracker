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

  it('merges old rows, then adds the uniqueness indexes, in that order', () => {
    const merge = sql.indexOf('update public.routine_exercises');
    const index = sql.indexOf('create unique index exercises_catalog_name_key');
    expect(merge).toBeGreaterThan(0);
    expect(index).toBeGreaterThan(merge);
  });
});
