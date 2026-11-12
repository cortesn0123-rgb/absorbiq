/**
 * Per-meal limits (e.g. added sugars ≤ 10 g per meal, Dietary Guidelines 2025–2030).
 * Amounts are summed per meal occasion: breakfast, lunch and dinner once each, and every
 * snack separately (see lib/meals.ts). Each occasion is compared with the limit.
 */

import { compareOccasions, occasionKey, type MealOccasion } from "@/lib/meals";

export interface MealAmount {
  occasion: MealOccasion;
  /** Amount of the nutrient in one logged food, in the nutrient's unit. */
  amount: number;
}

export interface MealLimitResult {
  occasion: MealOccasion;
  total: number;
  limit: number;
  over: boolean;
}

/** Totals per occasion (only occasions with at least one entry), in occasion order. */
export function checkMealLimit(entries: readonly MealAmount[], limit: number): MealLimitResult[] {
  const totals = new Map<string, { occasion: MealOccasion; total: number }>();
  for (const { occasion, amount } of entries) {
    const key = occasionKey(occasion);
    const entry = totals.get(key) ?? { occasion, total: 0 };
    entry.total += amount;
    totals.set(key, entry);
  }
  return [...totals.values()]
    .sort((a, b) => compareOccasions(a.occasion, b.occasion))
    .map(({ occasion, total }) => ({ occasion, total, limit, over: total > limit }));
}

/** Meals whose total exceeds the limit. */
export function mealsOverLimit(entries: readonly MealAmount[], limit: number): MealLimitResult[] {
  return checkMealLimit(entries, limit).filter((m) => m.over);
}
