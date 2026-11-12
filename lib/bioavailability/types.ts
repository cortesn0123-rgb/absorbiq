import type { NutrientAmounts } from "@/lib/fdc/mapping";
import type { FoodRecordTags } from "@/lib/fdc/record";
import type { LifeStage, NutrientId, Sex } from "@/lib/nutrients/registry";

/** One food as eaten in a meal. */
export interface EngineFood {
  /** Stable id for the food in this meal, e.g. the food log id. */
  key: string;
  name: string;
  grams: number;
  /** Consumed nutrients per 100 g; a missing key means "no data". */
  per100g: NutrientAmounts;
  /** Preformed vitamin A (retinol) in mcg per 100 g, or null when unknown. */
  retinolPer100g: number | null;
  tags: FoodRecordTags;
}

/** The parts of the user profile that change absorption estimates. All optional. */
export interface EngineProfile {
  age: number | null;
  sex: Sex | null;
  lifeStage: LifeStage;
}

export const DEFAULT_PROFILE: EngineProfile = { age: null, sex: null, lifeStage: "none" };

/**
 * - "absorbed": `absorbed` is an estimate of what the body takes in.
 * - "as-eaten": the nutrient is not absorbed as such (fiber) or simply counted as eaten
 *   (water); `absorbed` equals `consumed`.
 */
export type Basis = "absorbed" | "as-eaten";

export interface NutrientEstimate {
  /** Null when FoodData Central has no data. */
  consumed: number | null;
  absorbed: number | null;
  low: number | null;
  high: number | null;
  /** Plain-English explanations, shown in the tooltip. */
  reasons: string[];
  basis: Basis;
}

export type NutrientEstimates = Record<NutrientId, NutrientEstimate>;

export interface TotalEstimate extends NutrientEstimate {
  /** Foods with no data for this nutrient, so the total may be low. */
  missingCount: number;
}

export type TotalEstimates = Record<NutrientId, TotalEstimate>;

export interface FoodAbsorption {
  key: string;
  name: string;
  nutrients: NutrientEstimates;
}

export interface MealAbsorption {
  foods: FoodAbsorption[];
  totals: TotalEstimates;
}

export interface DayMealInput {
  key: string;
  /** Shown in day-total reasons, e.g. "Lunch". */
  label: string;
  foods: EngineFood[];
}

export interface DayAbsorption {
  meals: { key: string; label: string; absorption: MealAbsorption }[];
  totals: TotalEstimates;
}
