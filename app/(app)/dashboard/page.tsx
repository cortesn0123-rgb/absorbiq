import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { NutrientList, valuesFromEstimates } from "@/components/NutrientList";
import { TZ_COOKIE, formatDayLabel, formatLongDate, isIsoDate, todayIn } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { loadFactorTable } from "@/lib/logs/absorption-data";
import { absorbLogs } from "@/lib/logs/day-absorption";
import { buildGoalRows } from "@/lib/logs/day-goals";
import {
  getDayLogs,
  getFavoriteFoodIds,
  getTrainingSessions,
  getWaterLogs,
  type LoggedFood,
} from "@/lib/logs/queries";
import {
  compareOccasions,
  occasionKey,
  occasionLabel,
  snackSummaries,
  type MealOccasion,
} from "@/lib/meals";
import { applyCustomGoals } from "@/lib/nutrients/goals";
import { nutrientsForGrams, sumNutrients } from "@/lib/nutrients/portion";
import { getDailyTargets } from "@/lib/nutrients/targets";
import {
  VIEW_FILTERS,
  VIEW_FILTER_LABELS,
  customGoals,
  isViewFilter,
  trackedMicros,
  visibleNutrients,
  type ViewFilter,
} from "@/lib/nutrients/tracking";
import { lowEnergyAvailabilityFlag } from "@/lib/nutrients/energy-availability";
import { engineProfile, targetInput } from "@/lib/profile";
import { loadTracking, requireProfile } from "@/lib/settings";
import { DayNav } from "./DayNav";
import { FoodRow } from "./FoodRow";
import { GoalRow } from "./GoalRow";
import { WaterCard } from "./WaterCard";

export const metadata = { title: "Day · AbsorbIQ" };

export default function DayPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted">
          Loading…
        </p>
      }
    >
      <Day searchParams={searchParams} />
    </Suspense>
  );
}

const MAIN_MEALS: MealOccasion[] = [
  { slot: "breakfast", snackNumber: null },
  { slot: "lunch", snackNumber: null },
  { slot: "dinner", snackNumber: null },
];

/** Breakfast, lunch and dinner always; each logged snack; or one empty "Snack" section. */
function mealSections(logs: readonly LoggedFood[]) {
  const groups = new Map<string, { occasion: MealOccasion; logs: LoggedFood[] }>();
  for (const occasion of MAIN_MEALS) groups.set(occasionKey(occasion), { occasion, logs: [] });
  for (const log of logs) {
    const key = occasionKey(log.occasion);
    const group = groups.get(key) ?? { occasion: log.occasion, logs: [] };
    group.logs.push(log);
    groups.set(key, group);
  }
  if (!logs.some((l) => l.occasion.slot === "snack")) {
    groups.set("snack", { occasion: { slot: "snack", snackNumber: null }, logs: [] });
  }
  return [...groups.values()].sort((a, b) => compareOccasions(a.occasion, b.occasion));
}

function addHref(date: string, { slot, snackNumber }: MealOccasion): string {
  return `/log?date=${date}&meal=${slot}${snackNumber ? `&snack=${snackNumber}` : ""}`;
}

/** Day-view chips: narrow the tracked nutrients for the moment (kept in the URL, not saved). */
function FilterChips({ date, today, filter }: { date: string; today: string; filter: ViewFilter }) {
  return (
    <nav aria-label="Show nutrients" className="-mx-4 flex gap-2 overflow-x-auto px-4">
      {VIEW_FILTERS.map((f) => {
        const params = [date === today ? "" : `date=${date}`, f === "all" ? "" : `only=${f}`]
          .filter(Boolean)
          .join("&");
        return (
          <Link
            key={f}
            href={params ? `/dashboard?${params}` : "/dashboard"}
            aria-current={f === filter ? "true" : undefined}
            className="flex h-9 shrink-0 items-center rounded-full border border-zinc-300 px-4 text-sm font-medium aria-[current]:border-emerald-600 aria-[current]:bg-emerald-600 aria-[current]:text-white dark:border-zinc-700"
          >
            {VIEW_FILTER_LABELS[f]}
          </Link>
        );
      })}
    </nav>
  );
}

async function Day({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const { profile, supabase } = await requireProfile();
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const today = todayIn(cookieStore.get(TZ_COOKIE)?.value);
  const date = isIsoDate(params.date) ? params.date : today;
  const filter: ViewFilter = isViewFilter(params.only) ? params.only : "all";

  const [logs, water, favoriteIds, factors, tracking, training] = await Promise.all([
    getDayLogs(supabase, date),
    getWaterLogs(supabase, date),
    getFavoriteFoodIds(supabase),
    loadFactorTable(supabase),
    loadTracking(supabase),
    getTrainingSessions(supabase, date),
  ]);
  // Recomputed on every view (never stored), so factor changes apply to past days too.
  const absorption = absorbLogs(logs, engineProfile(profile), factors);
  const visible = visibleNutrients(trackedMicros(tracking), filter);
  const goals = applyCustomGoals(
    getDailyTargets(targetInput(profile, training)),
    customGoals(tracking),
  );
  const portions = new Map(
    logs.map((l) => [l.id, nutrientsForGrams(l.food.nutrientsPer100g, l.grams)]),
  );
  const totals = sumNutrients([...portions.values()]);
  const lowEa = lowEnergyAvailabilityFlag({
    athletic: profile.targetTier === "athletic",
    dayComplete: date < today,
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    bodyFatPct: profile.bodyFatPct,
    intakeKcal: totals.energy.amount ?? 0,
    sessions: training,
  });
  const snackNumbers = snackSummaries(logs).map((s) => s.snackNumber);
  const favorites = new Set(favoriteIds);
  const goalRows = buildGoalRows({
    visible,
    goals,
    foods: logs.map((l) => ({ occasion: l.occasion, amounts: portions.get(l.id)! })),
    absorption: absorption.day.totals,
    showScore: profile.goalView === "absorption",
    factors,
  });

  return (
    <div className="flex flex-col gap-5">
      <DayNav
        date={date}
        today={today}
        label={formatDayLabel(date, today)}
        longDate={formatLongDate(date)}
        query={filter === "all" ? "" : `only=${filter}`}
      />

      <FilterChips date={date} today={today} filter={filter} />

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Consumed</h2>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatNumber(totals.energy.amount ?? 0)}{" "}
          <span className="text-base font-normal text-muted">kcal</span>
        </p>
        <p className="mt-1 text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
          Protein {formatNumber(totals.protein.amount ?? 0)} g · Carbs{" "}
          {formatNumber(totals.carbohydrate.amount ?? 0)} g · Fat{" "}
          {formatNumber(totals.fat.amount ?? 0)} g
        </p>
        {lowEa && (
          <div role="note" className="mt-3 rounded-lg border border-status-warning p-3 text-sm">
            <p className="font-medium">
              Low energy availability: about {formatNumber(lowEa.kcalPerKgFfm)} kcal per kg of
              fat-free mass
            </p>
            {lowEa.notes.map((n) => (
              <p key={n} className="mt-1 text-zinc-600 dark:text-zinc-400">
                {n}
              </p>
            ))}
          </div>
        )}
        {logs.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer py-1 text-zinc-600 dark:text-zinc-400">
              Eaten vs absorbed
            </summary>
            <div className="pt-2">
              <NutrientList values={valuesFromEstimates(absorption.day.totals)} visible={visible} />
            </div>
          </details>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Goals</h2>
          <Link
            href="/settings/nutrients"
            className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Edit
          </Link>
        </div>
        {goalRows.length === 0 ? (
          <p className="py-2 text-sm text-muted">No tracked nutrients with a goal in this view.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {goalRows.map((row) => (
              <GoalRow key={row.id} row={row} />
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">
          Bars compare what you ate with your goal.
          {profile.goalView === "absorption" &&
            " The absorption score (1.0 = typical absorption for what you ate) shows whether your food pairings help or hold back absorption."}{" "}
          Tap a goal for its source.
        </p>
      </section>

      <WaterCard
        date={date}
        entries={water}
        foodWaterMl={totals.water.amount}
        foodWaterPartial={totals.water.missingCount > 0}
      />

      {mealSections(logs).map(({ occasion, logs: mealLogs }) => {
        const label =
          occasion.slot === "snack" && occasion.snackNumber === null
            ? "Snack"
            : occasionLabel(occasion);
        const kcal = mealLogs.reduce((sum, l) => sum + (portions.get(l.id)?.energy ?? 0), 0);
        const mealTotals = absorption.byMeal.get(occasionKey(occasion));
        return (
          <section key={occasionKey(occasion)}>
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-1 dark:border-zinc-800">
              <h2 className="font-semibold">
                {label}
                {mealLogs.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted tabular-nums">
                    {formatNumber(kcal)} kcal
                  </span>
                )}
              </h2>
              <Link
                href={addHref(date, occasion)}
                className="flex h-10 items-center rounded-lg px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                aria-label={`Add food to ${label}`}
              >
                + Add
              </Link>
            </div>
            {mealLogs.length === 0 ? (
              <p className="py-3 text-sm text-muted">Nothing logged.</p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {mealLogs.map((log) => (
                  <FoodRow
                    key={log.id}
                    log={log}
                    absorption={absorption.byLog.get(log.id)!}
                    isFavorite={favorites.has(log.food.id)}
                    snackNumbers={snackNumbers}
                    visible={visible}
                  />
                ))}
              </ul>
            )}
            {mealTotals && (
              <details className="text-sm">
                <summary className="cursor-pointer py-2 text-zinc-600 dark:text-zinc-400">
                  {label} nutrients: eaten vs absorbed
                </summary>
                <div className="pb-3">
                  <NutrientList values={valuesFromEstimates(mealTotals)} visible={visible} />
                </div>
              </details>
            )}
          </section>
        );
      })}

      {logs.length > 0 && (
        <p className="text-xs text-muted">
          Absorbed amounts are estimates that depend on what you ate together in each meal; tap one
          to see why. &ldquo;No data&rdquo; or &ldquo;–&rdquo; means FoodData Central has no value
          for that nutrient, which is not the same as zero.
        </p>
      )}

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-zinc-200 bg-background/95 p-3 backdrop-blur dark:border-zinc-800">
        <Link
          href={`/log?date=${date}`}
          className="mx-auto flex h-12 max-w-2xl items-center justify-center rounded-lg bg-emerald-600 text-base font-medium text-white hover:bg-emerald-700"
        >
          Log food
        </Link>
      </div>
    </div>
  );
}
