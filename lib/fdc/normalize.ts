/** Turns an FDC food detail response into what we cache in the foods table. */

import type { NutrientId } from "@/lib/nutrients/registry";
import {
  mapToRegistry,
  readFdcNutrients,
  type FdcNutrientMap,
  type NutrientAmounts,
} from "./mapping";
import { portionsFromFdc, type Portion } from "./portions";
import { tagFood, type FoodTags } from "./tags";
import type { FdcFoodDetail } from "./types";

export interface NormalizedFood {
  fdcId: number;
  name: string;
  dataType: string;
  brand: string | null;
  category: string | null;
  fdcNutrients: FdcNutrientMap;
  nutrientsPer100g: NutrientAmounts;
  /** Registry nutrients FDC has no data for. */
  missing: NutrientId[];
  portions: Portion[];
  tags: FoodTags;
}

/** Branded names are often ALL CAPS; make them readable. */
export function tidyName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (/[a-z]/.test(trimmed)) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s(/-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

export function foodCategory(food: FdcFoodDetail): string | null {
  const category =
    food.foodCategory?.description ??
    food.wweiaFoodCategory?.wweiaFoodCategoryDescription ??
    food.brandedFoodCategory;
  return category?.trim() || null;
}

export function foodBrand(food: { brandName?: string; brandOwner?: string }): string | null {
  const brand = food.brandName?.trim() || food.brandOwner?.trim();
  return brand ? tidyName(brand) : null;
}

export function normalizeFood(food: FdcFoodDetail): NormalizedFood {
  const fdcNutrients = readFdcNutrients(food.foodNutrients);
  const { per100g, missing } = mapToRegistry(fdcNutrients);
  const category = foodCategory(food);
  return {
    fdcId: food.fdcId,
    name: tidyName(food.description),
    dataType: food.dataType,
    brand: foodBrand(food),
    category,
    fdcNutrients,
    nutrientsPer100g: per100g,
    missing,
    portions: portionsFromFdc(food),
    tags: tagFood({
      description: food.description,
      category,
      dataType: food.dataType,
      ingredients: food.ingredients ?? null,
      fatPer100g: per100g.fat,
    }),
  };
}
