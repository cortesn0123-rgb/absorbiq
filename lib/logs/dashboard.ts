/**
 * Dashboard data: built from the same goal rows as the Day view (lib/logs/day-goals.ts), so
 * every number matches it. Progress always uses CONSUMED intake; absorption is shown only as
 * the absorption score marker (see CLAUDE.md).
 */

import type { NutrientAmounts } from "@/lib/fdc/mapping";
import type { MealOccasion } from "@/lib/meals";
import { goalLabel, goalProgress, goalRange, goalSource, type Goals } from "@/lib/nutrients/goals";
import { sumNutrients } from "@/lib/nutrients/portion";
import { NUTRIENTS, type NutrientId, type Unit } from "@/lib/nutrients/registry";
import { KCAL_PER_G } from "@/lib/nutrients/targets";
import { isMicro } from "@/lib/nutrients/tracking";
import { buildGoalRows, type GoalRowData } from "./day-goals";

// ---------------------------------------------------------------------------
// Bands: the colour and text label of a bar or chart cell
// ---------------------------------------------------------------------------

/**
 * - targets: "low" under 50% of goal, "partway" 50–99%, "met" at or over the goal;
 * - limits: "under-limit", "near-limit" from 80% (bars warn as they fill), "over-limit";
 * - "over-ul": intake from food above the tolerable upper limit (overrides the others);
 * - "none": no goal or no data.
 */
export type Band =
  "none" | "low" | "partway" | "met" | "under-limit" | "near-limit" | "over-limit" | "over-ul";

export const BAND_LABELS: Record<Band, string> = {
  none: "No data",
  low: "Low",
  partway: "Partway",
  met: "Met",
  "under-limit": "Within limit",
  "near-limit": "Near limit",
  "over-limit": "Over limit",
  "over-ul": "Over upper limit",
};

/** Share of a target below which the bar is "low". */
export const LOW_SHARE = 0.5;
/** Share of a limit from which the bar warns. */
export const NEAR_LIMIT_SHARE = 0.8;

export function bandOf(row: Pick<GoalRowData, "ratio" | "status" | "overUl">): Band {
  if (row.overUl) return "over-ul";
  if (row.ratio === null || row.status === "none") return "none";
  if (row.status === "over-limit") return "over-limit";
  if (row.status === "under-limit") {
    return row.ratio >= NEAR_LIMIT_SHARE ? "near-limit" : "under-limit";
  }
  if (row.status === "met") return "met";
  return row.ratio < LOW_SHARE ? "low" : "partway";
}

// ---------------------------------------------------------------------------
// Today: tracked micros, biggest gaps, upper-limit warnings
// ---------------------------------------------------------------------------

/** Goal rows for the tracked vitamins and minerals (macros have their own card). */
export function microRows(rows: readonly GoalRowData[]): GoalRowData[] {
  return rows.filter((r) => isMicro(r.id));
}

/**
 * The tracked micros furthest below their goal (lowest consumed ÷ goal), most behind first.
 * Limits, met goals and nutrients with no data are left out.
 */
export function biggestGaps(rows: readonly GoalRowData[], count = 3): GoalRowData[] {
  return microRows(rows)
    .filter((r) => r.status === "under" && r.ratio !== null && r.consumed !== null)
    .sort((a, b) => a.ratio! - b.ratio!)
    .slice(0, count);
}

/** Rows where intake from food is above the tolerable upper limit. */
export function upperLimitWarnings(rows: readonly GoalRowData[]): GoalRowData[] {
  return rows.filter((r) => r.overUl !== null);
}

// ---------------------------------------------------------------------------
// Macro card
// ---------------------------------------------------------------------------

export interface EnergyShare {
  id: "protein" | "carbohydrate" | "fat";
  name: string;
  grams: number | null;
  /** Share of calories eaten today (0–1); null when no calories or no data. */
  pctOfCalories: number | null;
  /** Target range as shares of the energy goal, e.g. 0.2–0.35; null without a range. */
  targetPct: { min: number; max: number } | null;
  /** The macro's own goal row (grams vs goal), as in the Day view. */
  row: GoalRowData | null;
  rangeLabel: string | null;
}

export interface MacroSummary {
  energy: GoalRowData | null;
  shares: EnergyShare[];
  fiber: GoalRowData | null;
  /** Drinks plus water in food, vs the total-water goal. */
  water: GoalRowData & { drinksMl: number; foodMl: number | null };
  limits: GoalRowData[];
  /** Limits with no numeric value for this tier (e.g. cholesterol): consumed and why. */
  noLimit: { id: NutrientId; name: string; unit: Unit; consumed: number | null; reason: string }[];
}

const LIMIT_IDS: readonly NutrientId[] = ["saturated_fat", "added_sugars", "sodium", "cholesterol"];
const SHARE_IDS = ["protein", "carbohydrate", "fat"] as const;

export interface MacroInput {
  goals: Goals;
  foods: readonly { occasion: MealOccasion; amounts: NutrientAmounts }[];
  waterDrunkMl: number;
}

/** Macros are always shown, whatever the user tracks. */
export function macroSummary({ goals, foods, waterDrunkMl }: MacroInput): MacroSummary {
  const rows = buildGoalRows({
    visible: ["energy", ...SHARE_IDS, "fiber", ...LIMIT_IDS],
    goals,
    foods,
    showScore: false,
  });
  const row = (id: NutrientId) => rows.find((r) => r.id === id) ?? null;
  const totals = sumNutrients(foods.map((f) => f.amounts));
  const kcal = totals.energy.amount;
  const energyGoal = goals.energy.value;

  const shares = SHARE_IDS.map((id): EnergyShare => {
    const goal = goals[id];
    const grams = foods.length === 0 ? 0 : totals[id].amount;
    const toPct = (g: number | undefined) =>
      g === undefined || !energyGoal ? undefined : (g * KCAL_PER_G[id]) / energyGoal;
    const min = toPct(goal.min);
    const max = toPct(goal.max);
    return {
      id,
      name: NUTRIENTS[id].name,
      grams,
      pctOfCalories: grams !== null && kcal ? (grams * KCAL_PER_G[id]) / kcal : null,
      targetPct: min !== undefined && max !== undefined ? { min, max } : null,
      row: row(id),
      rangeLabel: goalRange(goal),
    };
  });

  return {
    energy: row("energy"),
    shares,
    fiber: row("fiber"),
    water: waterRow(
      goals,
      waterDrunkMl,
      foods.length === 0 ? 0 : totals.water.amount,
      totals.water.missingCount > 0,
    ),
    limits: LIMIT_IDS.flatMap((id) => row(id) ?? []),
    noLimit: LIMIT_IDS.filter((id) => goals[id].value === null).map((id) => ({
      id,
      name: NUTRIENTS[id].name,
      unit: NUTRIENTS[id].unit,
      consumed: foods.length === 0 ? 0 : totals[id].amount,
      reason: goals[id].basis,
    })),
  };
}

function waterRow(
  goals: Goals,
  drinksMl: number,
  foodMl: number | null,
  partial: boolean,
): MacroSummary["water"] {
  const goal = goals.water;
  const consumed = drinksMl + (foodMl ?? 0);
  const progress = goalProgress(goal, consumed);
  return {
    id: "water",
    name: NUTRIENTS.water.name,
    unit: NUTRIENTS.water.unit,
    consumed,
    partial,
    goalLabel: goalLabel(goal),
    ratio: progress.ratio,
    status: progress.status,
    source: goalSource(goal),
    detail: `${drinksMl.toLocaleString("en-US")} mL drunk + ${foodMl === null ? "no data" : `${Math.round(foodMl).toLocaleString("en-US")} mL`} from food`,
    overUl: null,
    absorbed: null,
    score: null,
    drinksMl,
    foodMl,
  };
}

// ---------------------------------------------------------------------------
// History: percent of goal per nutrient per day
// ---------------------------------------------------------------------------

export interface HistoryCell {
  /** consumed ÷ goal; null = nothing logged or no data. */
  ratio: number | null;
  band: Band;
  /** e.g. "12 mg / 18 mg". */
  detail: string;
}

export interface HistoryRow {
  id: NutrientId;
  name: string;
  kind: "target" | "limit";
  /** One cell per day, oldest first. */
  cells: HistoryCell[];
}

export interface HistoryDay {
  date: string;
  goals: Goals;
  foods: readonly { occasion: MealOccasion; amounts: NutrientAmounts }[];
}

/**
 * One row per nutrient with a goal (in `visible` order), one cell per day, using each day's
 * goals (they change with training). Days with nothing logged are blank, not 0%.
 */
export function historyRows(
  days: readonly HistoryDay[],
  visible: readonly NutrientId[],
  format: (value: number, unit: Unit) => string,
): HistoryRow[] {
  // Same rows as the Day view's goals card; empty days still decide which rows exist.
  const perDay = days.map((d) => ({
    logged: d.foods.length > 0,
    rows: new Map(
      buildGoalRows({ visible, goals: d.goals, foods: d.foods, showScore: false }).map((r) => [
        r.id,
        r,
      ]),
    ),
  }));
  const ids = visible.filter((id) => perDay.some((d) => d.rows.has(id)));
  return ids.map((id) => ({
    id,
    name: NUTRIENTS[id].name,
    kind: NUTRIENTS[id].kind,
    cells: perDay.map(({ logged, rows }): HistoryCell => {
      const r = rows.get(id);
      if (!logged) return { ratio: null, band: "none", detail: "Nothing logged" };
      if (!r) return { ratio: null, band: "none", detail: "No goal" };
      return {
        ratio: r.ratio,
        band: bandOf(r),
        detail:
          r.consumed === null
            ? "No data"
            : `${format(r.consumed, r.unit)} / ${r.goalLabel}${r.partial ? " (some foods lack data)" : ""}`,
      };
    }),
  }));
}
