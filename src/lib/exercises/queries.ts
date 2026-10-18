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
