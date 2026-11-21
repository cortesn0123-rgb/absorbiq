/**
 * The day as the AI helper sees it: consumed intake vs goal for every nutrient the user can see,
 * with absorption scores, before and after adding proposed foods. Built from the same goal rows
 * as the Day view and dashboard (buildGoalRows), so the numbers match them.
 *
 * Gaps are goal minus CONSUMED intake (goals are intake amounts; see CLAUDE.md). The absorption
 * score is reported alongside so the helper can favour pairings that raise it.
 */

import type { EngineProfile, FactorTable } from "@/lib/bioavailability";
import type { FoodRecord } from "@/lib/fdc/record";
import { absorbLogs } from "@/lib/logs/day-absorption";
import { buildGoalRows } from "@/lib/logs/day-goals";
import type { LoggedFood } from "@/lib/logs/queries";
import { occasionLabel, type MealOccasion } from "@/lib/meals";
import type { Goals } from "@/lib/nutrients/goals";
import { checkMealLimit } from "@/lib/nutrients/meal-limits";
import { nutrientsForGrams } from "@/lib/nutrients/portion";
import type { NutrientId, Unit } from "@/lib/nutrients/registry";

export interface DayInput {
  /** Today's logs. */
  logs: readonly LoggedFood[];
  goals: Goals;
  /** Macros plus tracked micros (lib/nutrients/tracking.ts). */
  visible: readonly NutrientId[];
  profile: EngineProfile;
  factors: FactorTable;
}

/** A food the helper proposes, as it would be logged. */
export interface ProposedFood {
  food: FoodRecord;
  grams: number;
  occasion: MealOccasion;
  portionLabel: string | null;
  portionCount: number | null;
}

export interface NutrientStatus {
  id: NutrientId;
  name: string;
  unit: Unit;
  kind: "target" | "limit";
  per: "day" | "meal";
  goal: number;
  /** Consumed today (for per-meal limits, the highest meal); null = no data. */
  consumed: number | null;
  /** Some foods lack data for this nutrient. */
  partial: boolean;
  /** Absorption score (1 = typical); null when not scored or nothing eaten. */
  score: number | null;
  ul: number | null;
}

export interface MealOverLimit {
  nutrient: NutrientId;
  meal: string;
  total: number;
  limit: number;
}

export interface DaySnapshot {
  nutrients: NutrientStatus[];
  /** Meals over a per-meal limit (added sugars ≤ 10 g per meal; each snack on its own). */
  mealsOverLimit: MealOverLimit[];
}

/** Proposed foods as log entries, so the engine treats them like logged food (in meal context). */
function asLogs(extra: readonly ProposedFood[], date: string): LoggedFood[] {
  return extra.map((p, i) => ({
    id: -(i + 1),
    date,
    occasion: p.occasion,
    grams: p.grams,
    portionLabel: p.portionLabel,
    portionCount: p.portionCount,
    createdAt: "",
    food: p.food,
  }));
}

/** Consumed vs goal for the day, plus `extra` foods if given. */
export function snapshot(input: DayInput, extra: readonly ProposedFood[] = []): DaySnapshot {
  const logs = [...input.logs, ...asLogs(extra, input.logs[0]?.date ?? "")];
  const foods = logs.map((l) => ({
    occasion: l.occasion,
    amounts: nutrientsForGrams(l.food.nutrientsPer100g, l.grams),
  }));
  const absorption = absorbLogs(logs, input.profile, input.factors);
  const rows = buildGoalRows({
    visible: input.visible,
    goals: input.goals,
    foods,
    absorption: absorption.day.totals,
    showScore: true,
    factors: input.factors,
  });

  const nutrients: NutrientStatus[] = rows.map((r) => {
    const goal = input.goals[r.id];
    return {
      id: r.id,
      name: r.name,
      unit: r.unit,
      kind: goal.kind,
      per: goal.per,
      goal: goal.value!,
      consumed: r.consumed,
      partial: r.partial,
      score: r.score?.value ?? null,
      ul: goal.ul,
    };
  });

  const mealsOverLimit: MealOverLimit[] = [];
  for (const n of nutrients) {
    if (n.per !== "meal") continue;
    const entries = foods.flatMap((f) =>
      f.amounts[n.id] === undefined ? [] : [{ occasion: f.occasion, amount: f.amounts[n.id]! }],
    );
    for (const m of checkMealLimit(entries, n.goal)) {
      if (m.over) {
        mealsOverLimit.push({
          nutrient: n.id,
          meal: occasionLabel(m.occasion),
          total: m.total,
          limit: m.limit,
        });
      }
    }
  }
  return { nutrients, mealsOverLimit };
}

/**
 * Remaining amount to reach a daily target (0 when met); null for limits. When no food eaten so
 * far has data for the nutrient, nothing is counted toward it, so the whole goal remains.
 */
export function remaining(n: NutrientStatus): number | null {
  if (n.kind !== "target" || n.per !== "day") return null;
  return Math.max(0, n.goal - (n.consumed ?? 0));
}

/** Intake from food above the tolerable upper limit (daily nutrients only). */
export function overUl(n: NutrientStatus): boolean {
  return n.ul !== null && n.per === "day" && n.consumed !== null && n.consumed > n.ul;
}

/** Share of the UL from which a nutrient counts as "near" it. */
export const NEAR_UL_SHARE = 0.8;

export function nearUl(n: NutrientStatus): boolean {
  return (
    n.ul !== null && n.per === "day" && n.consumed !== null && n.consumed >= n.ul * NEAR_UL_SHARE
  );
}

/** Last local hour (exclusive) at which each main meal is still "ahead" today. */
const MEAL_ENDS: Record<"breakfast" | "lunch" | "dinner", number> = {
  breakfast: 11,
  lunch: 15,
  dinner: 22,
};

/**
 * Meals still open today: main meals not yet past (by local hour), plus snacks. A meal already
 * logged stays open (foods can be added to it) until its time has passed.
 */
export function mealsLeft(hour: number): ("breakfast" | "lunch" | "dinner" | "snack")[] {
  const main = (Object.keys(MEAL_ENDS) as (keyof typeof MEAL_ENDS)[]).filter(
    (slot) => hour < MEAL_ENDS[slot],
  );
  return [...main, "snack"];
}
