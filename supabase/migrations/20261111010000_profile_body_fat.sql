-- Optional body fat %, used to compute fat-free mass for the energy availability check.
-- When null, fat-free mass is estimated from height, weight and sex (Boer formula).
alter table public.profiles
  add column body_fat_pct numeric(4, 1) check (body_fat_pct > 2 and body_fat_pct < 70);
