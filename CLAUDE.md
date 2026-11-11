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
   - Suggests specific foods and portions to close the gap between **absorbed** intake and the user's goals for the rest of the day.

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

Full values come from the **Daily Targets Reference** supplied in Prompt 1. Use those values; do not substitute numbers from memory.

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
- Key paths: `lib/nutrients/registry.ts` (nutrient source of truth), `lib/nutrients/targets.ts` (daily targets), `lib/supabase/*` (clients), `lib/auth.ts` (`requireUser`), `supabase/migrations/` (SQL).
- Users must be 14 or older (DRI tables in the registry start at 14–18).
- Checks: `npm run check` (typecheck + lint + tests). Format with `npm run format`.
