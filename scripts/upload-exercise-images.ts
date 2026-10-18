import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CatalogEntry, imagePath } from './build-catalog-migration';

// Same bucket as src/lib/exercises/images.ts. Not imported from there: that module loads the
// app's Supabase client (React Native AsyncStorage, anon key) at import time, which fails in Node.
const EXERCISE_IMAGES_BUCKET = 'exercise-images';

const CONTENT_TYPES: Record<string, string> = {
  jfif: 'image/jpeg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function contentTypeFor(objectName: string, responseHeader: string | null): string {
  const ext = path.extname(objectName).slice(1).toLowerCase();
  return CONTENT_TYPES[ext] ?? responseHeader?.split(';')[0].trim() ?? 'image/png';
}

async function alreadyUploaded(supabase: SupabaseClient, objectName: string): Promise<boolean> {
  const { data, error } = await supabase.storage.from(EXERCISE_IMAGES_BUCKET).list('', { search: objectName });
  if (error) throw error;
  return (data ?? []).some((file) => file.name === objectName);
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const root = path.join(__dirname, '..');
  const entries: CatalogEntry[] = JSON.parse(
    fs.readFileSync(path.join(root, 'supabase/catalog/exercises.json'), 'utf-8')
  );

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    const objectName = imagePath(entry);
    if (!entry.image || !objectName) continue;

    try {
      if (await alreadyUploaded(supabase, objectName)) {
        skipped++;
        continue;
      }

      const res = await fetch(entry.image.url);
      if (!res.ok) throw new Error(`download failed with HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const contentType = contentTypeFor(objectName, res.headers.get('content-type'));

      const { error } = await supabase.storage
        .from(EXERCISE_IMAGES_BUCKET)
        .upload(objectName, bytes, { contentType, upsert: false });
      if (error) throw error;

      uploaded++;
    } catch (err) {
      failed++;
      console.error(`Failed ${entry.slug} (${objectName}):`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Images: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed.`);
}

const isMainModule = process.argv[1]?.endsWith('upload-exercise-images.ts') ?? false;
if (isMainModule) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
