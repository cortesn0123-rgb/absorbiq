# Phase 7.1 review

Date: 2026-11-22. Scope: Row Level Security on every table, secrets in client code, input validation on every route and Server Action, dead code. Baseline `npm run check`: green (732 tests).

## Security

| ID  | Severity | Finding                                                                                                                                                                                                                                    | Status                                                                                                                                                                                 |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | High     | `ai_suggestions` had delete and full-row update policies. The 30-a-day AI limit counts those rows, so a signed-in user could delete them (or change `suggestion_date`) through the Supabase API and get unlimited Claude calls on our key. | Fixed in `supabase/migrations/20261122000000_ai_suggestions_lockdown.sql`: delete policy dropped, update limited to the `accepted` column. Needs the owner to run it (NEEDS-YOU M-71). |
| L1  | Low      | The daily limit counts by `suggestion_date`, which comes from the user's timezone cookie. Changing the cookie can shift "today" by up to a day, so at most about twice the limit in a 24-hour span.                                        | Open. Changing the count to a rolling 24 hours touches the AI helper, which waits on its browser test (M-P6T).                                                                         |
| L2  | Low      | Two helper requests sent at the same moment both pass the count before either row is saved, so the limit can be exceeded by the number of parallel requests.                                                                               | Open, same reason as L1.                                                                                                                                                               |
| L3  | Low      | `/api/foods/search` has no per-user rate limit; a signed-in user could use up the FDC key's hourly quota.                                                                                                                                  | Fixed: 30 searches a minute and 200 an hour per user (`lib/rate-limit.ts`, in memory per server instance), 429 with Retry-After.                                                       |

Checked and fine:

- RLS is enabled on all 9 tables. User tables (`profiles`, `food_logs`, `tracked_nutrients`, `water_logs`, `training_logs`, `favorite_foods`, `ai_suggestions`) are limited to `auth.uid()`. `foods` and `absorption_factors` are read-only to signed-in users; only the service role writes them.
- `handle_new_user` is `security definer` with `search_path = ''`.
- The service-role client (`lib/supabase/admin.ts`) is `server-only` and used only for the FDC cache. Only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key reach the browser. `.env.example` lists every variable.
- Every Server Action and route validates input (`lib/logs/validate.ts`, `lib/profile.ts`, `lib/ai/request.ts`, tier/view/preset allow-lists). Updates and deletes rely on RLS plus `parseId`.
- `/auth/callback` uses `safeNextPath`, which blocks `//host` and `/\host` open redirects. Sign-out is POST only.

## Bugs

| ID  | Finding                                                                                                                                            | Status                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| B1  | Low energy availability (`lib/nutrients/energy-availability.ts`, CLAUDE.md section 4) is implemented and tested but not shown anywhere in the app. | Fixed: shown on the Day view for finished Athletic training days. |

## Dead code

An export scan found no unused production code: the remaining exports with no importer outside their file are constants and types used by tests (`lib/ai/fixtures.ts`, `lib/bioavailability/test-foods.ts`, registry/target constants) plus B1 above. Nothing removed.
