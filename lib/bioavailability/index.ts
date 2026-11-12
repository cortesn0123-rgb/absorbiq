/**
 * lib/bioavailability — the only place absorption is calculated. Pure and unit-tested.
 * See docs/bioavailability.md for every rule, factor and source.
 */

import type { FoodRecord } from "@/lib/fdc/record";
import type { EngineFood } from "./types";

export { absorbDay, absorbMeal, sumEstimates } from "./engine";
export { DEFAULT_FACTORS, FactorTable } from "./factor-table";
export { FACTOR_ROWS, type FactorRow } from "./factors";
export {
  absorptionScore,
  typicalAbsorption,
  type AbsorptionScore,
  type TypicalAbsorption,
} from "./score";
export * from "./types";

/** A logged food portion as engine input. */
export function toEngineFood(key: string, food: FoodRecord, grams: number): EngineFood {
  return {
    key,
    name: food.name,
    grams,
    per100g: food.nutrientsPer100g,
    retinolPer100g: food.retinolPer100g,
    tags: food.tags,
  };
}
