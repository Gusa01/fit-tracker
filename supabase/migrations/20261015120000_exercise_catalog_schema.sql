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

-- A user must not be able to claim a catalog slug.
alter table public.exercises add constraint exercises_slug_only_catalog check (slug is null or owner_id is null);

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
