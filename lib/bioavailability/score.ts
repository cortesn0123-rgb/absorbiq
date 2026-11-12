/**
 * Absorption score: how much was absorbed compared with what a typical mixed diet would absorb
 * from the goal amount.
 *
 *   expected absorbed = goal x typical absorption factor
 *   absorption score  = absorbed / expected absorbed
 *
 * Goals stay as published (intake amounts). Progress toward a goal always uses CONSUMED intake;
 * the score is a separate signal that shows whether food pairings beat or fall short of a
 * typical diet. `pairing` (= score / progress) isolates the pairing effect: above 1 means this
 * food combination is absorbed better than a typical diet, below 1 worse.
 */

import { NUTRIENTS, type NutrientId } from "@/lib/nutrients/registry";
import { DEFAULT_FACTORS, curveAt, type FactorTable } from "./factor-table";
import type { FactorRow } from "./factors";
import type { NutrientEstimate } from "./types";

/** Where each scored nutrient's typical absorption comes from: [factor nutrient, key]. */
const TYPICAL_ROWS: Partial<Record<NutrientId, readonly [string, string]>> = {
  iron: ["iron", "typical"],
  vitamin_b12: ["vitamin_b12", "typical"],
  zinc: ["zinc", "absorption_moderate"],
  calcium: ["calcium", "default"],
  vitamin_a: ["vitamin_a", "rae"],
  folate: ["folate", "dfe"],
  vitamin_c: ["vitamin_c", "dose_mg:0"],
  vitamin_d: ["vitamin_d", "base"],
  vitamin_e: ["vitamin_e", "base"],
  vitamin_k: ["vitamin_k", "base"],
  niacin: ["niacin", "base"],
  thiamin: ["thiamin", "base"],
  riboflavin: ["riboflavin", "base"],
  pantothenic_acid: ["pantothenic_acid", "base"],
  vitamin_b6: ["vitamin_b6", "base"],
  biotin: ["biotin", "base"],
  choline: ["choline", "base"],
  magnesium: ["magnesium", "base"],
  potassium: ["potassium", "base"],
  chloride: ["chloride", "base"],
  selenium: ["selenium", "base"],
  manganese: ["manganese", "base"],
  phosphorus: ["phosphorus", "base"],
  iodine: ["iodine", "base"],
  chromium: ["chromium", "base"],
  molybdenum: ["molybdenum", "base"],
  protein: ["protein", "default"],
  fat: ["fat", "base"],
  ala: ["fat", "base"],
  linoleic_acid: ["fat", "base"],
};
// Not scored: limits (sodium, saturated fat, added sugars, cholesterol, trans fat), nutrients
// counted as eaten (calories, fiber, water), carbohydrate (its goal includes fiber, which is not
// absorbed) and nutrients with no goal.

export interface TypicalAbsorption {
  value: number;
  low: number;
  high: number;
  description: string;
}

/**
 * Fraction absorbed from a typical mixed diet, or null when the nutrient is not scored.
 * Copper's absorption depends on daily intake, so it is read off its curve at the goal amount.
 */
export function typicalAbsorption(
  id: NutrientId,
  goal: number,
  table: FactorTable = DEFAULT_FACTORS,
): TypicalAbsorption | null {
  if (id === "copper") {
    const at = (s: "low" | "value" | "high") =>
      curveAt(table, "copper", "daily_mg", goal, s, "log");
    return {
      value: at("value"),
      low: at("low"),
      high: at("high"),
      description: "Copper absorbed at the goal intake (absorption depends on daily intake).",
    };
  }
  const ref = TYPICAL_ROWS[id];
  if (!ref) return null;
  const row: FactorRow = table.get(ref[0], ref[1]);
  return { value: row.value, low: row.low, high: row.high, description: row.description };
}

export interface AbsorptionScore {
  /** goal x typical absorption. */
  expectedAbsorbed: number;
  /** absorbed / expected absorbed (1 = what a typical diet meeting the goal absorbs). */
  score: number;
  scoreLow: number;
  scoreHigh: number;
  /** consumed / goal, the progress-bar value. */
  progress: number;
  /** absorbed / (consumed x typical absorption); null when nothing was eaten. */
  pairing: number | null;
}

export function absorptionScore(
  id: NutrientId,
  estimate: Pick<NutrientEstimate, "consumed" | "absorbed" | "low" | "high">,
  goal: number | null,
  table: FactorTable = DEFAULT_FACTORS,
): AbsorptionScore | null {
  if (NUTRIENTS[id].kind === "limit" || goal === null || goal <= 0) return null;
  const { consumed, absorbed, low, high } = estimate;
  if (consumed === null || absorbed === null || low === null || high === null) return null;
  const typical = typicalAbsorption(id, goal, table);
  if (!typical || typical.value <= 0) return null;

  const expectedAbsorbed = goal * typical.value;
  return {
    expectedAbsorbed,
    score: absorbed / expectedAbsorbed,
    scoreLow: low / expectedAbsorbed,
    scoreHigh: high / expectedAbsorbed,
    progress: consumed / goal,
    pairing: consumed > 0 ? absorbed / (consumed * typical.value) : null,
  };
}
