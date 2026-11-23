import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { dayInsights, rankInsights, type Insight } from "@/lib/bioavailability";
import { TZ_COOKIE, addDays, formatLongDate, todayIn } from "@/lib/dates";
import { formatAmount } from "@/lib/format";
import { loadFactorTable } from "@/lib/logs/absorption-data";
import {
  biggestGaps,
  historyRows,
  macroSummary,
  microRows,
  upperLimitWarnings,
} from "@/lib/logs/dashboard";
import { absorbLogs, mealInputs } from "@/lib/logs/day-absorption";
import { buildGoalRows, type GoalRowData } from "@/lib/logs/day-goals";
import {
  getLogsInRange,
  getTrainingInRange,
  getWaterTotalsInRange,
  type LoggedFood,
} from "@/lib/logs/queries";
import { applyCustomGoals } from "@/lib/nutrients/goals";
import { nutrientsForGrams } from "@/lib/nutrients/portion";
import type { NutrientId } from "@/lib/nutrients/registry";
import { getDailyTargets } from "@/lib/nutrients/targets";
import { customGoals, trackedMicros, visibleNutrients } from "@/lib/nutrients/tracking";
import { engineProfile, targetInput } from "@/lib/profile";
import { loadTracking, requireProfile } from "@/lib/settings";
import { HistoryChart } from "./HistoryChart";
import { MacroCard } from "./MacroCard";
import { MARKER_NOTE, NutrientBar } from "./NutrientBar";

export const metadata = { title: "Dashboard · AbsorbIQ" };

/** Days in the longest history view. */
const HISTORY_DAYS = 30;

const cardClass = "rounded-xl border border-zinc-200 p-4 dark:border-zinc-800";
const headingClass = "text-xs font-semibold tracking-wide text-muted uppercase";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted">
          Loading…
        </p>
      }
    >
      <Dashboard />
    </Suspense>
  );
}

function foodsOf(logs: readonly LoggedFood[]) {
  return logs.map((l) => ({
    occasion: l.occasion,
    amounts: nutrientsForGrams(l.food.nutrientsPer100g, l.grams),
  }));
}

async function Dashboard() {
  const { profile, supabase } = await requireProfile();
  const cookieStore = await cookies();
  const today = todayIn(cookieStore.get(TZ_COOKIE)?.value);
  const from = addDays(today, -(HISTORY_DAYS - 1));

  // One query per table for the whole range; today's data is a slice of it.
  const [logs, water, training, factors, tracking] = await Promise.all([
    getLogsInRange(supabase, from, today),
    getWaterTotalsInRange(supabase, from, today),
    getTrainingInRange(supabase, from, today),
    loadFactorTable(supabase),
    loadTracking(supabase),
  ]);

  const visible = visibleNutrients(trackedMicros(tracking));
  const custom = customGoals(tracking);
  const goalsFor = (date: string) =>
    applyCustomGoals(getDailyTargets(targetInput(profile, training.get(date) ?? [])), custom);
  const logsByDay = new Map<string, LoggedFood[]>();
  for (const log of logs) logsByDay.set(log.date, [...(logsByDay.get(log.date) ?? []), log]);

  // Today: the same inputs and functions as the Day view, so the numbers match.
  const todayLogs = logsByDay.get(today) ?? [];
  const goals = goalsFor(today);
  const foods = foodsOf(todayLogs);
  const absorption = absorbLogs(todayLogs, engineProfile(profile), factors);
  const rows = buildGoalRows({
    visible,
    goals,
    foods,
    absorption: absorption.day.totals,
    showScore: true,
    factors,
  });
  const showScore = profile.goalView === "absorption";

  const insightGoals: Partial<Record<NutrientId, number>> = {};
  for (const id of visible) {
    const g = goals[id];
    if (g.kind === "target" && g.per === "day" && g.value !== null) insightGoals[id] = g.value;
  }
  const insights = rankInsights(
    dayInsights(mealInputs(todayLogs), engineProfile(profile), factors),
    insightGoals,
    factors,
  );

  const dates = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(from, i));
  const history = historyRows(
    dates.map((date) => ({
      date,
      goals: goalsFor(date),
      foods: foodsOf(logsByDay.get(date) ?? []),
    })),
    visible,
    formatAmount,
  );

  const micros = microRows(rows);
  const warnings = upperLimitWarnings(rows);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-muted">{formatLongDate(today)}</p>
        </div>
        <Link
          href="/dashboard"
          className="flex h-10 items-center rounded-lg px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          Meals →
        </Link>
      </div>

      {warnings.length > 0 && <UpperLimitWarnings rows={warnings} />}

      <MacroCard macros={macroSummary({ goals, foods, waterDrunkMl: water.get(today) ?? 0 })} />

      <section className={cardClass}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={headingClass}>Vitamins & minerals</h2>
          <Link
            href="/settings/nutrients"
            className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Edit
          </Link>
        </div>
        {micros.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            You are not tracking any vitamins or minerals with a goal.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {micros.map((row) => (
              <li key={row.id}>
                <NutrientBar row={row} showMarker showScore={showScore} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted" title={MARKER_NOTE}>
          Bars show what you ate vs your goal. The thin marker shifts that by the absorption score
          (estimate): ahead of the bar when your food pairings helped absorption, behind when they
          held it back.
        </p>
      </section>

      <Gaps rows={biggestGaps(rows)} logged={todayLogs.length > 0} />

      <Insights insights={insights} logged={todayLogs.length > 0} />

      <HistoryChart dates={dates} rows={history} />

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-zinc-200 bg-background/95 p-3 backdrop-blur dark:border-zinc-800">
        <Link
          href={`/log?date=${today}`}
          className="mx-auto flex h-12 max-w-2xl items-center justify-center rounded-lg bg-emerald-600 text-base font-medium text-white hover:bg-emerald-700"
        >
          Log food
        </Link>
      </div>
    </div>
  );
}

function UpperLimitWarnings({ rows }: { rows: GoalRowData[] }) {
  return (
    <section
      role="alert"
      className="rounded-xl border-2 border-status-critical bg-red-50 p-4 text-red-900 dark:bg-red-950/40 dark:text-red-100"
    >
      <h2 className="font-semibold">⚠ Above a tolerable upper limit</h2>
      <ul className="mt-1 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="py-0.5 tabular-nums">
            <span className="font-medium">{r.name}:</span>{" "}
            {r.consumed !== null && formatAmount(r.consumed, r.unit)} from food today; upper limit{" "}
            {formatAmount(r.overUl!.ul, r.unit)}.
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">
        Regularly eating more than the upper limit can cause harm. Talk to a doctor or registered
        dietitian if this is typical for you.
      </p>
    </section>
  );
}

function Gaps({ rows, logged }: { rows: GoalRowData[]; logged: boolean }) {
  return (
    <section className={cardClass}>
      <h2 className={headingClass}>Biggest gaps</h2>
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          {logged ? "Every tracked goal is met. Nice work." : "Log food to see your gaps."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium">{r.name}</p>
                <p className="text-muted tabular-nums">
                  {formatAmount(r.consumed ?? 0, r.unit)} of {r.goalLabel} ·{" "}
                  {Math.round((r.ratio ?? 0) * 100)}%
                </p>
              </div>
              <Link
                href={`/helper?nutrient=${r.id}`}
                className="flex h-10 shrink-0 items-center rounded-lg border border-emerald-600 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                Ask AI helper
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/helper?ask=1"
        className="mt-3 flex h-11 items-center justify-center rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Ask for suggestions
      </Link>
    </section>
  );
}

function Insights({ insights, logged }: { insights: Insight[]; logged: boolean }) {
  return (
    <section className={cardClass}>
      <h2 className={headingClass}>Absorption insights</h2>
      {insights.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          {logged
            ? "Nothing in today's meals is holding back absorption of the nutrients you track."
            : "Log meals to get tips on food pairings."}
        </p>
      ) : (
        <ul className="mt-1 flex flex-col gap-2">
          {insights.map((i) => (
            <li
              key={`${i.mealKey}-${i.kind}-${i.text}`}
              className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900"
            >
              {i.text}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">
        From the absorption engine&apos;s estimates for what you ate together in each meal, not from
        AI. Amounts marked ~ are estimates.
      </p>
    </section>
  );
}
