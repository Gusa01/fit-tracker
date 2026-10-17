import catalog from '../../supabase/catalog/exercises.json';
import { MUSCLES, EQUIPMENT } from '../../src/lib/exercises/taxonomy';
import { normalizeText } from '../../src/lib/exercises/search';
import { LEGACY_EXERCISE_NAMES } from '../fixtures/legacyExerciseNames';

interface Entry {
  slug: string;
  name: string;
  aliases: string[];
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string;
  source_id: string | null;
  image: { url: string; author: string; license: string; source_url: string } | null;
}
const entries = catalog as Entry[];

describe('exercise catalog data', () => {
  it('has 150 to 200 entries', () => {
    expect(entries.length).toBeGreaterThanOrEqual(150);
    expect(entries.length).toBeLessThanOrEqual(200);
  });

  it('has unique kebab-case slugs and unique names', () => {
    const slugs = entries.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    slugs.forEach((s) => expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
    const names = entries.map((e) => normalizeText(e.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses only known muscles and equipment', () => {
    for (const e of entries) {
      expect(MUSCLES).toContain(e.primary_muscle);
      e.secondary_muscles.forEach((m) => expect(MUSCLES).toContain(m));
      expect(e.secondary_muscles).not.toContain(e.primary_muscle);
      expect(EQUIPMENT).toContain(e.equipment);
    }
  });

  it('covers every muscle group with at least 3 exercises', () => {
    for (const m of MUSCLES) {
      expect(entries.filter((e) => e.primary_muscle === m).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('never gives one alias (or name) to two entries', () => {
    const owner = new Map<string, string>();
    for (const e of entries) {
      for (const n of [e.name, ...e.aliases].map(normalizeText)) {
        const prev = owner.get(n);
        expect(prev === undefined || prev === e.slug).toBe(true);
        owner.set(n, e.slug);
      }
    }
  });

  it('resolves every legacy name to its required target', () => {
    for (const legacy of LEGACY_EXERCISE_NAMES) {
      const key = normalizeText(legacy.name);
      const match = entries.find((e) => [e.name, ...e.aliases].map(normalizeText).includes(key));
      expect({ legacy: legacy.name, resolved: match?.name }).toEqual({ legacy: legacy.name, resolved: legacy.target });
    }
  });

  it('matches every legacy name exactly under lower() (the SQL merge does not strip accents)', () => {
    for (const legacy of LEGACY_EXERCISE_NAMES) {
      const target = entries.find((e) => e.name === legacy.target);
      const lower = legacy.name.toLowerCase();
      const hit = [target?.name, ...(target?.aliases ?? [])].some((n) => n?.toLowerCase() === lower);
      expect({ legacy: legacy.name, hit }).toEqual({ legacy: legacy.name, hit: true });
    }
  });

  it('only carries credited Creative Commons images', () => {
    for (const e of entries.filter((x) => x.image)) {
      expect(e.image!.url).toMatch(/^https:\/\/wger\.de\/media\//);
      expect(e.image!.license).toMatch(/^CC-BY-SA [34]$|^CC-BY 4$|^CC0$/);
      expect(e.image!.author.length).toBeGreaterThan(0);
      expect(e.image!.source_url).toMatch(/^https:\/\/wger\.de\//);
    }
  });
});
