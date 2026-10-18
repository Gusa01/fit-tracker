/**
 * Dev tool: downloads the two source datasets used to curate supabase/catalog/exercises.json
 * into scripts/catalog/.cache/ (git-ignored). Run with `npx tsx scripts/catalog/fetch-sources.ts`.
 *
 * - free-exercise-db (Unlicense): exercise names, muscles, equipment.
 * - wger (CC-BY-SA / CC0 images): English exercise names and their images, for illustrations.
 */
import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = path.join(__dirname, '.cache');
const FREE_EXERCISE_DB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const WGER_EXERCISES_URL = 'https://wger.de/api/v2/exerciseinfo/?language=2&limit=100&format=json';
const WGER_IMAGES_URL = 'https://wger.de/api/v2/exerciseimage/?limit=100&format=json';

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Follows wger's `next` links and concatenates every page's `results`. */
async function getAllPages(firstUrl: string): Promise<unknown[]> {
  const all: unknown[] = [];
  let url: string | null = firstUrl;
  while (url) {
    const page = (await getJson(url)) as { next: string | null; results: unknown[] };
    all.push(...page.results);
    url = page.next;
    process.stdout.write(`  ${all.length} rows\r`);
  }
  process.stdout.write('\n');
  return all;
}

function save(file: string, data: unknown): void {
  fs.writeFileSync(path.join(CACHE_DIR, file), JSON.stringify(data, null, 2));
  console.log(`wrote ${file}`);
}

async function main(): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  console.log('free-exercise-db…');
  save('free-exercise-db.json', await getJson(FREE_EXERCISE_DB_URL));

  console.log('wger exercises…');
  save('wger-exercises.json', await getAllPages(WGER_EXERCISES_URL));

  console.log('wger images…');
  save('wger-images.json', await getAllPages(WGER_IMAGES_URL));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
