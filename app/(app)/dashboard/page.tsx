import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { NutrientList, valuesFromEstimates } from "@/components/NutrientList";
import { requireUser } from "@/lib/auth";
import { TZ_COOKIE, formatDayLabel, formatLongDate, isIsoDate, todayIn } from "@/lib/dates";
import { formatAmount, formatNumber } from "@/lib/format";
import { loadEngineProfile, loadFactorTable } from "@/lib/logs/absorption-data";
import { absorbLogs } from "@/lib/logs/day-absorption";
import { getDayLogs, getFavoriteFoodIds, getWaterLogs, type LoggedFood } from "@/lib/logs/queries";
import {
  compareOccasions,
  occasionKey,
  occasionLabel,
  snackSummaries,
  type MealOccasion,
} from "@/lib/meals";
import { nutrientsForGrams, sumNutrients } from "@/lib/nutrients/portion";
import { createClient } from "@/lib/supabase/server";
import { DayNav } from "./DayNav";
import { FoodRow } from "./FoodRow";
import { WaterCard } from "./WaterCard";

export const metadata = { title: "Day · Micronutrient Tracker" };

export default function DayPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
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

async function Day({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const user = await requireUser();
  const [params, cookieStore, supabase] = await Promise.all([
    searchParams,
    cookies(),
    createClient(),
  ]);
  const today = todayIn(cookieStore.get(TZ_COOKIE)?.value);
  const date = isIsoDate(params.date) ? params.date : today;

  const [logs, water, favoriteIds, profile, factors] = await Promise.all([
    getDayLogs(supabase, date),
    getWaterLogs(supabase, date),
    getFavoriteFoodIds(supabase),
    loadEngineProfile(supabase, user.id),
    loadFactorTable(supabase),
  ]);
  // Recomputed on every view (never stored), so factor changes apply to past days too.
  const absorption = absorbLogs(logs, profile, factors);
  const dayIron = absorption.day.totals.iron;
  const portions = new Map(
    logs.map((l) => [l.id, nutrientsForGrams(l.food.nutrientsPer100g, l.grams)]),
  );
  const totals = sumNutrients([...portions.values()]);
  const snackNumbers = snackSummaries(logs).map((s) => s.snackNumber);
  const favorites = new Set(favoriteIds);

  return (
    <div className="flex flex-col gap-5">
      <DayNav
        date={date}
        today={today}
        label={formatDayLabel(date, today)}
        longDate={formatLongDate(date)}
      />

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Consumed</h2>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatNumber(totals.energy.amount ?? 0)}{" "}
          <span className="text-base font-normal text-zinc-500">kcal</span>
        </p>
        <p className="mt-1 text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
          Protein {formatNumber(totals.protein.amount ?? 0)} g · Carbs{" "}
          {formatNumber(totals.carbohydrate.amount ?? 0)} g · Fat{" "}
          {formatNumber(totals.fat.amount ?? 0)} g
        </p>
        {dayIron.consumed !== null && dayIron.absorbed !== null && (
          <p className="mt-1 text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
            Iron {formatAmount(dayIron.consumed, "mg")} eaten · ~
            {formatAmount(dayIron.absorbed, "mg")} absorbed
          </p>
        )}
        {logs.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer py-1 text-zinc-600 dark:text-zinc-400">
              All nutrients
            </summary>
            <div className="pt-2">
              <NutrientList values={valuesFromEstimates(absorption.day.totals)} />
            </div>
          </details>
        )}
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
                  <span className="ml-2 text-sm font-normal text-zinc-500 tabular-nums">
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
              <p className="py-3 text-sm text-zinc-400">Nothing logged.</p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {mealLogs.map((log) => (
                  <FoodRow
                    key={log.id}
                    log={log}
                    absorption={absorption.byLog.get(log.id)!}
                    isFavorite={favorites.has(log.food.id)}
                    snackNumbers={snackNumbers}
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
                  <NutrientList values={valuesFromEstimates(mealTotals)} />
                </div>
              </details>
            )}
          </section>
        );
      })}

      {logs.length > 0 && (
        <p className="text-xs text-zinc-500">
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
