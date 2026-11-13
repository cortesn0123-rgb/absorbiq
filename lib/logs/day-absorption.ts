/** Runs the bioavailability engine over a day's logs, one meal occasion at a time. */

import {
  absorbDay,
  toEngineFood,
  type DayAbsorption,
  type DayMealInput,
  type EngineProfile,
  type FactorTable,
  type NutrientEstimates,
  type TotalEstimates,
} from "@/lib/bioavailability";
import { compareOccasions, occasionKey, occasionLabel, type MealOccasion } from "@/lib/meals";
import type { LoggedFood } from "./queries";

export interface DayAbsorptionView {
  day: DayAbsorption;
  /** Estimates for each logged food, by food log id. */
  byLog: Map<number, NutrientEstimates>;
  /** Meal totals, by occasion key. */
  byMeal: Map<string, TotalEstimates>;
}

/** A day's logs as engine input: one meal per occasion, in occasion order. */
export function mealInputs(logs: readonly LoggedFood[]): DayMealInput[] {
  const meals = new Map<string, { occasion: MealOccasion; logs: LoggedFood[] }>();
  for (const log of logs) {
    const key = occasionKey(log.occasion);
    const meal = meals.get(key) ?? { occasion: log.occasion, logs: [] };
    meal.logs.push(log);
    meals.set(key, meal);
  }
  const ordered = [...meals.entries()].sort((a, b) =>
    compareOccasions(a[1].occasion, b[1].occasion),
  );

  return ordered.map(([key, meal]) => ({
    key,
    label: occasionLabel(meal.occasion),
    foods: meal.logs.map((log) => toEngineFood(String(log.id), log.food, log.grams)),
  }));
}

export function absorbLogs(
  logs: readonly LoggedFood[],
  profile: EngineProfile,
  table: FactorTable,
): DayAbsorptionView {
  const day = absorbDay(mealInputs(logs), profile, table);

  const byLog = new Map<number, NutrientEstimates>();
  const byMeal = new Map<string, TotalEstimates>();
  for (const meal of day.meals) {
    byMeal.set(meal.key, meal.absorption.totals);
    for (const food of meal.absorption.foods) byLog.set(Number(food.key), food.nutrients);
  }
  return { day, byLog, byMeal };
}
