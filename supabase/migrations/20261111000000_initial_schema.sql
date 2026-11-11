-- Initial schema: profiles, FDC food cache, logs, tracked nutrients, absorption factors,
-- AI suggestions. Every table has Row Level Security enabled.
--
-- Nutrient ids (e.g. 'iron', 'vitamin_a') are defined in lib/nutrients/registry.ts and are
-- stored here as text; the registry is the source of truth.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per user, created automatically on sign-up
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  age integer check (age between 14 and 120),
  sex text check (sex in ('male', 'female')),
  life_stage text not null default 'none' check (life_stage in ('none', 'pregnant', 'lactating')),
  gestation_weeks integer check (gestation_weeks between 1 and 42),
  prepregnancy_weight_kg numeric(5, 1) check (prepregnancy_weight_kg > 0),
  lactation_months_postpartum integer check (lactation_months_postpartum between 0 and 60),
  diet_type text check (diet_type in ('omnivore', 'pescatarian', 'vegetarian', 'vegan')),
  weight_kg numeric(5, 1) check (weight_kg > 0),
  height_cm numeric(5, 1) check (height_cm > 0),
  activity_level text check (activity_level in ('inactive', 'low_active', 'active', 'very_active')),
  training_hours_per_day numeric(4, 2) not null default 0 check (training_hours_per_day between 0 and 12),
  training_type text not null default 'none'
    check (training_type in ('none', 'endurance', 'strength', 'team_sport', 'mixed')),
  target_tier text not null default 'fda' check (target_tier in ('fda', 'average', 'athletic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint life_stage_requires_female check (life_stage = 'none' or sex = 'female')
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Create an empty profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- foods: shared cache of FDC foods. Readable by any signed-in user.
-- No insert/update policies: only the server (service role) writes to this table,
-- so users cannot tamper with cached nutrient data.
-- ---------------------------------------------------------------------------

create table public.foods (
  id bigint generated always as identity primary key,
  fdc_id integer not null unique,
  name text not null,
  data_type text not null,
  brand text,
  -- { "<fdc nutrient number>": amount per 100 g, ... }
  nutrients_per_100g jsonb not null default '{}'::jsonb,
  -- [{ "label": "1 cup", "grams": 240 }, ...]
  portions jsonb not null default '[]'::jsonb,
  -- Our tags, used by the bioavailability engine
  is_heme_source boolean not null default false,
  phytate_level text not null default 'none' check (phytate_level in ('none', 'low', 'medium', 'high')),
  oxalate_level text not null default 'none' check (oxalate_level in ('none', 'low', 'medium', 'high')),
  is_fortified boolean not null default false,
  fat_g numeric(7, 2) check (fat_g >= 0),
  fetched_at timestamptz not null default now()
);

create index foods_name_idx on public.foods using gin (to_tsvector('english', name));

alter table public.foods enable row level security;

create policy "Signed-in users can read cached foods"
  on public.foods for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- food_logs
-- ---------------------------------------------------------------------------

create table public.food_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id bigint not null references public.foods (id) on delete restrict,
  grams numeric(7, 1) not null check (grams > 0),
  created_at timestamptz not null default now()
);

create index food_logs_user_date_idx on public.food_logs (user_id, log_date);
create index food_logs_food_idx on public.food_logs (food_id);

alter table public.food_logs enable row level security;

create policy "Users can read their own food logs"
  on public.food_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own food logs"
  on public.food_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own food logs"
  on public.food_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own food logs"
  on public.food_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- tracked_nutrients: which nutrients a user tracks, with optional custom goals
-- ---------------------------------------------------------------------------

create table public.tracked_nutrients (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nutrient_id text not null,
  enabled boolean not null default true,
  custom_goal numeric check (custom_goal > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, nutrient_id)
);

create trigger tracked_nutrients_set_updated_at
  before update on public.tracked_nutrients
  for each row execute function public.set_updated_at();

alter table public.tracked_nutrients enable row level security;

create policy "Users can read their own tracked nutrients"
  on public.tracked_nutrients for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own tracked nutrients"
  on public.tracked_nutrients for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own tracked nutrients"
  on public.tracked_nutrients for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tracked nutrients"
  on public.tracked_nutrients for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- water_logs
-- ---------------------------------------------------------------------------

create table public.water_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  ml integer not null check (ml > 0 and ml <= 10000),
  created_at timestamptz not null default now()
);

create index water_logs_user_date_idx on public.water_logs (user_id, log_date);

alter table public.water_logs enable row level security;

create policy "Users can read their own water logs"
  on public.water_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own water logs"
  on public.water_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own water logs"
  on public.water_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own water logs"
  on public.water_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- training_logs
-- ---------------------------------------------------------------------------

create table public.training_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  intensity text not null check (intensity in ('low', 'moderate', 'high', 'very_high')),
  sweat_loss_kg numeric(4, 2) check (sweat_loss_kg >= 0 and sweat_loss_kg <= 10),
  created_at timestamptz not null default now()
);

create index training_logs_user_date_idx on public.training_logs (user_id, log_date);

alter table public.training_logs enable row level security;

create policy "Users can read their own training logs"
  on public.training_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own training logs"
  on public.training_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own training logs"
  on public.training_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own training logs"
  on public.training_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- absorption_factors: reference data for lib/bioavailability. Read-only for users;
-- populated by migrations.
-- ---------------------------------------------------------------------------

create table public.absorption_factors (
  id bigint generated always as identity primary key,
  nutrient_id text not null,
  condition_key text not null,
  factor numeric not null check (factor >= 0),
  low numeric not null check (low >= 0),
  high numeric not null,
  source_citation text not null check (length(source_citation) > 0),
  unique (nutrient_id, condition_key),
  check (low <= factor and factor <= high)
);

alter table public.absorption_factors enable row level security;

create policy "Signed-in users can read absorption factors"
  on public.absorption_factors for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- ai_suggestions
-- ---------------------------------------------------------------------------

create table public.ai_suggestions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  suggestion_date date not null,
  request jsonb not null,
  response jsonb not null,
  -- null = not yet answered
  accepted boolean,
  created_at timestamptz not null default now()
);

create index ai_suggestions_user_date_idx on public.ai_suggestions (user_id, suggestion_date);

alter table public.ai_suggestions enable row level security;

create policy "Users can read their own AI suggestions"
  on public.ai_suggestions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own AI suggestions"
  on public.ai_suggestions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own AI suggestions"
  on public.ai_suggestions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own AI suggestions"
  on public.ai_suggestions for delete to authenticated
  using ((select auth.uid()) = user_id);
