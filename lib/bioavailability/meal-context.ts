/**
 * What the whole meal contains: the enhancers and inhibitors that change how much of each
 * food's nutrients is absorbed. Computed once per meal and shared by every rule.
 */

import type { NutrientAmounts } from "@/lib/fdc/mapping";
import { nutrientsForGrams } from "@/lib/nutrients/portion";
import { pick, triple, type FactorTable, type Scenario, type Triple } from "./factor-table";
import type { EngineFood } from "./types";

export interface MealFood {
  food: EngineFood;
  /** Consumed amounts for this portion. */
  amounts: NutrientAmounts;
}

/** A quantity that lowers absorption, as a content range. */
export interface ContentRange {
  min: number;
  value: number;
  max: number;
}

export interface MealContext {
  foods: MealFood[];
  vitaminCMg: number;
  /** Grams of meat, poultry and fish (Monsen's enhancing factor). */
  mfpGrams: Triple;
  calciumMg: number;
  fatG: number;
  teaG: number;
  coffeeG: number;
  zincMg: number;
  b12Ug: number;
  /** Estimated phytic acid in the meal (mg). */
  phytateMg: ContentRange;
  /** Names of foods contributing phytate. */
  phytateSources: string[];
  /** Copper eaten across the whole day (copper absorption depends on daily intake). */
  dayCopperMg: number;
}

/** Content to use in an absorption scenario: most phytate in the low-absorption case. */
export function contentFor(range: ContentRange, scenario: Scenario): number {
  if (scenario === "low") return range.max;
  if (scenario === "high") return range.min;
  return range.value;
}

const sum = (foods: readonly MealFood[], fn: (f: MealFood) => number) =>
  foods.reduce((total, f) => total + fn(f), 0);

/** Estimated phytic acid in one food portion (mg), scaled to the food's dry matter. */
export function foodPhytateMg(food: EngineFood, table: FactorTable): ContentRange {
  const row = table.get("phytate", `mg_per_100g_dry:${food.tags.phytateLevel}`);
  const water = food.per100g.water;
  // Phytate content is per 100 g of dry matter; cooked foods are mostly water.
  const dryShare = water === undefined ? 1 : Math.max(0, 100 - water) / 100;
  const scale = (food.grams / 100) * dryShare;
  return { min: row.low * scale, value: row.value * scale, max: row.high * scale };
}

export function buildMealContext(
  foods: readonly EngineFood[],
  table: FactorTable,
  dayCopperMg?: number,
): MealContext {
  const mealFoods: MealFood[] = foods.map((food) => ({
    food,
    amounts: nutrientsForGrams(food.per100g, food.grams),
  }));
  const amount = (f: MealFood, id: keyof NutrientAmounts) => f.amounts[id] ?? 0;

  const mfpRow = table.get("iron", "mfp_grams_per_g_protein");
  const mfpGrams = triple((s) =>
    sum(mealFoods, (f) => {
      if (!f.food.tags.isHemeSource) return 0;
      // Mixed dishes (e.g. chicken soup) are mostly not meat; estimate the meat from protein.
      const protein = f.amounts.protein;
      return protein === undefined
        ? f.food.grams
        : Math.min(f.food.grams, protein * pick(mfpRow, s));
    }),
  );

  const phytate = mealFoods.map((f) => ({ name: f.food.name, mg: foodPhytateMg(f.food, table) }));
  const phytateMg: ContentRange = {
    min: phytate.reduce((t, p) => t + p.mg.min, 0),
    value: phytate.reduce((t, p) => t + p.mg.value, 0),
    max: phytate.reduce((t, p) => t + p.mg.max, 0),
  };

  return {
    foods: mealFoods,
    vitaminCMg: sum(mealFoods, (f) => amount(f, "vitamin_c")),
    mfpGrams,
    calciumMg: sum(mealFoods, (f) => amount(f, "calcium")),
    fatG: sum(mealFoods, (f) => amount(f, "fat")),
    teaG: sum(mealFoods, (f) => (f.food.tags.foodGroup === "tea" ? f.food.grams : 0)),
    coffeeG: sum(mealFoods, (f) => (f.food.tags.foodGroup === "coffee" ? f.food.grams : 0)),
    zincMg: sum(mealFoods, (f) => amount(f, "zinc")),
    b12Ug: sum(mealFoods, (f) => amount(f, "vitamin_b12")),
    phytateMg,
    phytateSources: phytate.filter((p) => p.mg.value > 0).map((p) => p.name),
    dayCopperMg: dayCopperMg ?? sum(mealFoods, (f) => amount(f, "copper")),
  };
}
