-- Phase 4: nutrient selection, goals and profile setup.
--
-- Progress bars always compare CONSUMED intake to the goal (goals are intake amounts that
-- already assume typical absorption). goal_view only chooses whether the absorption score is
-- shown next to each bar.
alter table public.profiles
  add column goal_view text not null default 'absorption'
    check (goal_view in ('absorption', 'consumed'));

comment on column public.profiles.goal_view is
  '''absorption'': show the absorption score next to each consumed-vs-goal bar; ''consumed'': bars only.';

-- tracked_nutrients: a missing row means "tracked, recommended goal". Macros are always shown,
-- so their rows only carry custom goals.
comment on table public.tracked_nutrients is
  'Per-user nutrient selection and goal overrides. No row = tracked with the recommended goal.';
comment on column public.tracked_nutrients.custom_goal is
  'Goal override in the registry unit, per the nutrient''s period (day, or meal for added sugars). Null = recommended.';
