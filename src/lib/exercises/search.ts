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
    .replace(/[̀-ͯ]/g, '')
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
