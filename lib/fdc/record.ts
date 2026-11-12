/** The foods table row, and the shape the rest of the app uses. */

import { isNutrientId } from "@/lib/nutrients/registry";
import type { NutrientAmounts } from "./mapping";
import type { NormalizedFood } from "./normalize";
import type { Portion } from "./portions";

export interface FoodRecord {
  /** Our foods.id */
  id: number;
  fdcId: number;
  name: string;
  brand: string | null;
  dataType: string;
  nutrientsPer100g: NutrientAmounts;
  portions: Portion[];
}

/** Columns for `FoodRow`, for Supabase selects (also usable inside a join). */
export const FOOD_COLUMNS = "id, fdc_id, name, brand, data_type, nutrients_per_100g, portions";

export interface FoodRow {
  id: number;
  fdc_id: number;
  name: string;
  brand: string | null;
  data_type: string;
  nutrients_per_100g: Record<string, unknown>;
  portions: Portion[] | null;
}

export function toFoodRecord(row: FoodRow): FoodRecord {
  const nutrientsPer100g: NutrientAmounts = {};
  for (const [key, value] of Object.entries(row.nutrients_per_100g ?? {})) {
    if (isNutrientId(key) && typeof value === "number") nutrientsPer100g[key] = value;
  }
  return {
    id: row.id,
    fdcId: row.fdc_id,
    name: row.name,
    brand: row.brand,
    dataType: row.data_type,
    nutrientsPer100g,
    portions: row.portions ?? [],
  };
}

/** Insert payload for a newly cached food. */
export function toFoodInsert(food: NormalizedFood) {
  return {
    fdc_id: food.fdcId,
    name: food.name,
    data_type: food.dataType,
    brand: food.brand,
    category: food.category,
    nutrients_per_100g: food.nutrientsPer100g,
    fdc_nutrients: food.fdcNutrients,
    portions: food.portions,
    is_heme_source: food.tags.isHemeSource,
    phytate_level: food.tags.phytateLevel,
    oxalate_level: food.tags.oxalateLevel,
    is_fortified: food.tags.isFortified,
    fat_g: food.tags.fatG === null ? null : Math.round(food.tags.fatG * 100) / 100,
  };
}
