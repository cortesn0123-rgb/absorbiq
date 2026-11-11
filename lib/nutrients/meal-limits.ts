/**
 * Per-meal limits (e.g. added sugars ≤ 10 g per meal, Dietary Guidelines 2025–2030).
 * Amounts are summed per meal slot; each slot is compared with the limit.
 */

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export interface MealAmount {
  mealSlot: MealSlot;
  /** Amount of the nutrient in one logged food, in the nutrient's unit. */
  amount: number;
}

export interface MealLimitResult {
  mealSlot: MealSlot;
  total: number;
  limit: number;
  over: boolean;
}

/** Totals per meal slot (only slots with at least one entry), in MEAL_SLOTS order. */
export function checkMealLimit(entries: readonly MealAmount[], limit: number): MealLimitResult[] {
  const totals = new Map<MealSlot, number>();
  for (const { mealSlot, amount } of entries) {
    totals.set(mealSlot, (totals.get(mealSlot) ?? 0) + amount);
  }
  return MEAL_SLOTS.filter((slot) => totals.has(slot)).map((mealSlot) => {
    const total = totals.get(mealSlot)!;
    return { mealSlot, total, limit, over: total > limit };
  });
}

/** Meals whose total exceeds the limit. */
export function mealsOverLimit(entries: readonly MealAmount[], limit: number): MealLimitResult[] {
  return checkMealLimit(entries, limit).filter((m) => m.over);
}
