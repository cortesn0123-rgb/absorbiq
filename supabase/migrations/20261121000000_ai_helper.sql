-- Phase 6: AI helper.
--
-- Foods the user avoids (e.g. 'dairy', 'peanuts'). The helper is told about them and our code
-- removes any suggested food that matches. Saved only after the user confirms in the chat, and
-- editable in Settings.
alter table public.profiles
  add column avoided_foods text[] not null default '{}'
    check (cardinality(avoided_foods) <= 50);

comment on column public.profiles.avoided_foods is
  'Lower-case foods or food groups the AI helper must not suggest. Set after the user confirms.';

-- ai_suggestions (created in the initial schema) stores each helper request and response.
-- Rows per user per day are counted for the daily request limit.
comment on table public.ai_suggestions is
  'One row per AI helper request: the request, the computed plans, and whether a food was logged from it.';
