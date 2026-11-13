/**
 * Rows for the Day view's goals card: consumed intake vs goal for each visible nutrient, and
 * optionally the absorption score. Progress always uses CONSUMED intake (see CLAUDE.md).
 */

import {
  DEFAULT_FACTORS,
  absorptionScore,
  type FactorTable,
  type TotalEstimates,
} from "@/lib/bioavailability";
import type { NutrientAmounts } from "@/lib/fdc/mapping";
import { occasionLabel, type MealOccasion } from "@/lib/meals";
import {
  goalLabel,
  goalProgress,
  goalSource,
  type GoalStatus,
  type Goals,
} from "@/lib/nutrients/goals";
import { checkMealLimit } from "@/lib/nutrients/meal-limits";
import { NUTRIENTS, type NutrientId, type Unit } from "@/lib/nutrients/registry";

export interface GoalRowData {
  id: NutrientId;
  name: string;
  unit: Unit;
  /** Consumed today (or in the highest meal, for per-meal limits); null = no data. */
  consumed: number | null;
  /** Some foods have no data for this nutrient, so the total may be low. */
  partial: boolean;
  goalLabel: string;
  ratio: number | null;
  status: GoalStatus;
  /** Basis, citation and notes. */
  source: string;
  /** Extra line under the bar, e.g. "Highest: Snack 2". */
  detail?: string;
  overUl: { ul: number } | null;
  score: { value: number; low: number; high: number; expected: number } | null;
}

/** Macros shown in the goals card. Other macros (sub-fats, total sugars) stay in the full list. */
export const GOAL_CARD_MACROS: readonly NutrientId[] = [
  "energy",
  "protein",
  "carbohydrate",
  "fiber",
  "fat",
  "saturated_fat",
  "added_sugars",
];

/** Shown in its own card. */
const OWN_CARD = new Set<NutrientId>(["water"]);

export interface DayGoalInput {
  /** Nutrients to show (macros plus tracked micros, after any Day-view filter). */
  visible: readonly NutrientId[];
  goals: Goals;
  /** One entry per logged food: its meal occasion and nutrient amounts for the portion. */
  foods: readonly { occasion: MealOccasion; amounts: NutrientAmounts }[];
  /** Day totals from the bioavailability engine (consumed and absorbed). */
  absorption: TotalEstimates;
  showScore: boolean;
  factors?: FactorTable;
}

export function buildGoalRows({
  visible,
  goals,
  foods,
  absorption,
  showScore,
  factors = DEFAULT_FACTORS,
}: DayGoalInput): GoalRowData[] {
  const macros = new Set(GOAL_CARD_MACROS);
  const rows: GoalRowData[] = [];

  for (const id of visible) {
    const def = NUTRIENTS[id];
    const goal = goals[id];
    if (OWN_CARD.has(id) || (def.category === "macro" && !macros.has(id))) continue;
    if (goal.value === null) continue;

    const withData = foods.filter((f) => f.amounts[id] !== undefined);
    const partial = withData.length > 0 && withData.length < foods.length;
    let consumed: number | null =
      foods.length === 0 ? 0 : withData.length === 0 ? null : sum(withData, id);
    let detail: string | undefined;

    if (goal.per === "meal") {
      // Per-meal limits compare each meal (every snack on its own) with the limit; the bar
      // shows the highest meal.
      const meals = checkMealLimit(
        withData.map((f) => ({ occasion: f.occasion, amount: f.amounts[id]! })),
        goal.value,
      );
      const highest = meals.reduce<(typeof meals)[number] | null>(
        (max, m) => (max === null || m.total > max.total ? m : max),
        null,
      );
      const over = meals.filter((m) => m.over).length;
      if (consumed !== null) consumed = highest?.total ?? 0;
      if (highest) {
        detail =
          over > 0
            ? `${over} ${over === 1 ? "meal" : "meals"} over (highest: ${occasionLabel(highest.occasion)})`
            : `highest: ${occasionLabel(highest.occasion)}`;
      }
    }

    const progress = goalProgress(goal, consumed);
    const scored =
      showScore && goal.per === "day"
        ? absorptionScore(id, absorption[id], goal.value, factors)
        : null;

    rows.push({
      id,
      name: def.name,
      unit: def.unit,
      consumed,
      partial,
      goalLabel: goalLabel(goal),
      ratio: progress.ratio,
      status: progress.status,
      source: goalSource(goal),
      detail,
      overUl: progress.overUl && goal.ul !== null ? { ul: goal.ul } : null,
      score: scored && {
        value: scored.score,
        low: scored.scoreLow,
        high: scored.scoreHigh,
        expected: scored.expectedAbsorbed,
      },
    });
  }
  return rows;
}

function sum(foods: readonly { amounts: NutrientAmounts }[], id: NutrientId): number {
  return foods.reduce((total, f) => total + (f.amounts[id] ?? 0), 0);
}
