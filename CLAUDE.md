# Micronutrient Tracker — Project Brief

This file is the permanent brief for the project. Read it before starting any work. If a phase instruction conflicts with this file, ask before proceeding.

---

## 1. Product

A web app for tracking macronutrients and micronutrients from the food a person eats.

### Core features

1. **Food logging**
   - Log foods and portions.
   - Show the micronutrients in each food and the totals per day.

2. **Bioavailability**
   - For every food and every day, show both the amount **CONSUMED** and the estimated amount **ABSORBED**, so the user knows what their body actually takes in.
   - Absorbed amounts must account for **meal context** (what was eaten together), not just the food alone.

3. **Nutrient filters**
   - The user chooses which micronutrients to track and sets goals for them.
   - The whole UI respects that selection.

4. **AI helper**
   - Suggests specific foods and portions to close the gap between **consumed** intake and the user's goals for the rest of the day, favouring pairings that raise the **absorption score** (see section 5, Goals and absorption score).

5. **Macro tracker**
   - Calories, protein, carbs, fiber, sugars, added sugars, fat (saturated, trans, monounsaturated, polyunsaturated, omega-3 ALA, omega-6 linoleic), cholesterol and water.
   - Shown alongside the micros.

---

## 2. Stack

| Concern   | Choice                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| Framework | Next.js (App Router) + TypeScript (`strict`) + Tailwind CSS                    |
| Hosting   | Vercel                                                                         |
| Auth      | Supabase Auth, email magic link                                                |
| Database  | Supabase Postgres with Row Level Security — users only ever see their own data |
| Food data | USDA FoodData Central (FDC) API                                                |
| AI        | Claude API via the official `@anthropic-ai/sdk` package                        |

### Configuration and secrets

- `FDC_API_KEY` — USDA FoodData Central key.
- `ANTHROPIC_API_KEY` — Claude API key.
- Supabase URL and keys as required by the Supabase client.
- All secrets live in `.env.local`, which is **never committed**.
- Keep a `.env.example` with every variable name and blank values.
- The Claude model name lives in **one config constant** (default: `claude-sonnet-5-5`) so it can be swapped in one place.

### FDC caching

- Cache FDC responses in our database. The same food must never be fetched from FDC twice.

---

## 3. Nutrients in scope

**Vitamins:** A (RAE), C, D, E (alpha-tocopherol), K, B1 thiamin, B2 riboflavin, B3 niacin, B5 pantothenic acid, B6, B7 biotin, B9 folate (DFE), B12, choline.

**Minerals:** calcium, iron, magnesium, zinc, potassium, sodium, chloride, selenium, copper, manganese, phosphorus, iodine, chromium, molybdenum.

**Macros:** everything listed in feature 5.

---

## 4. Target tiers

The user picks one tier.

| Tier                     | Basis                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FDA minimum**          | FDA Daily Values; one value for all adults. The sodium, saturated fat, added sugars and cholesterol DVs are **upper limits** and must be labeled as limits, not goals. |
| **Average man / woman**  | National Academies DRIs (RDA/AI) by age and sex; AMDR for macro percentages; 2023 NASEM energy equations.                                                              |
| **Athletic man / woman** | The Average tier plus peer-reviewed sports-nutrition rules, scaled by body weight and training load.                                                                   |

Average and Athletic limits from the **Dietary Guidelines for Americans 2025–2030**:

- **Saturated fat:** under 10% of calories per day.
- **Added sugars:** at most **10 g per meal**, summed per meal; flag any meal over.
- **Each snack counts as its own meal** for the added-sugar limit; snacks are never summed together. Breakfast, lunch and dinner are one meal each. Food logs carry a `snack_number` (Snack 1, Snack 2, ...); `lib/meals.ts` defines meal occasions and `lib/nutrients/meal-limits.ts` groups by occasion.

Athletic micronutrient rules (everything else = Average):

- **Iron:** Average RDA +30% (female endurance +70%; women may go up to +70%), never above the 45 mg UL; pregnancy/lactation keep the DRI. Label as not an official recommendation and suggest a ferritin test.
- **Vitamin D:** intake target stays at the RDA; note that athlete studies treat blood 25(OH)D ≥ 30 ng/mL as adequate and suggest getting tested.
- **Sodium, chloride, potassium, water:** add estimated sweat losses on training days (measured sweat loss, else ~1 L/h). Chloride is capped at its UL.
- **Macro floor:** no Athletic macro target except fat is ever below the Average tier's value for the same profile; the higher of the two is used (`floorAtAverage` in `lib/nutrients/targets.ts`). Limits are not floored.
- **Fat:** Athletic fat = the energy target minus protein and carbs (4/4/9 kcal/g), so the three add up to the energy target. Fat is never below 20% of energy and has no upper cap. If protein and carbs leave less than 20%, carbs are trimmed, but never below the bottom of their training-load band or the Average tier's carbs; only if that still doesn't fit do calories run over, with a note (`balanceAthleticFat`).
- **Low energy availability:** flag days under ~30 kcal/kg fat-free mass (`lib/nutrients/energy-availability.ts`), noting the threshold is debated.

Values come from the official sources cited in the registry (FDA 21 CFR 101.9, NASEM DRI tables, NASEM 2023 energy equations, DGA 2025–2030). Verify any new value against its source; do not substitute numbers from memory.

### Nutrient registry (single source of truth)

One registry file defines every nutrient. Every other part of the app reads from it — no nutrient metadata is duplicated elsewhere. Each entry has:

- `id`
- display name
- unit
- FDC nutrient number(s)
- kind: `target` or `limit`
- values per tier
- tolerable upper limit (UL)
- citation

---

## 5. Non-negotiable rules

### Bioavailability engine

- All bioavailability logic lives in **one pure, unit-tested module**: `lib/bioavailability`. No absorption math anywhere else.
- Every absorption factor is **data, not inline code**: stored in a config table with a value, a low–high range, and a source citation.
- **Never double count.** USDA already reports vitamin A as RAE and folate as DFE, which already include an absorption adjustment. The engine must not apply a second conversion to those.
- **Iron:** non-heme iron uses the Hallberg & Hulthén (2000) algorithm: absorption from an inhibitor-free meal, then each enhancer or inhibitor factor applied **once**. Do not stack inhibitor effects on a baseline that already reflects typical meals (e.g. Monsen's 3%).

### Goals and absorption score

- **Goals stay as published** (FDA DVs, DRIs, DGA limits). They are intake amounts and already assume typical absorption, so never convert a goal into an absorbed amount.
- **Progress bars compare CONSUMED intake to the goal.** Never compare absorbed amounts to a goal.
- **Absorption score** = absorbed ÷ expected absorbed, where expected absorbed = goal × the nutrient's typical absorption factor (`typicalAbsorption` in `lib/bioavailability/score.ts`, from the factor table). It shows whether the user's food pairings beat (above 1) or fall short of (below 1) a typical diet. `pairing` (= score ÷ progress) isolates the pairing effect.
- Not scored: limits, nutrients counted as eaten (calories, fiber, water), carbohydrate (its goal includes fiber, which is not absorbed) and nutrients with no goal.
- The **AI helper** closes consumed-vs-goal gaps, and among foods that do, favours pairings that raise the absorption score (e.g. vitamin C with plant iron, fat with carotenoids, tea away from iron-rich meals).

### Presentation of estimates

- Absorbed values are always shown as **estimates** (a range or a `~`), with a tooltip explaining why.
- Show **upper-limit warnings** when intake from food would exceed a tolerable upper limit.

### Medical disclaimer

- The app is informational, not medical advice. Show a short disclaimer in the **footer** and in the **AI helper**.

### AI helper integrity

- The AI helper **never invents nutrient numbers**. It proposes foods; our code looks them up in FDC and calculates nutrients and absorption. Only computed numbers are shown to the user.

### UX

- Mobile-first layout.
- Logging a food must take **under 15 seconds** on a phone.

---

## 6. Workflow

- Work happens in **phases**, sent one at a time. Do only the current phase.
- If anything in a phase is ambiguous, **ask before building it**.
- At the end of every phase:
  1. Run the type check, linter and tests. Fix all failures.
  2. Commit to git with a clear message.
  3. Give a short summary and the exact steps to test the phase in the browser.

---

## 7. Codebase notes

- **Next.js 16**: read `AGENTS.md`. Middleware is now `proxy.ts`; Cache Components are on, so anything that reads cookies/session must sit inside a `<Suspense>` boundary.
- Key paths: `lib/nutrients/registry.ts` (nutrient source of truth), `lib/nutrients/targets.ts` (daily targets), `lib/supabase/*` (clients), `lib/auth.ts` (`requireUser`: call it inside `<Suspense>` on every signed-in page; it awaits `connection()` so the page renders per request), `supabase/migrations/` (SQL), `lib/fdc/*` (FDC client, cache, nutrient mapping; tag rules in `lib/fdc/tag-rules.ts`), `lib/nutrients/portion.ts` (per-portion math), `app/(app)/actions.ts` (logging Server Actions), `lib/bioavailability/*` (absorption engine; factors in `factors.ts`, explained in `docs/bioavailability.md`; seed migration via `npm run db:absorption-seed`).
- Users must be 14 or older (DRI tables in the registry start at 14–18).
- Signed-in pages call `requireProfile()` (`lib/settings.ts`) instead of `requireUser()` when they need the profile; it sends incomplete profiles to `/onboarding`. Profile mapping, form validation and lb/ft-in → kg/cm live in `lib/profile.ts`.
- Nutrient selection: `lib/nutrients/tracking.ts` (presets, `trackedMicros`, `visibleNutrients`; no row in `tracked_nutrients` = tracked). Macros are always shown. Every nutrient list takes a `visible` list from there, and so must the AI helper.
- Goals: `lib/nutrients/goals.ts` applies custom overrides to `getDailyTargets` output; `lib/logs/day-goals.ts` builds the Day view's consumed-vs-goal rows. `profiles.goal_view` only toggles the absorption score next to each bar; bars always use consumed intake.
- Checks: `npm run check` (typecheck + lint + tests). Format with `npm run format`.
