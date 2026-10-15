# Fit Tracker — Researched Exercise Catalog — Design Spec

Date: 2026-10-15

## 1. Purpose

Today's catalog is about 63 hand-typed exercises with a coarse `muscle_group` (`upper` / `lower` / `core`), no equipment, near-duplicates created by the routine importer (e.g. "Press militar mancuernas" next to "Press militar con mancuernas"), and every user-created exercise is visible to every user.

The user wants all of it fixed: easier to find exercises (search with synonyms, filters by muscle and equipment), more exercises, no duplicates, consistent names, and illustrations. This spec replaces the catalog with a researched, curated one and makes custom exercises private.

Builds on: `2026-09-13-fit-tracker-design.md` (schema, import), `2026-10-01-fit-tracker-progress-and-prs-design.md` (history keyed by catalog exercise).

## 2. Decisions taken with the user

| # | Decision |
|---|---|
| Size | Curated: 150–200 exercises; users can still create missing ones |
| Data source | free-exercise-db (Unlicense / public domain), cross-checked and translated to rioplatense gym Spanish |
| Muscles | 12 groups (§3.2), one primary + secondaries |
| Equipment | 9 values (§3.3) |
| Images | wger illustrations (CC-BY-SA 3.0/4.0, AI-generated ones included), credited; a generic icon per muscle where none exists |
| Duplicates | merged automatically through a reviewed equivalence table (§5) |
| Custom exercises | private to the user who created them |

## 3. Data model

### 3.1 `exercises` table — new shape

| column | type | notes |
|---|---|---|
| id | uuid pk | unchanged |
| slug | text, nullable, unique | stable key for catalog rows (e.g. `barbell-bench-press`); null for custom exercises |
| name | text not null | Spanish display name |
| aliases | text[] not null default '{}' | Spanish/English synonyms and the importer's old names, for search and import matching |
| primary_muscle | text not null | one of §3.2 |
| secondary_muscles | text[] not null default '{}' | values of §3.2 |
| equipment | text not null | one of §3.3 |
| image_path | text, nullable | path inside the `exercise-images` storage bucket |
| image_credit | jsonb, nullable | `{ author, license, source_url }` |
| owner_id | uuid, nullable, fk auth.users on delete cascade | null = shared catalog; set = private custom exercise |
| muscle_group | text, **generated** from `primary_muscle` (§3.4) | kept so the progression engine and caches keep working unchanged |

Uniqueness: `name` is unique among catalog rows (`owner_id is null`) and unique per owner among custom rows (case-insensitive). The old global `unique(name)` is dropped.

### 3.2 Muscle groups

`chest` (Pecho), `back` (Espalda), `shoulders` (Hombros), `biceps` (Bíceps), `triceps` (Tríceps), `forearms` (Antebrazos), `quadriceps` (Cuádriceps), `hamstrings` (Isquiotibiales), `glutes` (Glúteos), `adductors_abductors` (Aductores/abductores), `calves` (Gemelos), `core` (Core). Stored as the English key; displayed with the Spanish label.

### 3.3 Equipment

`barbell` (Barra), `dumbbell` (Mancuernas), `machine` (Máquina), `cable` (Polea), `bodyweight` (Peso corporal), `kettlebell` (Kettlebell), `ez_bar` (Barra EZ), `smith` (Máquina Smith), `band` (Banda elástica).

### 3.4 Derived `muscle_group`

`chest, back, shoulders, biceps, triceps, forearms` → `upper`; `quadriceps, hamstrings, glutes, adductors_abductors, calves` → `lower`; `core` → `core`. A Postgres generated column, so nothing that reads `muscle_group` changes (weight increments: +1.25 kg upper, +2.5 kg lower).

### 3.5 Row level security

- Select: `owner_id is null or owner_id = auth.uid()`.
- Insert: `owner_id = auth.uid()` (users can only create private exercises; the shared catalog is written by migrations only).
- Update/delete: only own rows (`owner_id = auth.uid()`).

### 3.6 Images

- A public storage bucket `exercise-images`, created by migration, readable by anyone, writable only with the service role.
- The app builds the URL with `supabase.storage.from('exercise-images').getPublicUrl(image_path)`.
- Images are uploaded once by a script (`npm run upload-exercise-images`, service role) that downloads each matched wger image and stores it as `<slug>.<ext>`; it is idempotent (skips existing objects).

## 4. Building the catalog

The catalog lives in a committed data file, `supabase/catalog/exercises.json`, one entry per exercise:

```json
{
  "slug": "barbell-bench-press",
  "name": "Press banca con barra",
  "aliases": ["Press banca", "Press plano", "Bench press"],
  "primary_muscle": "chest",
  "secondary_muscles": ["triceps", "shoulders"],
  "equipment": "barbell",
  "source_id": "Barbell_Bench_Press_-_Medium_Grip",
  "image": { "url": "https://wger.de/media/...", "author": "...", "license": "CC-BY-SA 4", "source_url": "https://wger.de/..." }
}
```

Curation rules:
- Start from free-exercise-db `category` in `strength` / `powerlifting` (plus core work), equipment that maps to §3.3; drop stretching, plyometrics, strongman, olympic lifts, cardio, and rare variants.
- Target 150–200 entries, covering every muscle group and every common machine/cable/free-weight variant of a typical gym.
- Names: the term an Argentine gym uses ("Press banca", "Jalón al pecho", "Curl martillo", "Sentadilla búlgara"), with equipment in the name only when it distinguishes variants ("Press militar con barra" / "con mancuernas").
- Aliases: common Spanish synonyms, the English name, and every importer name mapped to it in §5.
- Muscles: mapped from free-exercise-db's 17 muscles to §3.2 (`lats`, `middle back`, `lower back`, `traps` → `back`; `abdominals` → `core`; `adductors`, `abductors` → `adductors_abductors`; `neck` dropped), then reviewed by hand per exercise.
- Images: matched to a wger exercise by name; only images with a CC license recorded (`license` 1/2/4/3), AI-generated allowed; at most one image per exercise.
- A generator script turns the data file into the seed migration (§6), so the data file is the single source of truth and the SQL is reviewable.

## 5. Merging the importer's duplicates

Every exercise currently referenced by a routine is remapped to a catalog entry. The importer's names (from `rutina_gym_top_set_back_off.md`) map as follows; each old name also becomes an alias of its target, so future imports land on the catalog entry:

| Old name | Catalog exercise |
|---|---|
| Sentadilla (o Prensa) | Sentadilla con barra |
| Sentadilla | Sentadilla con barra |
| Prensa o Sentadilla | Prensa de piernas |
| Prensa | Prensa de piernas |
| Press banca | Press banca con barra |
| Press inclinado mancuernas | Press inclinado con mancuernas |
| Press militar | Press militar con barra |
| Press militar mancuernas | Press militar con mancuernas |
| Remo en máquina o mancuerna | Remo en máquina |
| Remo en máquina | Remo en máquina |
| Remo con barra o mancuerna | Remo con barra |
| Jalón al pecho o Dominada asistida | Jalón al pecho |
| Jalón al pecho | Jalón al pecho |
| Dominadas o Jalón | Dominadas |
| Curl bíceps | Curl de bíceps con barra |
| Curl martillo | Curl martillo |
| Extensión tríceps | Extensión de tríceps en polea |
| Elevaciones laterales | Elevaciones laterales con mancuernas |
| Aperturas o Cruces en polea | Cruces en polea |
| Face pulls | Face pull |
| Peso muerto rumano | Peso muerto rumano |
| Zancadas | Zancadas con mancuernas |
| Curl femoral o gemelos | Curl femoral en máquina |
| Curl femoral | Curl femoral en máquina |
| Elevación de talón | Elevación de talones de pie |
| Gemelos | Elevación de talones de pie |
| Plancha | Plancha abdominal |
| Elevación de piernas colgado o en banco | Elevación de piernas colgado |
| Elevación de piernas | Elevación de piernas colgado |
| Rueda abdominal o Pallof press | Rueda abdominal |
| Anti-rotación (Pallof press o similar) | Pallof press |
| Anti-rotación | Pallof press |

The old curated rows (the 63 from earlier migrations) map by name to their catalog equivalent in the same way; the full old→new table is part of the seed data and listed in the plan.

Merging rules (in the migration):
- `routine_exercises.exercise_id` is repointed to the catalog row.
- `user_exercise_state` rows are repointed; if a user ends up with two rows for the same catalog exercise, keep the one with the latest `updated_at` and drop the other.
- History (`logged_sets`) needs no change: it points to `routine_exercises`, and the view joins through them, so merged exercises show one combined chart.
- Exercises that are neither in the catalog nor in the mapping, and are referenced by exactly one user's routines, become that user's private exercise (`owner_id` set). Unreferenced leftovers are deleted (as the 2026-09-16 reset did).

## 6. Migrations

1. Schema: new columns, generated `muscle_group`, uniqueness, RLS, storage bucket and its policies.
2. Seed (generated from `supabase/catalog/exercises.json`): upsert every catalog row by `slug`, then the merge of §5.

Both run on the throwaway CI database and, with the user's approval, on the hosted project. The images script runs only against the hosted project (after the migrations).

## 7. App changes

- **Search** (`ExercisePicker`): accent- and case-insensitive match on name and aliases ("press plano" finds "Press banca con barra").
- **Filters**: chips for muscle group (§3.2) and equipment (§3.3), combinable.
- **Rows**: thumbnail (or the generic muscle icon), name, "Músculo · Equipamiento".
- **Creating a custom exercise**: name + primary muscle + equipment (replacing the upper/lower/core choice); it is private.
- **Session card**: the exercise thumbnail; tapping it opens the image larger with its credit line.
- **Credits**: Ajustes → "Créditos de imágenes": a list of exercises with images, each with author, license and a link; plus a line crediting wger and free-exercise-db.
- **Importer** (`scripts/import-routine.ts`) and app `findOrCreateExercise`: match an existing exercise by name or alias (accent/case-insensitive) before creating; the importer no longer needs its own muscle-group table.
- **Demo seed**: works unchanged through the importer's alias matching; re-run after the migration.

## 8. Non-goals

- No exercise instructions/how-to text (free-exercise-db has English instructions; translating 150–200 is a later addition).
- No editing or deleting catalog exercises in the app.
- No more than one image per exercise; no videos.
- No changes to progression rules beyond keeping `muscle_group` derived.

## 9. Testing

### Unit
- Muscle mapping from free-exercise-db muscles to §3.2, and §3.4 derivation.
- Search normalization: accent/case-insensitive matching on name and aliases.
- Filter combination (muscle × equipment).
- Data-file validation: every entry has a unique slug and name, a valid primary muscle and equipment, valid secondaries, no alias shared by two entries, and every §5 old name present as an alias of its target.
- Seed generator: produces SQL that upserts by slug and escapes quotes.

### Integration (CI, throwaway Supabase)
- RLS: a user sees catalog rows and their own custom rows, never another user's; cannot insert a catalog row (owner_id null) or another user's row.
- Merge: a routine exercise and a `user_exercise_state` pointing at an old duplicate end up on the catalog row; duplicate state rows collapse to the latest.
- `findOrCreateExercise` resolves an alias to the catalog row instead of creating a new one.
- `muscle_group` is generated correctly.

### Manual (device)
1. Searching "press plano" finds "Press banca con barra"; filters by Pecho + Mancuernas narrow the list.
2. Rows show illustrations; exercises without one show the muscle icon.
3. Your routine and history still work; Press banca's chart shows sessions from both routines.
4. A custom exercise you create isn't visible to the demo user.
5. Ajustes → Créditos de imágenes lists authors and licenses.
