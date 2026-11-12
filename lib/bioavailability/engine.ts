/**
 * Bioavailability engine: pure functions from meals to consumed and absorbed amounts.
 * No database or network access; factors are passed in (defaults: factors.ts). Results are
 * never stored, so changes to factors apply to past logs the next time they are viewed.
 */

import { NUTRIENT_IDS, type NutrientId } from "@/lib/nutrients/registry";
import { DEFAULT_FACTORS, type FactorTable } from "./factor-table";
import { buildMealContext } from "./meal-context";
import { RULES } from "./rules";
import {
  DEFAULT_PROFILE,
  type DayAbsorption,
  type DayMealInput,
  type EngineFood,
  type EngineProfile,
  type FoodAbsorption,
  type MealAbsorption,
  type NutrientEstimate,
  type NutrientEstimates,
  type TotalEstimate,
  type TotalEstimates,
} from "./types";

export interface MealOptions {
  /** Copper eaten across the whole day; defaults to the meal's copper. */
  dayCopperMg?: number;
}

const NO_DATA: NutrientEstimate = {
  consumed: null,
  absorbed: null,
  low: null,
  high: null,
  reasons: ["FoodData Central has no data for this nutrient in this food."],
  basis: "absorbed",
};

/** Absorption estimates for every food in one meal, using the whole meal as context. */
export function absorbMeal(
  foods: readonly EngineFood[],
  profile: EngineProfile = DEFAULT_PROFILE,
  table: FactorTable = DEFAULT_FACTORS,
  options: MealOptions = {},
): MealAbsorption {
  const ctx = buildMealContext(foods, table, options.dayCopperMg);
  const results: FoodAbsorption[] = ctx.foods.map((mealFood) => {
    const nutrients = {} as NutrientEstimates;
    for (const id of NUTRIENT_IDS) {
      const consumed = mealFood.amounts[id];
      if (consumed === undefined) {
        nutrients[id] = NO_DATA;
        continue;
      }
      const out = RULES[id]({ food: mealFood, consumed, ctx, table, profile });
      const { low, value, high } = out.absorbed;
      nutrients[id] = {
        consumed,
        absorbed: value,
        low: Math.min(low, value, high),
        high: Math.max(low, value, high),
        reasons: out.reasons,
        basis: out.basis ?? "absorbed",
      };
    }
    return { key: mealFood.food.key, name: mealFood.food.name, nutrients };
  });
  return { foods: results, totals: sumEstimates(results.map((f) => f.nutrients)) };
}

function unique(strings: Iterable<string>): string[] {
  return [...new Set(strings)];
}

/** Adds up estimates; nutrients with no data in some items are counted in missingCount. */
export function sumEstimates(items: readonly NutrientEstimates[]): TotalEstimates {
  const totals = {} as TotalEstimates;
  for (const id of NUTRIENT_IDS) totals[id] = sumOne(items.map((n) => n[id]));
  return totals;
}

function sumOne(estimates: readonly NutrientEstimate[]): TotalEstimate {
  let missingCount = 0;
  const known = estimates.filter((e) => {
    if (e.consumed === null) missingCount++;
    return e.consumed !== null;
  });
  if (known.length === 0) {
    return { ...NO_DATA, reasons: [], missingCount };
  }
  const add = (key: "consumed" | "absorbed" | "low" | "high") =>
    known.reduce((t, e) => t + (e[key] ?? 0), 0);
  return {
    consumed: add("consumed"),
    absorbed: add("absorbed"),
    low: add("low"),
    high: add("high"),
    reasons: unique(known.flatMap((e) => e.reasons)),
    basis: known[0].basis,
    missingCount,
  };
}

/**
 * Runs the engine meal by meal (each meal is its own context) and sums the day. Day-total
 * reasons that differ between meals are prefixed with the meal's label.
 */
export function absorbDay(
  meals: readonly DayMealInput[],
  profile: EngineProfile = DEFAULT_PROFILE,
  table: FactorTable = DEFAULT_FACTORS,
): DayAbsorption {
  const dayCopperMg = meals
    .flatMap((m) => m.foods)
    .reduce((t, f) => t + ((f.per100g.copper ?? 0) * f.grams) / 100, 0);

  const results = meals.map((meal) => ({
    key: meal.key,
    label: meal.label,
    absorption: absorbMeal(meal.foods, profile, table, { dayCopperMg }),
  }));

  const totals = sumEstimates(results.map((r) => r.absorption.totals));
  for (const id of NUTRIENT_IDS) {
    totals[id] = {
      ...totals[id],
      reasons: dayReasons(results, id),
      // Count foods, not meals, with no data.
      missingCount: results.reduce((t, r) => t + r.absorption.totals[id].missingCount, 0),
    };
  }
  return { meals: results, totals };
}

function dayReasons(
  meals: readonly { label: string; absorption: MealAbsorption }[],
  id: NutrientId,
): string[] {
  const withData = meals.filter((m) => m.absorption.totals[id].consumed !== null);
  const counts = new Map<string, number>();
  for (const m of withData) {
    for (const r of m.absorption.totals[id].reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const reasons: string[] = [];
  for (const m of withData) {
    for (const r of m.absorption.totals[id].reasons) {
      reasons.push(counts.get(r) === withData.length ? r : `${m.label}: ${r}`);
    }
  }
  return unique(reasons);
}
