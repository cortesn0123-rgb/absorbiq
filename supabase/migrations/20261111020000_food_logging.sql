-- Phase 2: food search and logging.

-- ---------------------------------------------------------------------------
-- foods: nutrients are now keyed by registry id; the raw FDC values are kept too so the
-- mapping can be re-run without fetching the food again.
-- ---------------------------------------------------------------------------

alter table public.foods
  add column category text,
  add column fdc_nutrients jsonb not null default '{}'::jsonb;

comment on column public.foods.nutrients_per_100g is
  '{ "<registry nutrient id>": amount per 100 g in the registry unit }. A missing key means FDC has no data for that nutrient, which is not the same as zero.';
comment on column public.foods.fdc_nutrients is
  'Every nutrient FDC reported, per 100 g: { "<fdc nutrient number>": { "amount": n, "unit": "MG" } }.';
comment on column public.foods.portions is
  'Household portions: [{ "label": "1 cup", "grams": 198 }, ...].';

-- ---------------------------------------------------------------------------
-- food_logs: portion shown to the user, and snack occasions. Each snack is its own meal for
-- per-meal limits, so snacks are numbered within a day (Snack 1, Snack 2, ...).
-- ---------------------------------------------------------------------------

alter table public.food_logs
  add column snack_number smallint check (snack_number between 1 and 20),
  add column portion_label text check (length(portion_label) <= 200),
  add column portion_count numeric(6, 2) check (portion_count > 0);

update public.food_logs set snack_number = 1 where meal_slot = 'snack';

alter table public.food_logs
  add constraint food_logs_snack_number_only_for_snacks
    check ((meal_slot = 'snack') = (snack_number is not null)),
  add constraint food_logs_portion_label_has_count
    check ((portion_label is null) = (portion_count is null));

-- Recent foods
create index food_logs_user_created_idx on public.food_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- favorite_foods: one-tap logging with a saved portion
-- ---------------------------------------------------------------------------

create table public.favorite_foods (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id bigint not null references public.foods (id) on delete cascade,
  grams numeric(7, 1) not null check (grams > 0),
  portion_label text check (length(portion_label) <= 200),
  portion_count numeric(6, 2) check (portion_count > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, food_id),
  constraint favorite_foods_portion_label_has_count
    check ((portion_label is null) = (portion_count is null))
);

alter table public.favorite_foods enable row level security;

create policy "Users can read their own favorite foods"
  on public.favorite_foods for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own favorite foods"
  on public.favorite_foods for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own favorite foods"
  on public.favorite_foods for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own favorite foods"
  on public.favorite_foods for delete to authenticated
  using ((select auth.uid()) = user_id);
