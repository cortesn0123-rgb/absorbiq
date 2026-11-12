/** The foods table row, and the shape the rest of the app uses. */

import { isNutrientId } from "@/lib/nutrients/registry";
import { convertFdcAmount, parseFdcUnit, type NutrientAmounts } from "./mapping";
import type { NormalizedFood } from "./normalize";
import type { Portion } from "./portions";
import type { FoodGroup, TagLevel } from "./tag-rules";
import { classifyFoodGroup, isLowOxalateGreen } from "./tags";

/** Tags the bioavailability engine reads. */
export interface FoodRecordTags {
  isHemeSource: boolean;
  phytateLevel: TagLevel;
  oxalateLevel: TagLevel;
  isFortified: boolean;
  /** Worked out on read from the name and category (see tag-rules.ts). */
  foodGroup: FoodGroup;
  isLowOxalateGreen: boolean;
}

export interface FoodRecord {
  /** Our foods.id */
  id: number;
  fdcId: number;
  name: string;
  brand: string | null;
  dataType: string;
  nutrientsPer100g: NutrientAmounts;
  /**
   * Preformed vitamin A (retinol, FDC 319) in mcg per 100 g; the rest of the RAE is from
   * carotenoids. Null when FDC does not report retinol.
   */
  retinolPer100g: number | null;
  portions: Portion[];
  tags: FoodRecordTags;
}

/** Columns for `FoodRow`, for Supabase selects (also usable inside a join). */
export const FOOD_COLUMNS =
  "id, fdc_id, name, brand, data_type, category, nutrients_per_100g, fdc_nutrients, portions, is_heme_source, phytate_level, oxalate_level, is_fortified";

export interface FoodRow {
  id: number;
  fdc_id: number;
  name: string;
  brand: string | null;
  data_type: string;
  category: string | null;
  nutrients_per_100g: Record<string, unknown>;
  fdc_nutrients: Record<string, { amount?: unknown; unit?: unknown }> | null;
  portions: Portion[] | null;
  is_heme_source: boolean;
  phytate_level: string;
  oxalate_level: string;
  is_fortified: boolean;
}

const LEVELS: readonly TagLevel[] = ["none", "low", "medium", "high"];
const toLevel = (value: string): TagLevel =>
  (LEVELS as readonly string[]).includes(value) ? (value as TagLevel) : "none";

/** FDC nutrient number for retinol (preformed vitamin A). */
const RETINOL = "319";

function retinolPer100g(fdc: FoodRow["fdc_nutrients"]): number | null {
  const entry = fdc?.[RETINOL];
  const unit = typeof entry?.unit === "string" ? parseFdcUnit(entry.unit) : null;
  if (!entry || typeof entry.amount !== "number" || !unit) return null;
  return convertFdcAmount(entry.amount, unit, "UG");
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
    retinolPer100g: retinolPer100g(row.fdc_nutrients),
    portions: row.portions ?? [],
    tags: {
      isHemeSource: row.is_heme_source,
      phytateLevel: toLevel(row.phytate_level),
      oxalateLevel: toLevel(row.oxalate_level),
      isFortified: row.is_fortified,
      foodGroup: classifyFoodGroup(row.name, row.category),
      isLowOxalateGreen: isLowOxalateGreen(row.name),
    },
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
