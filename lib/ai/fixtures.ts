/** Foods and a day for the AI helper tests (approximate USDA SR Legacy values per 100 g). */

import { DEFAULT_FACTORS, DEFAULT_PROFILE } from "@/lib/bioavailability";
import type { NutrientAmounts } from "@/lib/fdc/mapping";
import type { FoodRecord, FoodRecordTags } from "@/lib/fdc/record";
import type { Portion } from "@/lib/fdc/portions";
import type { LoggedFood } from "@/lib/logs/queries";
import type { MealOccasion } from "@/lib/meals";
import { applyCustomGoals } from "@/lib/nutrients/goals";
import { getDailyTargets } from "@/lib/nutrients/targets";
import { visibleNutrients } from "@/lib/nutrients/tracking";
import type { DayInput } from "./day";

const NO_TAGS: FoodRecordTags = {
  isHemeSource: false,
  phytateLevel: "none",
  oxalateLevel: "none",
  isFortified: false,
  foodGroup: "other",
  isLowOxalateGreen: false,
};

export function foodRecord(
  id: number,
  name: string,
  per100g: NutrientAmounts,
  portions: Portion[] = [],
  tags: Partial<FoodRecordTags> = {},
): FoodRecord {
  return {
    id,
    fdcId: 100_000 + id,
    name,
    brand: null,
    dataType: "SR Legacy",
    nutrientsPer100g: per100g,
    retinolPer100g: null,
    portions,
    tags: { ...NO_TAGS, ...tags },
  };
}

export const LENTILS = foodRecord(
  1,
  "Lentils, mature seeds, cooked, boiled, without salt",
  {
    energy: 116,
    protein: 9,
    carbohydrate: 20.1,
    fiber: 7.9,
    fat: 0.38,
    iron: 3.33,
    calcium: 19,
    vitamin_c: 1.5,
    folate: 181,
    zinc: 1.27,
    sodium: 2,
    added_sugars: 0,
  },
  [{ label: "1 cup", grams: 198 }],
  { foodGroup: "legume", phytateLevel: "high" },
);

export const ORANGE_JUICE = foodRecord(
  2,
  "Orange juice, raw",
  {
    energy: 45,
    protein: 0.7,
    carbohydrate: 10.4,
    fiber: 0.2,
    fat: 0.2,
    iron: 0.2,
    calcium: 11,
    vitamin_c: 50,
    folate: 30,
    sodium: 1,
    added_sugars: 0,
  },
  [{ label: "1 cup", grams: 248 }],
  { foodGroup: "fruit" },
);

export const MILK = foodRecord(
  3,
  "Milk, whole, 3.25% milkfat",
  {
    energy: 61,
    protein: 3.2,
    carbohydrate: 4.8,
    fat: 3.3,
    calcium: 113,
    iron: 0.03,
    added_sugars: 0,
  },
  [{ label: "1 cup", grams: 244 }],
  { foodGroup: "dairy" },
);

export const SODA = foodRecord(
  4,
  "Beverages, carbonated, cola",
  { energy: 41, carbohydrate: 10.6, added_sugars: 9, sodium: 4 },
  [{ label: "1 can", grams: 368 }],
);

export const CHICKEN = foodRecord(
  5,
  "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
  { energy: 165, protein: 31, fat: 3.6, iron: 1.04, zinc: 1, sodium: 74, added_sugars: 0 },
  [{ label: "1 breast", grams: 172 }],
  { foodGroup: "meat", isHemeSource: true },
);

export const ALL_FOODS = [LENTILS, ORANGE_JUICE, MILK, SODA, CHICKEN];

const GOALS = applyCustomGoals(
  getDailyTargets({
    tier: "average",
    sex: "female",
    age: 30,
    weightKg: 60,
    heightCm: 165,
    activityLevel: "low_active",
    trainingHoursPerDay: 0,
  }),
  {},
);

export const BREAKFAST: MealOccasion = { slot: "breakfast", snackNumber: null };
export const LUNCH: MealOccasion = { slot: "lunch", snackNumber: null };

export function logged(
  food: FoodRecord,
  grams: number,
  occasion: MealOccasion,
  id = 1,
): LoggedFood {
  return {
    id,
    date: "2026-11-21",
    occasion,
    grams,
    portionLabel: null,
    portionCount: null,
    createdAt: "2026-11-21T08:00:00Z",
    food,
  };
}

/** A day tracking iron, calcium, vitamin C and folate, with milk at breakfast. */
export function testDay(logs: LoggedFood[] = [logged(MILK, 244, BREAKFAST)]): DayInput {
  return {
    logs,
    goals: GOALS,
    visible: visibleNutrients(["iron", "calcium", "vitamin_c", "folate"]),
    profile: DEFAULT_PROFILE,
    factors: DEFAULT_FACTORS,
  };
}
