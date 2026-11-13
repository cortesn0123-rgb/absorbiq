/**
 * Absorption score: how well what you ate was absorbed, compared with a typical mixed diet
 * absorbing the same amount.
 *
 *   typical absorbed = consumed x the nutrient's typical absorption factor
 *   absorption score = absorbed / typical absorbed
 *
 * 1.0 = typical absorption for what was actually eaten, however much that was; above 1, the
 * food pairings helped absorption; below 1, they held it back. With nothing eaten there is no
 * score (shown as "—"). Goals stay as published intake amounts: progress toward a goal always
 * uses CONSUMED intake, and the score is never compared with a goal.
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
 * Copper's absorption depends on daily intake, so it is read off its curve at `dailyAmount`
 * (the amount eaten, for the score).
 */
export function typicalAbsorption(
  id: NutrientId,
  dailyAmount: number,
  table: FactorTable = DEFAULT_FACTORS,
): TypicalAbsorption | null {
  if (id === "copper") {
    const at = (s: "low" | "value" | "high") =>
      curveAt(table, "copper", "daily_mg", dailyAmount, s, "log");
    return {
      value: at("value"),
      low: at("low"),
      high: at("high"),
      description: "Copper absorbed at this daily intake (absorption depends on daily intake).",
    };
  }
  const ref = TYPICAL_ROWS[id];
  if (!ref) return null;
  const row: FactorRow = table.get(ref[0], ref[1]);
  return { value: row.value, low: row.low, high: row.high, description: row.description };
}

export interface AbsorptionScore {
  /** consumed x typical absorption: what a typical diet absorbs from the same intake. */
  typicalAbsorbed: number;
  /** absorbed / typical absorbed (1 = typical); null when nothing was eaten. */
  score: number | null;
  scoreLow: number | null;
  scoreHigh: number | null;
}

/**
 * The absorption score, or null when the nutrient is not scored: limits, nutrients counted as
 * eaten, carbohydrate, nutrients with no goal (the user is not aiming for them) and no data.
 */
export function absorptionScore(
  id: NutrientId,
  estimate: Pick<NutrientEstimate, "consumed" | "absorbed" | "low" | "high">,
  goal: number | null,
  table: FactorTable = DEFAULT_FACTORS,
): AbsorptionScore | null {
  if (NUTRIENTS[id].kind === "limit" || goal === null || goal <= 0) return null;
  const { consumed, absorbed, low, high } = estimate;
  if (consumed === null || absorbed === null || low === null || high === null) return null;
  const typical = typicalAbsorption(id, consumed, table);
  if (!typical || typical.value <= 0) return null;

  const typicalAbsorbed = consumed * typical.value;
  if (typicalAbsorbed <= 0) {
    return { typicalAbsorbed: 0, score: null, scoreLow: null, scoreHigh: null };
  }
  return {
    typicalAbsorbed,
    score: absorbed / typicalAbsorbed,
    scoreLow: low / typicalAbsorbed,
    scoreHigh: high / typicalAbsorbed,
  };
}
