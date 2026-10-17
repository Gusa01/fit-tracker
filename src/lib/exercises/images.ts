import { supabase } from '../supabase';

export const EXERCISE_IMAGES_BUCKET = 'exercise-images';

export function exerciseImageUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(EXERCISE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}
