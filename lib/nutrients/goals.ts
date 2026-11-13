/**
 * The user's goals: daily targets from targets.ts with any custom overrides applied, plus
 * consumed-vs-goal progress.
 *
 * Goals are intake amounts (they already assume typical absorption), so progress always uses
 * CONSUMED intake. Absorption is shown separately as the absorption score
 * (lib/bioavailability/score.ts).
 */

import { formatAmount, formatNumber } from "@/lib/format";
import { ValidationError } from "@/lib/logs/validate";
import { NUTRIENTS, NUTRIENT_IDS, isNutrientId, type NutrientId } from "./registry";
import type { DailyTarget, DailyTargets } from "./targets";

export interface Goal extends DailyTarget {
  /** The value targets.ts recommends for this profile and tier. */
  recommended: number | null;
  /** True when `value` is the user's override. */
  custom: boolean;
}

export type Goals = Record<NutrientId, Goal>;

/** Sanity cap on goal overrides, in the nutrient's unit (largest real goal: water, ~4000 mL). */
export const MAX_CUSTOM_GOAL = 100_000;

export function applyCustomGoals(
  targets: DailyTargets,
  custom: Partial<Record<NutrientId, number>>,
): Goals {
  const goals = {} as Goals;
  for (const id of NUTRIENT_IDS) {
    const t = targets[id];
    const override = custom[id];
    if (override === undefined) {
      goals[id] = { ...t, recommended: t.value, custom: false };
    } else {
      // A custom value replaces the recommended range too.
      goals[id] = {
        ...t,
        value: override,
        min: undefined,
        max: undefined,
        recommended: t.value,
        custom: true,
      };
    }
  }
  return goals;
}

/** Where a goal comes from: the tier's basis, the registry citation and any notes. */
export function goalSource(goal: Goal): string {
  const def = NUTRIENTS[goal.nutrientId];
  const lines = [
    goal.custom ? `Your custom goal. Recommended: ${goal.basis}.` : `${goal.basis}.`,
    `Source: ${def.citation}`,
    ...goal.notes,
  ];
  if (def.note) lines.push(def.note);
  return lines.join("\n");
}

/** "90 mg", "max 2,300 mg", "max 10 g per meal", "2,600 kcal", with a range when there is one. */
export function goalLabel(
  goal: Pick<Goal, "value" | "unit" | "kind" | "per" | "min" | "max">,
): string {
  if (goal.value === null) return "No goal";
  const amount = formatAmount(goal.value, goal.unit);
  const base = goal.kind === "limit" ? `max ${amount}` : amount;
  return goal.per === "meal" ? `${base} per meal` : base;
}

/** "range 100–200 g" for goals with a recommended range, else null. */
export function goalRange(goal: Pick<Goal, "unit" | "min" | "max">): string | null {
  if (goal.min === undefined || goal.max === undefined || goal.min === goal.max) return null;
  return `range ${formatNumber(goal.min)}–${formatAmount(goal.max, goal.unit)}`;
}

export type GoalStatus = "none" | "under" | "met" | "over-limit" | "under-limit";

export interface GoalProgress {
  /** consumed / goal (0 when nothing eaten); null when there is no goal or no data. */
  ratio: number | null;
  status: GoalStatus;
  /** Intake from food above the tolerable upper limit (only for limits that apply to all sources). */
  overUl: boolean;
}

/**
 * Consumed intake compared with the goal. Per-meal limits (added sugars) are checked per meal in
 * meal-limits.ts; here `consumed` is compared with one meal's limit only if the caller passes
 * one meal's amount.
 */
export function goalProgress(goal: Goal, consumed: number | null): GoalProgress {
  const overUl =
    consumed !== null && goal.ul !== null && goal.ulScope === "total" && consumed > goal.ul;
  if (goal.value === null || goal.value <= 0 || consumed === null) {
    return { ratio: null, status: "none", overUl };
  }
  const ratio = consumed / goal.value;
  if (goal.kind === "limit") {
    return { ratio, status: ratio > 1 ? "over-limit" : "under-limit", overUl };
  }
  return { ratio, status: ratio >= 1 ? "met" : "under", overUl };
}

export function parseNutrientId(raw: unknown): NutrientId {
  if (typeof raw !== "string" || !isNutrientId(raw)) throw new ValidationError("Unknown nutrient.");
  return raw;
}

/** A goal override in the nutrient's unit, or null to reset to the recommended goal. */
export function parseCustomGoal(raw: unknown): number | null {
  if (raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0 || raw > MAX_CUSTOM_GOAL) {
    throw new ValidationError("Enter a goal greater than 0.");
  }
  // Same precision as the formatted amounts the user sees.
  return Math.round(raw * 1000) / 1000;
}
