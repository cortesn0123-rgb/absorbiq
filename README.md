# AbsorbIQ (micronutrient tracker)

Track macro- and micronutrients from food, with estimated absorption. See `CLAUDE.md` for the full brief.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the keys.
3. Run the SQL in `supabase/migrations/` in your Supabase project (SQL Editor).
4. `npm run dev` and open http://localhost:3000

## Scripts

- `npm run dev` — dev server
- `npm run check` — typecheck, lint and unit tests
- `npm run format` — Prettier
