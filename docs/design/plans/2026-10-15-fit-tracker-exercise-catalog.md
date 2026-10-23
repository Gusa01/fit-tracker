# Researched Exercise Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 63-row ad-hoc exercise catalog with a researched, curated catalog of 150–200 exercises in Spanish (12 muscle groups, 9 equipment types, aliases, wger illustrations), merge the importer's near-duplicates into it, and make user-created exercises private.

**Architecture:** A committed data file (`supabase/catalog/exercises.json`) is the single source of truth; a generator turns it into a seed migration that upserts by slug, merges old rows into catalog rows through name/alias matching, and only then adds the new uniqueness rules. `muscle_group` becomes a generated column so progression code is untouched. Search, filtering and "find or create" share one pure normalization module; images live in a public storage bucket uploaded by a one-off script.

**Tech Stack:** Supabase Postgres (generated columns, RLS, storage), supabase-js v2, Expo / React Native, Jest + ts-jest, tsx scripts.

**Spec:** `docs/design/specs/2026-10-15-fit-tracker-exercise-catalog-design.md`

## Global Constraints

- Work in `B:\Gusa\Dev\fit-tracker` on branch `exercise-catalog`. Do not switch branches or push.
- Muscle keys and Spanish labels exactly: `chest` Pecho, `back` Espalda, `shoulders` Hombros, `biceps` Bíceps, `triceps` Tríceps, `forearms` Antebrazos, `quadriceps` Cuádriceps, `hamstrings` Isquiotibiales, `glutes` Glúteos, `adductors_abductors` Aductores/abductores, `calves` Gemelos, `core` Core.
- Equipment keys and labels exactly: `barbell` Barra, `dumbbell` Mancuernas, `machine` Máquina, `cable` Polea, `bodyweight` Peso corporal, `kettlebell` Kettlebell, `ez_bar` Barra EZ, `smith` Máquina Smith, `band` Banda elástica.
- Derived `muscle_group`: chest/back/shoulders/biceps/triceps/forearms → `upper`; quadriceps/hamstrings/glutes/adductors_abductors/calves → `lower`; core → `core`.
- Storage bucket `exercise-images` (public read); object name `<slug>.<ext>`.
- Custom exercises are private: `owner_id = auth.uid()`; catalog rows have `owner_id` null and are written only by migrations/service role.
- Catalog size 150–200 entries. Source: free-exercise-db (Unlicense). Images: wger (CC-BY-SA 3/4), AI-generated allowed, at most one per exercise, credited.
- All user-facing copy is Spanish (rioplatense), exactly as written in this plan.
- Every commit message ends with a `Co-Authored-By:` trailer naming the model that wrote it (per that agent's harness).
- Never run integration tests or anything against the hosted Supabase project, and never run `npx supabase db push` or the image upload script: the controller does those with the user's approval. Integration tests run in CI.
- Verification: `npm run typecheck`, `npm run test:unit`, `npx jest <path>`.

## Review Focus

1. A legacy exercise name with different case or accents than its alias (e.g. "press banca" vs "Press banca") → still merges/matches: pinned by `findMatchingExercise` tests in Task 1 and the alias-coverage test in Task 2.
2. A user who has state rows for two old duplicates that merge into one catalog exercise → one state row survives (latest `updated_at`), no unique violation: pinned in Task 4.
3. Inserting into `muscle_group` after it becomes generated (old test helpers, scripts) → no code path still writes it: pinned by Task 5's typecheck + grep step.
4. An exercise image missing from storage (upload not run yet) → the UI falls back to the muscle icon instead of a broken image: pinned in Task 8 (onError fallback).
5. Two catalog entries claiming the same alias → the importer can't pick one: pinned by the data validation test in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/exercises/taxonomy.ts` (create) | muscle/equipment keys, labels, `muscleGroupFor`, free-exercise-db mapping |
| `src/lib/exercises/search.ts` (create) | `normalizeText`, `exerciseMatchesQuery`, `filterExercises`, `findMatchingExercise` |
| `src/lib/exercises/images.ts` (create) | public URL for an image path |
| `supabase/catalog/exercises.json` (create) | curated catalog data |
| `tests/fixtures/legacyExerciseNames.ts` (create) | every old catalog/importer name and its required target |
| `scripts/build-catalog-migration.ts` (create) | data file → seed SQL |
| `supabase/migrations/20261015120000_exercise_catalog_schema.sql` (create) | columns, generated column, RLS, bucket |
| `supabase/migrations/20261015120100_seed_exercise_catalog.sql` (generated) | upsert catalog, merge, uniqueness |
| `scripts/upload-exercise-images.ts` (create) | download wger images → storage |
| `src/lib/routines/types.ts`, `queries.ts`, `mutations.ts` (modify) | new `Exercise` shape, alias-aware `findOrCreateExercise` |
| `scripts/import-routine.ts` (modify) | use the shared `findOrCreateExercise` |
| `src/lib/sqlite/schema.ts`, `cache.ts` (modify) | cache `image_path` |
| `src/components/ExercisePicker.tsx`, `ExerciseForm.tsx`, `DayExercisesSection.tsx`, `ExerciseThumbnail.tsx` (new), `SessionExerciseCard.tsx` (modify) | UI |
| `app/(app)/credits.tsx` (create), `app/(app)/settings.tsx`, `app/(app)/_layout.tsx` (modify) | credits screen |
| `.github/workflows/ci.yml` (modify) | keep storage-api in the CI stack |

---

### Task 1: Exercise taxonomy and search (pure)

**Files:**
- Create: `src/lib/exercises/taxonomy.ts`, `src/lib/exercises/search.ts`
- Test: `tests/lib/exercises/taxonomy.test.ts`, `tests/lib/exercises/search.test.ts`

**Interfaces:**
- Produces:
  - `MUSCLES: readonly Muscle[]`, `type Muscle = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'quadriceps' | 'hamstrings' | 'glutes' | 'adductors_abductors' | 'calves' | 'core'`, `MUSCLE_LABEL: Record<Muscle, string>`
  - `EQUIPMENT: readonly Equipment[]`, `type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'ez_bar' | 'smith' | 'band'`, `EQUIPMENT_LABEL: Record<Equipment, string>`
  - `muscleGroupFor(muscle: Muscle): 'upper' | 'lower' | 'core'`
  - `mapFreeDbMuscle(name: string): Muscle | null`
  - `interface SearchableExercise { id: string; name: string; aliases: string[]; primary_muscle: string; equipment: string; owner_id: string | null }`
  - `normalizeText(text: string): string`, `exerciseMatchesQuery(e: SearchableExercise, query: string): boolean`, `filterExercises<T extends SearchableExercise>(list: T[], f: { query: string; muscle: Muscle | null; equipment: Equipment | null }): T[]`, `findMatchingExercise<T extends SearchableExercise>(list: T[], name: string, ownerId: string | null): T | null`

- [ ] **Step 1: Write the failing tests**

`tests/lib/exercises/taxonomy.test.ts`:

```typescript
import {
  MUSCLES,
  MUSCLE_LABEL,
  EQUIPMENT,
  EQUIPMENT_LABEL,
  muscleGroupFor,
  mapFreeDbMuscle,
} from '../../../src/lib/exercises/taxonomy';

describe('taxonomy', () => {
  it('lists the 12 muscles and 9 equipment types with Spanish labels', () => {
    expect(MUSCLES).toHaveLength(12);
    expect(EQUIPMENT).toHaveLength(9);
    expect(MUSCLE_LABEL.hamstrings).toBe('Isquiotibiales');
    expect(MUSCLE_LABEL.adductors_abductors).toBe('Aductores/abductores');
    expect(EQUIPMENT_LABEL.cable).toBe('Polea');
    expect(EQUIPMENT_LABEL.smith).toBe('Máquina Smith');
  });

  it('derives the progression group from the primary muscle', () => {
    expect(muscleGroupFor('chest')).toBe('upper');
    expect(muscleGroupFor('forearms')).toBe('upper');
    expect(muscleGroupFor('glutes')).toBe('lower');
    expect(muscleGroupFor('calves')).toBe('lower');
    expect(muscleGroupFor('core')).toBe('core');
  });

  it('maps free-exercise-db muscles onto the 12 groups', () => {
    expect(mapFreeDbMuscle('lats')).toBe('back');
    expect(mapFreeDbMuscle('middle back')).toBe('back');
    expect(mapFreeDbMuscle('lower back')).toBe('back');
    expect(mapFreeDbMuscle('traps')).toBe('back');
    expect(mapFreeDbMuscle('abdominals')).toBe('core');
    expect(mapFreeDbMuscle('abductors')).toBe('adductors_abductors');
    expect(mapFreeDbMuscle('quadriceps')).toBe('quadriceps');
    expect(mapFreeDbMuscle('neck')).toBeNull();
    expect(mapFreeDbMuscle('unknown')).toBeNull();
  });
});
```

`tests/lib/exercises/search.test.ts`:

```typescript
import {
  normalizeText,
  exerciseMatchesQuery,
  filterExercises,
  findMatchingExercise,
  SearchableExercise,
} from '../../../src/lib/exercises/search';

function ex(overrides: Partial<SearchableExercise>): SearchableExercise {
  return {
    id: 'bench',
    name: 'Press banca con barra',
    aliases: ['Press banca', 'Press plano', 'Bench press'],
    primary_muscle: 'chest',
    equipment: 'barbell',
    owner_id: null,
    ...overrides,
  };
}

const catalog = [
  ex({}),
  ex({ id: 'curl', name: 'Curl martillo', aliases: ['Hammer curl'], primary_muscle: 'biceps', equipment: 'dumbbell' }),
  ex({ id: 'pallof', name: 'Pallof press', aliases: ['Anti-rotación'], primary_muscle: 'core', equipment: 'cable' }),
];

describe('normalizeText', () => {
  it('lowercases, strips accents and collapses whitespace', () => {
    expect(normalizeText('  Extensión   de Tríceps ')).toBe('extension de triceps');
    expect(normalizeText('ANTI-ROTACIÓN')).toBe('anti-rotacion');
  });
});

describe('exerciseMatchesQuery', () => {
  it('matches name or alias substrings, ignoring case and accents', () => {
    expect(exerciseMatchesQuery(catalog[0], 'press plano')).toBe(true);
    expect(exerciseMatchesQuery(catalog[0], 'BENCH')).toBe(true);
    expect(exerciseMatchesQuery(catalog[2], 'anti rotacion')).toBe(false); // hyphen is part of the alias
    expect(exerciseMatchesQuery(catalog[2], 'anti-rotacion')).toBe(true);
    expect(exerciseMatchesQuery(catalog[1], 'press')).toBe(false);
  });

  it('matches everything for an empty query', () => {
    expect(exerciseMatchesQuery(catalog[1], '  ')).toBe(true);
  });
});

describe('filterExercises', () => {
  it('combines query, muscle and equipment', () => {
    expect(filterExercises(catalog, { query: '', muscle: 'chest', equipment: null }).map((e) => e.id)).toEqual(['bench']);
    expect(filterExercises(catalog, { query: 'press', muscle: null, equipment: 'cable' }).map((e) => e.id)).toEqual(['pallof']);
    expect(filterExercises(catalog, { query: '', muscle: 'chest', equipment: 'dumbbell' })).toEqual([]);
  });
});

describe('findMatchingExercise', () => {
  const mine = ex({ id: 'mine', name: 'Mi ejercicio raro', aliases: [], owner_id: 'u1' });
  const theirs = ex({ id: 'theirs', name: 'Otro raro', aliases: [], owner_id: 'u2' });

  it('finds a catalog exercise by exact name or alias, ignoring case and accents', () => {
    expect(findMatchingExercise(catalog, 'press banca', 'u1')?.id).toBe('bench');
    expect(findMatchingExercise(catalog, 'ANTI-ROTACIÓN', 'u1')?.id).toBe('pallof');
  });

  it('does not match on a mere substring', () => {
    expect(findMatchingExercise(catalog, 'press', 'u1')).toBeNull();
  });

  it("matches the caller's own custom exercises but never someone else's", () => {
    expect(findMatchingExercise([...catalog, mine, theirs], 'mi ejercicio raro', 'u1')?.id).toBe('mine');
    expect(findMatchingExercise([...catalog, mine, theirs], 'otro raro', 'u1')).toBeNull();
  });

  it('prefers a catalog exercise over a custom one with the same name', () => {
    const shadow = ex({ id: 'shadow', name: 'Press banca', aliases: [], owner_id: 'u1' });
    expect(findMatchingExercise([shadow, ...catalog], 'Press banca', 'u1')?.id).toBe('bench');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest tests/lib/exercises`
Expected: FAIL, cannot find modules.

- [ ] **Step 3: Implement**

`src/lib/exercises/taxonomy.ts`:

```typescript
export const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'adductors_abductors',
  'calves',
  'core',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  quadriceps: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  adductors_abductors: 'Aductores/abductores',
  calves: 'Gemelos',
  core: 'Core',
};

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'ez_bar', 'smith', 'band'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barra',
  dumbbell: 'Mancuernas',
  machine: 'Máquina',
  cable: 'Polea',
  bodyweight: 'Peso corporal',
  kettlebell: 'Kettlebell',
  ez_bar: 'Barra EZ',
  smith: 'Máquina Smith',
  band: 'Banda elástica',
};

const LOWER: ReadonlySet<Muscle> = new Set(['quadriceps', 'hamstrings', 'glutes', 'adductors_abductors', 'calves']);

/** Mirrors the generated `exercises.muscle_group` column (used for weight increments). */
export function muscleGroupFor(muscle: Muscle): 'upper' | 'lower' | 'core' {
  if (muscle === 'core') return 'core';
  return LOWER.has(muscle) ? 'lower' : 'upper';
}

const FREE_DB_MUSCLE: Record<string, Muscle | null> = {
  chest: 'chest',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  adductors: 'adductors_abductors',
  abductors: 'adductors_abductors',
  calves: 'calves',
  abdominals: 'core',
  neck: null,
};

export function mapFreeDbMuscle(name: string): Muscle | null {
  return FREE_DB_MUSCLE[name] ?? null;
}

export function isMuscle(value: string): value is Muscle {
  return (MUSCLES as readonly string[]).includes(value);
}

export function isEquipment(value: string): value is Equipment {
  return (EQUIPMENT as readonly string[]).includes(value);
}
```

`src/lib/exercises/search.ts`:

```typescript
import { Equipment, Muscle } from './taxonomy';

export interface SearchableExercise {
  id: string;
  name: string;
  aliases: string[];
  primary_muscle: string;
  equipment: string;
  owner_id: string | null;
}

/** Lowercase, accents removed, whitespace collapsed — used everywhere names are compared. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function namesOf(exercise: SearchableExercise): string[] {
  return [exercise.name, ...exercise.aliases].map(normalizeText);
}

export function exerciseMatchesQuery(exercise: SearchableExercise, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return namesOf(exercise).some((n) => n.includes(q));
}

export function filterExercises<T extends SearchableExercise>(
  list: T[],
  filter: { query: string; muscle: Muscle | null; equipment: Equipment | null }
): T[] {
  return list.filter(
    (e) =>
      (!filter.muscle || e.primary_muscle === filter.muscle) &&
      (!filter.equipment || e.equipment === filter.equipment) &&
      exerciseMatchesQuery(e, filter.query)
  );
}

/**
 * Exact (normalized) name-or-alias match among the catalog and the caller's own exercises.
 * Catalog rows win over custom rows; other users' rows never match.
 */
export function findMatchingExercise<T extends SearchableExercise>(
  list: T[],
  name: string,
  ownerId: string | null
): T | null {
  const target = normalizeText(name);
  const candidates = list.filter((e) => e.owner_id === null || e.owner_id === ownerId);
  const hit = (e: T) => namesOf(e).includes(target);
  return candidates.find((e) => e.owner_id === null && hit(e)) ?? candidates.find(hit) ?? null;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx jest tests/lib/exercises`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add src/lib/exercises tests/lib/exercises
git commit -m "feat: add exercise taxonomy and accent-insensitive search"
```

---

### Task 2: Curate the catalog data file

**Files:**
- Create: `supabase/catalog/exercises.json`, `tests/fixtures/legacyExerciseNames.ts`
- Create (dev tool, kept): `scripts/catalog/fetch-sources.ts` (downloads the two source datasets into `scripts/catalog/.cache/`, git-ignored)
- Modify: `.gitignore` (add `scripts/catalog/.cache/`)
- Test: `tests/catalog/exercises-data.test.ts`

**Interfaces:**
- Consumes (Task 1): `MUSCLES`, `EQUIPMENT`, `isMuscle`, `isEquipment`, `normalizeText`.
- Produces: `supabase/catalog/exercises.json` — an array of `CatalogEntry` (shape below); `LEGACY_EXERCISE_NAMES: Array<{ name: string; target: string }>` (target = the catalog entry's `name`).

This task is research and data work, not code. Its quality bar is the validation test plus the curation rules below; a reviewer will spot-check names.

```typescript
interface CatalogEntry {
  slug: string;                 // kebab-case English, unique, e.g. "barbell-bench-press"
  name: string;                 // Spanish display name, unique (normalized)
  aliases: string[];            // Spanish synonyms, English name, legacy names mapped to it
  primary_muscle: string;       // one of MUSCLES
  secondary_muscles: string[];  // subset of MUSCLES, never containing primary_muscle
  equipment: string;            // one of EQUIPMENT
  source_id: string | null;     // free-exercise-db id, null only for entries not in that dataset
  image: { url: string; author: string; license: string; source_url: string } | null;
}
```

- [ ] **Step 1: Write the legacy-names fixture**

`tests/fixtures/legacyExerciseNames.ts` exports `LEGACY_EXERCISE_NAMES`, every name that exists in today's catalog or is produced by the importer, with the catalog entry it must resolve to.

The importer names are fixed by the spec (§5); copy this table exactly:

```typescript
export const LEGACY_EXERCISE_NAMES: Array<{ name: string; target: string }> = [
  { name: 'Sentadilla (o Prensa)', target: 'Sentadilla con barra' },
  { name: 'Sentadilla', target: 'Sentadilla con barra' },
  { name: 'Prensa o Sentadilla', target: 'Prensa de piernas' },
  { name: 'Prensa', target: 'Prensa de piernas' },
  { name: 'Press banca', target: 'Press banca con barra' },
  { name: 'Press inclinado mancuernas', target: 'Press inclinado con mancuernas' },
  { name: 'Press militar', target: 'Press militar con barra' },
  { name: 'Press militar mancuernas', target: 'Press militar con mancuernas' },
  { name: 'Remo en máquina o mancuerna', target: 'Remo en máquina' },
  { name: 'Remo en máquina', target: 'Remo en máquina' },
  { name: 'Remo con barra o mancuerna', target: 'Remo con barra' },
  { name: 'Jalón al pecho o Dominada asistida', target: 'Jalón al pecho' },
  { name: 'Jalón al pecho', target: 'Jalón al pecho' },
  { name: 'Dominadas o Jalón', target: 'Dominadas' },
  { name: 'Curl bíceps', target: 'Curl de bíceps con barra' },
  { name: 'Curl martillo', target: 'Curl martillo' },
  { name: 'Extensión tríceps', target: 'Extensión de tríceps en polea' },
  { name: 'Elevaciones laterales', target: 'Elevaciones laterales con mancuernas' },
  { name: 'Aperturas o Cruces en polea', target: 'Cruces en polea' },
  { name: 'Face pulls', target: 'Face pull' },
  { name: 'Peso muerto rumano', target: 'Peso muerto rumano' },
  { name: 'Zancadas', target: 'Zancadas con mancuernas' },
  { name: 'Curl femoral o gemelos', target: 'Curl femoral en máquina' },
  { name: 'Curl femoral', target: 'Curl femoral en máquina' },
  { name: 'Elevación de talón', target: 'Elevación de talones de pie' },
  { name: 'Gemelos', target: 'Elevación de talones de pie' },
  { name: 'Plancha', target: 'Plancha abdominal' },
  { name: 'Elevación de piernas colgado o en banco', target: 'Elevación de piernas colgado' },
  { name: 'Elevación de piernas', target: 'Elevación de piernas colgado' },
  { name: 'Rueda abdominal o Pallof press', target: 'Rueda abdominal' },
  { name: 'Anti-rotación (Pallof press o similar)', target: 'Pallof press' },
  { name: 'Anti-rotación', target: 'Pallof press' },
  // + one entry per name of the 63 rows created by supabase/migrations/20260914184710_seed_common_exercises.sql
  //   and 20260916111211_reset_exercise_catalog.sql, each with the catalog entry it is equivalent to
  //   (usually itself, when the old name is kept as the new catalog name).
];
```

Read both migrations and append one `{ name, target }` per old curated name (63 rows; the comment above is guidance for you — replace it with the real entries). Choose `target` as the catalog entry that is the same exercise; never map two different movements together.

- [ ] **Step 2: Write the failing validation test**

`tests/catalog/exercises-data.test.ts`:

```typescript
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

  it('only carries credited Creative Commons images', () => {
    for (const e of entries.filter((x) => x.image)) {
      expect(e.image!.url).toMatch(/^https:\/\/wger\.de\/media\//);
      expect(e.image!.license).toMatch(/^CC-BY-SA [34]$|^CC-BY 4$|^CC0$/);
      expect(e.image!.author.length).toBeGreaterThan(0);
      expect(e.image!.source_url).toMatch(/^https:\/\/wger\.de\//);
    }
  });
});
```

If `resolveJsonModule` imports of JSON fail under ts-jest, read the file with `JSON.parse(fs.readFileSync(...))` instead and note it.

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest tests/catalog/exercises-data.test.ts`
Expected: FAIL (data file missing).

- [ ] **Step 4: Fetch the sources**

`scripts/catalog/fetch-sources.ts` (run with `npx tsx scripts/catalog/fetch-sources.ts`): downloads
- `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json` → `scripts/catalog/.cache/free-exercise-db.json`
- wger, paginated (`next` links), JSON format: `https://wger.de/api/v2/exerciseinfo/?language=2&limit=100` (English names, ids) and `https://wger.de/api/v2/exerciseimage/?limit=100` (image url, `exercise` id, `license`, `license_author`, `license_object_url`, `is_main`) → `scripts/catalog/.cache/wger-exercises.json`, `wger-images.json`. The license titles: 1 `CC-BY-SA 3`, 2 `CC-BY-SA 4`, 3 `CC0`, 4 `CC-BY 4` (from `https://wger.de/api/v2/license/`).

- [ ] **Step 5: Curate `supabase/catalog/exercises.json`**

Rules (spec §4):
- Start from free-exercise-db entries with `category` `strength` or `powerlifting` (plus core work from `strength` with `abdominals`). Drop stretching, plyometrics, strongman, olympic weightlifting, cardio, rare variants, and anything whose equipment doesn't map (`other`, `foam roll`, `medicine ball`, `exercise ball`, null). Map equipment: `barbell`→barbell, `dumbbell`→dumbbell, `machine`→machine (Smith-machine variants → `smith`), `cable`→cable, `body only`→bodyweight, `kettlebells`→kettlebell, `e-z curl bar`→ez_bar, `bands`→band.
- Keep 150–200 of the most common gym exercises: every common free-weight, cable and machine variant; at least 3 per muscle group (the test enforces it).
- `name`: the term an Argentine gym uses, Spanish, sentence case ("Press banca con barra", "Jalón al pecho", "Remo con mancuerna", "Sentadilla búlgara", "Hip thrust", "Face pull" — English loanwords used in Argentine gyms stay as is). Add the equipment to the name only when it distinguishes variants.
- `aliases`: common Spanish synonyms, the free-exercise-db English name, and every legacy name whose `target` is this entry (from the fixture).
- `primary_muscle`: free-exercise-db's first primary muscle mapped with `mapFreeDbMuscle`, then reviewed by hand (e.g. hip thrust → glutes; deadlift → hamstrings or back — choose the commonly taught primary). `secondary_muscles`: mapped secondaries, deduped, without the primary.
- `slug`: kebab-case of the English name (ASCII only).
- `image`: find the wger exercise for this movement by English name (exact or obvious match; never guess a different movement). Use its main image (`is_main`, else the first). Record `url`, `author` (`license_author`, or `"wger.de"` when empty), `license` (the title above), `source_url` (`https://wger.de/exercise/<id>/view/` style link, or the image url). AI-generated images are allowed. `null` when no match.
- Sort entries by `primary_muscle` (in `MUSCLES` order), then `name`.

- [ ] **Step 6: Run the validation test until it passes**

Run: `npx jest tests/catalog/exercises-data.test.ts`
Expected: PASS. Fix the data, not the test.

- [ ] **Step 7: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add supabase/catalog/exercises.json tests/fixtures/legacyExerciseNames.ts tests/catalog/exercises-data.test.ts scripts/catalog/fetch-sources.ts .gitignore
git commit -m "feat: add the curated exercise catalog data (free-exercise-db + wger images)"
```

In the report, include: the entry count per muscle group, how many entries have images, and the full legacy→target table you appended.

---

### Task 3: Schema migration, seed generator and CI storage

**Files:**
- Create: `supabase/migrations/20261015120000_exercise_catalog_schema.sql`
- Create: `scripts/build-catalog-migration.ts`
- Create (generated by the script, committed): `supabase/migrations/20261015120100_seed_exercise_catalog.sql`
- Modify: `package.json` (script `build-catalog-migration`), `.github/workflows/ci.yml`
- Test: `tests/scripts/build-catalog-migration.test.ts`

**Interfaces:**
- Consumes: `supabase/catalog/exercises.json` (Task 2).
- Produces: `buildCatalogSeedSql(entries: CatalogEntry[]): string` exported from `scripts/build-catalog-migration.ts`; the two migrations.

- [ ] **Step 1: Write the schema migration**

`supabase/migrations/20261015120000_exercise_catalog_schema.sql`:

```sql
-- Researched catalog: richer columns, generated muscle_group, private custom exercises,
-- an images bucket. Uniqueness is added by the seed migration, after it merges duplicates.

alter table public.exercises
  add column slug text unique,
  add column aliases text[] not null default '{}',
  add column primary_muscle text,
  add column secondary_muscles text[] not null default '{}',
  add column equipment text,
  add column image_path text,
  add column image_credit jsonb,
  add column owner_id uuid references auth.users(id) on delete cascade;

-- Best effort for existing rows (spec §5); catalog rows overwrite these in the seed migration.
update public.exercises set
  primary_muscle = case muscle_group when 'lower' then 'quadriceps' when 'core' then 'core' else 'chest' end,
  equipment = 'bodyweight';

alter table public.exercises
  alter column primary_muscle set not null,
  alter column equipment set not null,
  add constraint exercises_primary_muscle_check check (primary_muscle in
    ('chest','back','shoulders','biceps','triceps','forearms','quadriceps','hamstrings','glutes','adductors_abductors','calves','core')),
  add constraint exercises_secondary_muscles_check check (secondary_muscles <@ array
    ['chest','back','shoulders','biceps','triceps','forearms','quadriceps','hamstrings','glutes','adductors_abductors','calves','core']::text[]),
  add constraint exercises_equipment_check check (equipment in
    ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','ez_bar','smith','band'));

-- muscle_group is now derived (progression keeps reading it unchanged).
alter table public.exercises drop column muscle_group;
alter table public.exercises add column muscle_group text generated always as (
  case
    when primary_muscle in ('quadriceps','hamstrings','glutes','adductors_abductors','calves') then 'lower'
    when primary_muscle = 'core' then 'core'
    else 'upper'
  end
) stored;

-- The global unique(name) goes away; the seed migration adds per-owner uniqueness.
alter table public.exercises drop constraint exercises_name_key;

-- RLS: shared catalog + the caller's own private exercises.
drop policy "exercises_select_all" on public.exercises;
drop policy "exercises_insert_all" on public.exercises;
create policy "exercises_select_catalog_or_own" on public.exercises
  for select using (owner_id is null or owner_id = auth.uid());
create policy "exercises_insert_own" on public.exercises
  for insert with check (owner_id = auth.uid());
create policy "exercises_update_own" on public.exercises
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "exercises_delete_own" on public.exercises
  for delete using (owner_id = auth.uid());

-- Public images bucket (reads through public URLs; writes only with the service role).
insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;
```

If `exercises_name_key` isn't the constraint's actual name in the earlier migration, look it up (`\d exercises` equivalent: the `unique` on `name` in `20260914045440_catalog_and_routine_structure.sql` is named `exercises_name_key` by Postgres) and note it.

- [ ] **Step 2: Write the failing generator test**

`tests/scripts/build-catalog-migration.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest tests/scripts/build-catalog-migration.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 4: Implement the generator**

`scripts/build-catalog-migration.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

export interface CatalogEntry {
  slug: string;
  name: string;
  aliases: string[];
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string;
  source_id: string | null;
  image: { url: string; author: string; license: string; source_url: string } | null;
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (xs: string[]) => (xs.length ? `array[${xs.map(q).join(', ')}]::text[]` : `'{}'::text[]`);

function imagePath(entry: CatalogEntry): string | null {
  if (!entry.image) return null;
  const ext = (entry.image.url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? 'png').toLowerCase();
  return `${entry.slug}.${ext}`;
}

function row(e: CatalogEntry): string {
  const credit = e.image
    ? q(JSON.stringify({ author: e.image.author, license: e.image.license, source_url: e.image.source_url }, null, 1).replace(/\n/g, ' '))
    : 'null';
  const img = imagePath(e);
  return `  (${q(e.slug)}, ${q(e.name)}, ${arr(e.aliases)}, ${q(e.primary_muscle)}, ${arr(e.secondary_muscles)}, ${q(e.equipment)}, ${img ? q(img) : 'null'}, ${credit === 'null' ? 'null' : `${credit}::jsonb`})`;
}

export function buildCatalogSeedSql(entries: CatalogEntry[]): string {
  return `-- GENERATED by scripts/build-catalog-migration.ts from supabase/catalog/exercises.json. Do not edit by hand.

-- 1. Upsert the catalog.
insert into public.exercises (slug, name, aliases, primary_muscle, secondary_muscles, equipment, image_path, image_credit)
values
${entries.map(row).join(',\n')}
on conflict (slug) do update set
  name = excluded.name,
  aliases = excluded.aliases,
  primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment,
  image_path = excluded.image_path,
  image_credit = excluded.image_credit,
  owner_id = null;

-- 2. Map every old shared row (no slug) to the catalog row whose name or alias matches it.
create temporary table catalog_merge on commit drop as
select old.id as old_id, cat.id as new_id
from public.exercises old
join public.exercises cat
  on cat.slug is not null
 and (lower(cat.name) = lower(old.name) or lower(old.name) in (select lower(a) from unnest(cat.aliases) a))
where old.slug is null and old.owner_id is null;

-- 3. Repoint routines and progression state, collapsing duplicate state rows to the latest.
update public.routine_exercises re set exercise_id = m.new_id
from catalog_merge m where re.exercise_id = m.old_id;

with remapped as (
  select s.id, s.user_id, coalesce(m.new_id, s.exercise_id) as target, s.updated_at
  from public.user_exercise_state s left join catalog_merge m on m.old_id = s.exercise_id
), ranked as (
  select id, row_number() over (partition by user_id, target order by updated_at desc nulls last, id) as rn
  from remapped
)
delete from public.user_exercise_state s using ranked r where s.id = r.id and r.rn > 1;

update public.user_exercise_state s set exercise_id = m.new_id
from catalog_merge m where s.exercise_id = m.old_id;

delete from public.exercises e using catalog_merge m where e.id = m.old_id;

-- 4. Leftover shared rows without a catalog match.
with refs as (
  select re.exercise_id, count(distinct r.user_id) as users, min(r.user_id::text)::uuid as only_user
  from public.routine_exercises re
  join public.routine_days d on d.id = re.routine_day_id
  join public.routines r on r.id = d.routine_id
  group by re.exercise_id
)
update public.exercises e set owner_id = refs.only_user
from refs
where e.id = refs.exercise_id and e.slug is null and e.owner_id is null and refs.users = 1;

delete from public.exercises e
where e.slug is null and e.owner_id is null
  and not exists (select 1 from public.routine_exercises re where re.exercise_id = e.id)
  and not exists (select 1 from public.user_exercise_state s where s.exercise_id = e.id);

-- 5. Uniqueness now that duplicates are gone.
create unique index exercises_catalog_name_key on public.exercises (lower(name)) where owner_id is null;
create unique index exercises_owner_name_key on public.exercises (owner_id, lower(name)) where owner_id is not null;
`;
}

const isMainModule = process.argv[1]?.endsWith('build-catalog-migration.ts') ?? false;
if (isMainModule) {
  const root = path.join(__dirname, '..');
  const entries: CatalogEntry[] = JSON.parse(fs.readFileSync(path.join(root, 'supabase/catalog/exercises.json'), 'utf-8'));
  const out = path.join(root, 'supabase/migrations/20261015120100_seed_exercise_catalog.sql');
  fs.writeFileSync(out, buildCatalogSeedSql(entries));
  console.log(`Wrote ${out} (${entries.length} exercises)`);
}
```

Add to `package.json` scripts: `"build-catalog-migration": "tsx scripts/build-catalog-migration.ts"`.

Note the `user_exercise_state` dedupe: if the state table has no `id` column, use `ctid` instead and say so in the report.

- [ ] **Step 5: Run the test, then generate the seed migration**

Run: `npx jest tests/scripts/build-catalog-migration.test.ts` (PASS)
Run: `npm run build-catalog-migration` (writes the seed file; commit it)

- [ ] **Step 6: Keep storage in the CI stack**

In `.github/workflows/ci.yml`, remove `storage-api` from the `supabase start -x ...` exclude list (the schema migration inserts into `storage.buckets`, which the storage service creates).

- [ ] **Step 7: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add supabase/migrations/20261015120000_exercise_catalog_schema.sql supabase/migrations/20261015120100_seed_exercise_catalog.sql scripts/build-catalog-migration.ts tests/scripts/build-catalog-migration.test.ts package.json .github/workflows/ci.yml
git commit -m "feat: migrate exercises to the researched catalog with private custom exercises"
```

---

### Task 4: App data layer, importer and test fixtures

**Files:**
- Modify: `src/lib/routines/types.ts`, `src/lib/routines/queries.ts`, `src/lib/routines/mutations.ts`, `scripts/import-routine.ts`, `tests/helpers/seedTestRoutine.ts`, `tests/lib/routines/mutations.integration.test.ts`, `tests/lib/progression/suggestions.integration.test.ts`, `tests/db/rls.test.ts`, `tests/db/schema-catalog-routine.test.ts` (and any other file the grep in Step 1 finds)
- Create: `tests/lib/exercises/catalog.integration.test.ts`

**Interfaces:**
- Consumes (Task 1): `findMatchingExercise`, `SearchableExercise`, `Muscle`, `Equipment`.
- Produces:
  - `interface Exercise { id: string; slug: string | null; name: string; aliases: string[]; primary_muscle: string; secondary_muscles: string[]; equipment: string; image_path: string | null; image_credit: { author: string; license: string; source_url: string } | null; owner_id: string | null; muscle_group: string }`
  - `listExercises(supabase): Promise<Exercise[]>` (unchanged signature; RLS limits it to catalog + own)
  - `findOrCreateExercise(supabase, input: { name: string; primaryMuscle: Muscle; equipment: Equipment; ownerId: string | null }): Promise<Exercise>`
  - `RoutineExerciseWithName` gains `image_path: string | null`

- [ ] **Step 1: Find every writer of `muscle_group`**

Run: `grep -rn "muscle_group" src app scripts tests --include=*.ts --include=*.tsx`
Every insert/update that writes `muscle_group` must be changed to write `primary_muscle` + `equipment` instead (the column is generated now). Reads stay.

- [ ] **Step 2: Update the types and queries**

In `src/lib/routines/types.ts`, replace `Exercise` with the shape in Interfaces, and add `image_path: string | null;` to `RoutineExerciseWithName`.

In `src/lib/routines/queries.ts`, `listDayExercises`: select `exercises(name, muscle_group, image_path)` and map `image_path: row.exercises.image_path`.

- [ ] **Step 3: Replace `findOrCreateExercise`**

In `src/lib/routines/mutations.ts`:

```typescript
import { findMatchingExercise } from '../exercises/search';
import { Equipment, Muscle } from '../exercises/taxonomy';

export async function findOrCreateExercise(
  supabase: SupabaseClient,
  input: { name: string; primaryMuscle: Muscle; equipment: Equipment; ownerId: string | null }
): Promise<Exercise> {
  const name = input.name.trim();
  const { data: visible, error: listError } = await supabase.from('exercises').select('*');
  if (listError) throw listError;
  const existing = findMatchingExercise((visible ?? []) as Exercise[], name, input.ownerId);
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from('exercises')
    .insert({ name, primary_muscle: input.primaryMuscle, equipment: input.equipment, owner_id: input.ownerId })
    .select()
    .single();
  if (createError) {
    // A concurrent caller created the same name first: return theirs.
    if (createError.code === '23505') {
      const { data: again, error: againError } = await supabase.from('exercises').select('*');
      if (againError) throw againError;
      const winner = findMatchingExercise((again ?? []) as Exercise[], name, input.ownerId);
      if (winner) return winner;
    }
    throw createError;
  }
  return created as Exercise;
}
```

(`ownerId: null` is only for the service role: scripts and test fixtures creating shared rows.)

- [ ] **Step 4: Importer uses the shared function**

In `scripts/import-routine.ts`: delete `MUSCLE_GROUP_BY_EXERCISE`, `muscleGroupForExercise` and the local `findOrCreateExercise`. Import `findOrCreateExercise` from `../src/lib/routines/mutations` and, in `importRoutine`, resolve each exercise with:

```typescript
        const exercise = await findOrCreateExercise(supabase, {
          name: exercise.name,
          primaryMuscle: 'chest',
          equipment: 'bodyweight',
          ownerId: userId,
        });
        const exerciseId = exercise.id;
```

(rename the loop variable so it doesn't shadow). Every importer name is an alias in the catalog (Task 2's test), so the fallback values are never used for the bundled routine; an unknown name becomes the user's private exercise.

- [ ] **Step 5: Update test helpers and integration tests**

- `tests/helpers/seedTestRoutine.ts`: `findOrCreateExercise(supabase, { name: FIXTURE_EXERCISE_NAME, primaryMuscle: 'quadriceps', equipment: 'barbell', ownerId: null })`; the user-scoped variant passes `ownerId: userId`.
- `tests/lib/routines/mutations.integration.test.ts`: same object form (`primaryMuscle: 'chest'` for the old `'upper'`, `'core'` for `'core'`, `equipment: 'bodyweight'`, `ownerId: null`).
- `tests/lib/progression/suggestions.integration.test.ts`, `tests/db/rls.test.ts`, `tests/db/schema-catalog-routine.test.ts`: replace `muscle_group: X` in inserts with `primary_muscle` / `equipment` (and `owner_id` when inserting as a signed-in user); update any assertion that the RLS test made about every user seeing every exercise to the new rule (catalog + own only).

- [ ] **Step 6: Write the catalog integration tests (run in CI)**

`tests/lib/exercises/catalog.integration.test.ts`:

```typescript
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
    const { data, error } = await admin.from('exercises').select('slug, primary_muscle, muscle_group').not('slug', 'is', null);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(150);
    expect(data!.length).toBeLessThanOrEqual(200);
    for (const row of data!) {
      const lower = ['quadriceps', 'hamstrings', 'glutes', 'adductors_abductors', 'calves'].includes(row.primary_muscle);
      expect(row.muscle_group).toBe(row.primary_muscle === 'core' ? 'core' : lower ? 'lower' : 'upper');
    }
  });

  it('resolves an importer alias to the catalog row instead of creating one', async () => {
    const { userId } = await signedInUser('catalog-alias');
    const viaAlias = await findOrCreateExercise(admin, { name: 'press banca', primaryMuscle: 'chest', equipment: 'bodyweight', ownerId: userId });
    expect(viaAlias.slug).not.toBeNull();
    expect(viaAlias.name).toBe('Press banca con barra');
  });

  it("keeps custom exercises private to their owner", async () => {
    const a = await signedInUser('catalog-owner-a');
    const b = await signedInUser('catalog-owner-b');
    const custom = await findOrCreateExercise(a.client, { name: 'Ejercicio inventado A', primaryMuscle: 'core', equipment: 'bodyweight', ownerId: a.userId });
    expect(custom.owner_id).toBe(a.userId);

    const { data: seenByA } = await a.client.from('exercises').select('id').eq('id', custom.id);
    const { data: seenByB } = await b.client.from('exercises').select('id').eq('id', custom.id);
    expect(seenByA).toHaveLength(1);
    expect(seenByB).toHaveLength(0);
  });

  it('refuses a signed-in user writing a catalog row or another user\'s row', async () => {
    const a = await signedInUser('catalog-write-a');
    const b = await signedInUser('catalog-write-b');
    const { error: catalogError } = await a.client.from('exercises').insert({ name: 'Intento catálogo', primary_muscle: 'core', equipment: 'bodyweight', owner_id: null });
    expect(catalogError).not.toBeNull();
    const { error: otherError } = await a.client.from('exercises').insert({ name: 'Intento ajeno', primary_muscle: 'core', equipment: 'bodyweight', owner_id: b.userId });
    expect(otherError).not.toBeNull();
  });

  it('lets two users own custom exercises with the same name', async () => {
    const a = await signedInUser('catalog-same-a');
    const b = await signedInUser('catalog-same-b');
    const one = await findOrCreateExercise(a.client, { name: 'Mismo nombre', primaryMuscle: 'core', equipment: 'bodyweight', ownerId: a.userId });
    const two = await findOrCreateExercise(b.client, { name: 'Mismo nombre', primaryMuscle: 'core', equipment: 'bodyweight', ownerId: b.userId });
    expect(one.id).not.toBe(two.id);
  });
});
```

The merge itself (old duplicates → catalog, state dedupe) runs once inside the seed migration on the CI database, which starts with the previous migrations' 63 rows; the catalog test above plus the importer/demo tests in CI exercise its result.

- [ ] **Step 7: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass); `grep -rn "muscle_group:" src app scripts tests --include=*.ts --include=*.tsx` (no writes left — reads in mapping objects are fine)

```bash
git add -A src/lib/routines scripts/import-routine.ts tests
git commit -m "feat: alias-aware findOrCreateExercise, private custom exercises, importer on the catalog"
```

---

### Task 5: Image URLs, cache column and upload script

**Files:**
- Create: `src/lib/exercises/images.ts`, `scripts/upload-exercise-images.ts`
- Modify: `src/lib/sqlite/schema.ts`, `src/lib/sqlite/cache.ts`, `package.json`
- Test: `tests/lib/sqlite/schema.test.ts` (extend)

**Interfaces:**
- Consumes: `supabase` client; `RoutineExerciseWithName.image_path` (Task 4).
- Produces: `exerciseImageUrl(path: string | null): string | null`; cached routine exercises carry `image_path`; `npm run upload-exercise-images`.

- [ ] **Step 1: Cache column (test first)**

In `tests/lib/sqlite/schema.test.ts`, in the migrations `describe`, add:

```typescript
  it('adds image_path to the cached routine exercises', () => {
    expect(MIGRATION_STATEMENTS).toContain('alter table routine_exercises_cache add column image_path text');
  });
```

Run it (FAIL), then in `src/lib/sqlite/schema.ts` add `image_path text` to the `routine_exercises_cache` create statement (after `muscle_group text`) and append `'alter table routine_exercises_cache add column image_path text'` to `MIGRATION_STATEMENTS`. In `src/lib/sqlite/cache.ts`, include `image_path` in the `routine_exercises_cache` insert (column list and value `exercise.image_path ?? null`). Run it (PASS).

- [ ] **Step 2: Public URL helper**

`src/lib/exercises/images.ts`:

```typescript
import { supabase } from '../supabase';

export const EXERCISE_IMAGES_BUCKET = 'exercise-images';

export function exerciseImageUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(EXERCISE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}
```

- [ ] **Step 3: Upload script (run later by the controller, not by you)**

`scripts/upload-exercise-images.ts`: loads `.env.local` (same pattern as `scripts/seed-demo-user.ts`), creates a service-role client, reads `supabase/catalog/exercises.json`, and for each entry with `image`: computes the object name exactly like the generator (`<slug>.<ext>` from the url), skips it if `storage.from('exercise-images').list('', { search: name })` already has it, otherwise downloads the url with `fetch` and uploads the bytes with `upload(name, bytes, { contentType, upsert: false })` (`contentType` from the response header, default `image/png`). Logs `uploaded / skipped / failed` counts; a failed download doesn't stop the rest. Add `"upload-exercise-images": "tsx scripts/upload-exercise-images.ts"` to `package.json`. Type-check it; do not run it.

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add src/lib/exercises/images.ts scripts/upload-exercise-images.ts src/lib/sqlite/schema.ts src/lib/sqlite/cache.ts tests/lib/sqlite/schema.test.ts package.json
git commit -m "feat: exercise image URLs, cached image paths and the image upload script"
```

---

### Task 6: Picker and form — search, filters, thumbnails, custom exercises

**Files:**
- Create: `src/components/ExerciseThumbnail.tsx`
- Modify: `src/components/ExercisePicker.tsx`, `src/components/ExerciseForm.tsx`, `src/components/DayExercisesSection.tsx`

**Interfaces:**
- Consumes: `filterExercises`, `MUSCLES`, `MUSCLE_LABEL`, `EQUIPMENT`, `EQUIPMENT_LABEL` (Task 1); `findOrCreateExercise` new form (Task 4); `exerciseImageUrl` (Task 5); `useAuthSession` for the user id.
- Produces: `ExerciseThumbnail({ imagePath, muscle, size })`; `ExerciseFormValues` loses `muscleGroup` and gains `primaryMuscle: Muscle` and `equipment: Equipment`.

- [ ] **Step 1: Thumbnail with fallback**

`src/components/ExerciseThumbnail.tsx`:

```tsx
import { useState } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { exerciseImageUrl } from '../lib/exercises/images';
import { MUSCLE_LABEL, isMuscle } from '../lib/exercises/taxonomy';

/** Exercise illustration, or the muscle's initials when there's no image (or it fails to load). */
export function ExerciseThumbnail({ imagePath, muscle, size = 40 }: { imagePath: string | null; muscle: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const uri = exerciseImageUrl(imagePath);
  const label = isMuscle(muscle) ? MUSCLE_LABEL[muscle] : '?';
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: 8, backgroundColor: '#f0f0f0' }}
        resizeMode="contain"
        onError={() => setFailed(true)}
        accessibilityLabel={`Ilustración de ${label}`}
      />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size }]} accessibilityLabel={label}>
      <Text style={styles.fallbackText}>{label.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { borderRadius: 8, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#666', fontWeight: '700', fontSize: 12 },
});
```

(The theme plan replaces these literal colors with tokens later.)

- [ ] **Step 2: ExercisePicker**

In `src/components/ExercisePicker.tsx`:
1. Replace the `browseFilter` state with `const [muscle, setMuscle] = useState<Muscle | null>(null);` and `const [equipment, setEquipment] = useState<Equipment | null>(null);`; replace `newMuscleGroup` with `const [newMuscle, setNewMuscle] = useState<Muscle>('chest');` and `const [newEquipment, setNewEquipment] = useState<Equipment>('dumbbell');`.
2. `const visible = filterExercises(allExercises, { query: search, muscle, equipment });`
3. Search placeholder: `Buscar por nombre o sinónimo...`.
4. Replace the upper/lower/core segmented control with two horizontally scrollable chip rows (`ScrollView horizontal showsHorizontalScrollIndicator={false}`): first "Todos los músculos" + one chip per `MUSCLES` (label `MUSCLE_LABEL[m]`), second "Todo el equipamiento" + one chip per `EQUIPMENT` (`EQUIPMENT_LABEL[e]`). Tapping the active chip clears it. Reuse the existing `segment`/`segmentSelected` styles.
5. Each row: checkbox, `<ExerciseThumbnail imagePath={exercise.image_path} muscle={exercise.primary_muscle} />`, a column with the name and `rowMeta` text `${MUSCLE_LABEL[primary]} · ${EQUIPMENT_LABEL[equipment]}` (fallback to the raw value if not a known key).
6. Custom exercise form: name input + "Músculo principal" chip row (`MUSCLES`) + "Equipamiento" chip row (`EQUIPMENT`); `handleAddCustom` calls `findOrCreateExercise(supabase, { name: newName.trim(), primaryMuscle: newMuscle, equipment: newEquipment, ownerId: userId })` with `userId` from `useAuthSession()` (return early if missing).

- [ ] **Step 3: ExerciseForm and DayExercisesSection**

In `src/components/ExerciseForm.tsx`: replace `muscleGroup` in `ExerciseFormValues` with `primaryMuscle: Muscle` (default `'chest'`) and `equipment: Equipment` (default `'dumbbell'`); suggestions use `filterExercises(exercises, { query: values.exerciseName, muscle: browseMuscle, equipment: null }).slice(0, browseMuscle ? 20 : 5)` with a muscle chip row replacing the upper/lower/core filter; selecting a suggestion copies its name, `primary_muscle` and `equipment` (when they are known keys); the "nuevo ejercicio" muscle choice becomes the `MUSCLES` and `EQUIPMENT` chip rows. Suggestion rows show the thumbnail.

In `src/components/DayExercisesSection.tsx` `handleUpdateExercise`: `findOrCreateExercise(supabase, { name: values.exerciseName.trim(), primaryMuscle: values.primaryMuscle, equipment: values.equipment, ownerId: session?.user.id ?? null })` (get the session with `useAuthSession()`; if there's no user, show the existing error alert path).

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add src/components/ExerciseThumbnail.tsx src/components/ExercisePicker.tsx src/components/ExerciseForm.tsx src/components/DayExercisesSection.tsx
git commit -m "feat: search with synonyms, muscle/equipment filters and thumbnails in the exercise picker"
```

---

### Task 7: Session thumbnail, image viewer and credits

**Files:**
- Modify: `src/components/SessionExerciseCard.tsx`, `app/(app)/settings.tsx`, `app/(app)/_layout.tsx`
- Create: `app/(app)/credits.tsx`, `src/lib/exercises/queries.ts`
- Test: none new (UI)

**Interfaces:**
- Consumes: `ExerciseThumbnail` (Task 6), `exerciseImageUrl` (Task 5), `CachedRoutineExercise.image_path` (Task 5).
- Produces: `listCreditedExercises(supabase): Promise<Array<{ id: string; name: string; image_credit: { author: string; license: string; source_url: string } }>>`; route `/(app)/credits`.

- [ ] **Step 1: Session card thumbnail + viewer**

In `src/components/SessionExerciseCard.tsx`, put `<ExerciseThumbnail imagePath={exercise.image_path ?? null} muscle={...} size={48} />` left of the exercise name (wrap name + target in a row). The cached exercise has `muscle_group` but not `primary_muscle`; pass `exercise.muscle_group === 'core' ? 'core' : ''` so the fallback shows initials of "Core" or "?". When `image_path` is set, tapping the thumbnail opens a `Modal` (transparent, fade) showing the image at `width: '90%'` / `aspectRatio: 1`, `resizeMode="contain"`, and the line `Ilustración: wger.de (CC-BY-SA)` under it; tapping anywhere closes it.

- [ ] **Step 2: Credits query**

`src/lib/exercises/queries.ts`:

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export interface CreditedExercise {
  id: string;
  name: string;
  image_credit: { author: string; license: string; source_url: string };
}

export async function listCreditedExercises(supabase: SupabaseClient): Promise<CreditedExercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, image_credit')
    .not('image_credit', 'is', null)
    .order('name');
  if (error) throw error;
  return (data ?? []) as CreditedExercise[];
}
```

- [ ] **Step 3: Credits screen**

`app/(app)/credits.tsx`: header text "Créditos de imágenes"; an intro paragraph "Las ilustraciones de ejercicios provienen de wger.de y se usan bajo licencias Creative Commons. Los datos del catálogo provienen de free-exercise-db (dominio público)."; a `FlatList` of `listCreditedExercises` rows: name (bold), `${author} · ${license}`, and a "Ver fuente" link (`Linking.openURL(source_url)`). Loading spinner; on error "No se pudieron cargar los créditos." with a "Reintentar" button.

In `app/(app)/_layout.tsx`, register it hidden from the drawer: `<Drawer.Screen name="credits" options={{ title: 'Créditos de imágenes', drawerItemStyle: { display: 'none' } }} />`.

In `app/(app)/settings.tsx`, add a row at the end: a `Pressable` "Créditos de imágenes ›" → `router.push('/(app)/credits' as any)`.

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add src/components/SessionExerciseCard.tsx src/lib/exercises/queries.ts "app/(app)/credits.tsx" "app/(app)/settings.tsx" "app/(app)/_layout.tsx"
git commit -m "feat: exercise images in the session and an image credits screen"
```

---

### Task 8: Final verification and hosted steps

**Files:** none new; fix-ups only.

- [ ] **Step 1:** `npm run typecheck`, `npm run test:unit` (all pass); `npx jest --selectProjects integration --listTests` lists `tests/lib/exercises/catalog.integration.test.ts`.
- [ ] **Step 2 (controller, after CI is green, each with the user's approval):** list the hosted rows that would hit the "shared by 2+ users" rule (spec §5) and show them to the user; `npx supabase db push` (dry-run first); `npm run upload-exercise-images`; `npm run seed-demo`.
- [ ] **Step 3: Device checklist for the user (verbatim)**
  1. Buscar "press plano" encuentra "Press banca con barra"; los filtros Pecho + Mancuernas acotan la lista.
  2. Las filas muestran ilustraciones; los ejercicios sin imagen muestran las iniciales del músculo.
  3. Tu rutina y tu historial siguen funcionando; el gráfico de Press banca junta las sesiones de las dos rutinas.
  4. Un ejercicio que crees no lo ve el usuario demo.
  5. Ajustes → Créditos de imágenes lista autores y licencias.
