/**
 * Foods for the engine tests. Lentils come from a real FDC response through the full mapping
 * pipeline; the others use approximate USDA SR Legacy values per 100 g (rounded), which is
 * enough to test the rules' behaviour.
 */

import sr from "@/lib/fdc/fixtures/sr.json";
import type { NutrientAmounts } from "@/lib/fdc/mapping";
import { normalizeFood } from "@/lib/fdc/normalize";
import { toFoodInsert, toFoodRecord, type FoodRecordTags } from "@/lib/fdc/record";
import { toEngineFood } from "./index";
import type { EngineFood } from "./types";

const NO_TAGS: FoodRecordTags = {
  isHemeSource: false,
  phytateLevel: "none",
  oxalateLevel: "none",
  isFortified: false,
  foodGroup: "other",
  isLowOxalateGreen: false,
};

let counter = 0;

export function food(
  name: string,
  grams: number,
  per100g: NutrientAmounts,
  tags: Partial<FoodRecordTags> = {},
  retinolPer100g: number | null = null,
): EngineFood {
  return {
    key: `${name}-${++counter}`,
    name,
    grams,
    per100g,
    retinolPer100g,
    tags: { ...NO_TAGS, ...tags },
  };
}

const lentilRecord = toFoodRecord({ ...toFoodInsert(normalizeFood(sr)), id: 1 });

/** SR Legacy 172421, lentils cooked without salt. 1 cup = 198 g. */
export const lentils = (grams = 198) => toEngineFood(`lentils-${++counter}`, lentilRecord, grams);

/** SR Legacy orange juice, raw. A glass is about 248 g. */
export const orangeJuice = (grams = 248) =>
  food(
    "Orange juice",
    grams,
    {
      energy: 45,
      water: 88.3,
      protein: 0.7,
      carbohydrate: 10.4,
      sugars_total: 8.4,
      fat: 0.2,
      vitamin_c: 50,
      iron: 0.2,
      calcium: 11,
      zinc: 0.05,
      folate: 30,
      vitamin_a: 10,
      potassium: 200,
    },
    { foodGroup: "fruit" },
    0,
  );

export const blackTea = (grams = 240) =>
  food(
    "Tea, black, brewed",
    grams,
    { energy: 1, water: 99.7, iron: 0.02, calcium: 0, potassium: 37, fat: 0 },
    { foodGroup: "tea" },
  );

export const coffee = (grams = 240) =>
  food(
    "Coffee, brewed",
    grams,
    { energy: 1, water: 99.4, iron: 0.01, calcium: 2, potassium: 49, fat: 0 },
    { foodGroup: "coffee" },
  );

/** Beef top sirloin, cooked. */
export const steak = (grams = 200) =>
  food(
    "Beef steak, cooked",
    grams,
    {
      energy: 200,
      water: 60,
      protein: 30,
      fat: 8,
      saturated_fat: 3.1,
      cholesterol: 90,
      iron: 2.9,
      zinc: 5.6,
      vitamin_b12: 1.6,
      calcium: 20,
      vitamin_a: 0,
      vitamin_c: 0,
    },
    { isHemeSource: true, foodGroup: "meat" },
    0,
  );

/** SR Legacy spinach, raw. */
export const spinach = (grams = 85) =>
  food(
    "Spinach, raw",
    grams,
    {
      energy: 23,
      water: 91.4,
      protein: 2.86,
      fat: 0.39,
      carbohydrate: 3.63,
      fiber: 2.2,
      iron: 2.71,
      calcium: 99,
      zinc: 0.53,
      magnesium: 79,
      vitamin_c: 28.1,
      vitamin_k: 482.9,
      vitamin_a: 469,
      folate: 194,
    },
    { oxalateLevel: "high", foodGroup: "vegetable" },
    0,
  );

/** SR Legacy kale, raw. */
export const kale = (grams = 85) =>
  food(
    "Kale, raw",
    grams,
    {
      energy: 35,
      water: 89.6,
      protein: 2.9,
      fat: 1.5,
      calcium: 254,
      iron: 1.6,
      vitamin_c: 93,
      vitamin_k: 390,
      vitamin_a: 241,
    },
    { isLowOxalateGreen: true, foodGroup: "vegetable" },
    0,
  );

/** SR Legacy carrots, raw. */
export const carrots = (grams = 60) =>
  food(
    "Carrots, raw",
    grams,
    { energy: 41, water: 88.3, fat: 0.24, vitamin_a: 835, vitamin_k: 13.2, vitamin_c: 5.9 },
    { foodGroup: "vegetable" },
    0,
  );

export const oliveOil = (grams = 14) =>
  food(
    "Oil, olive",
    grams,
    { energy: 884, fat: 100, vitamin_e: 14.35, vitamin_k: 60.2, water: 0 },
    { foodGroup: "other" },
  );

/** SR Legacy whole milk, 3.25% fat. A glass is about 244 g. */
export const milk = (grams = 244) =>
  food(
    "Milk, whole",
    grams,
    {
      energy: 61,
      water: 88.1,
      protein: 3.15,
      fat: 3.25,
      calcium: 113,
      vitamin_b12: 0.45,
      vitamin_a: 46,
      vitamin_d: 1.3,
      zinc: 0.37,
    },
    { foodGroup: "dairy" },
    45,
  );

/** Salmon, cooked: about 3 mcg B12 per 100 g. */
export const salmon = (grams: number) =>
  food(
    "Salmon, cooked",
    grams,
    {
      energy: 206,
      water: 59.6,
      protein: 22.1,
      fat: 12.4,
      vitamin_b12: 3,
      iron: 0.34,
      vitamin_d: 13.1,
    },
    { isHemeSource: true, foodGroup: "fish" },
    0,
  );

/** Beef liver, cooked: very high preformed vitamin A (retinol). */
export const liver = (grams = 85) =>
  food(
    "Beef liver, cooked",
    grams,
    { energy: 191, water: 59, protein: 29, fat: 5.3, vitamin_a: 9442, folate: 253, iron: 6.5 },
    { isHemeSource: true, foodGroup: "meat" },
    9442,
  );
