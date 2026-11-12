/**
 * The parts of the USDA FoodData Central API responses we use.
 * https://fdc.nal.usda.gov/api-spec/fdc_api.html — every field is optional because coverage
 * varies by data type.
 */

export const FDC_DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"] as const;
export type FdcDataType = (typeof FDC_DATA_TYPES)[number];

export interface FdcFoodNutrient {
  nutrient?: { number?: string; name?: string; unitName?: string };
  /** Per 100 g (per 100 mL for some branded liquids). Absent on header rows such as "Proximates". */
  amount?: number;
}

export interface FdcFoodPortion {
  amount?: number;
  gramWeight?: number;
  /** SR Legacy: the household unit, e.g. "cup". Survey: a numeric code. */
  modifier?: string;
  /** Survey (FNDDS): the full label, e.g. "1 cup". */
  portionDescription?: string;
  /** Foundation: the unit, e.g. "cup" or "RACC". SR Legacy and Survey: "undetermined". */
  measureUnit?: { name?: string };
  sequenceNumber?: number;
}

export interface FdcFoodDetail {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients?: FdcFoodNutrient[];
  foodPortions?: FdcFoodPortion[];
  /** Foundation and SR Legacy. */
  foodCategory?: { description?: string };
  /** Survey (FNDDS). */
  wweiaFoodCategory?: { wweiaFoodCategoryDescription?: string };
  /** Branded. */
  brandedFoodCategory?: string;
  brandOwner?: string;
  brandName?: string;
  ingredients?: string;
  servingSize?: number;
  /** e.g. "g", "GRM", "ml", "MLT". */
  servingSizeUnit?: string;
  householdServingFullText?: string;
}

export interface FdcSearchFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  brandName?: string;
  foodCategory?: string;
}

export interface FdcSearchResponse {
  foods?: FdcSearchFood[];
}
