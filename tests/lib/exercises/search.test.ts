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
    expect(filterExercises(catalog, { query: '', muscle: 'chest', equipment: null }).map((e) => e.id)).toEqual([
      'bench',
    ]);
    expect(filterExercises(catalog, { query: 'press', muscle: null, equipment: 'cable' }).map((e) => e.id)).toEqual([
      'pallof',
    ]);
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
