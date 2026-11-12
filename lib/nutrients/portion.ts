/**
 * Per-portion math: scales per-100 g nutrient amounts to a portion and sums portions. Missing
 * data stays missing (never treated as zero) so the UI can show "no data".
 */

import type { NutrientAmounts } from "@/lib/fdc/mapping";
import { NUTRIENT_IDS, type NutrientId } from "./registry";

export const MAX_PORTION_GRAMS = 5000;

/** Grams for `count` portions of `gramsPerPortion`, rounded to 0.1 g (the food_logs precision). */
export function portionGrams(gramsPerPortion: number, count: number): number {
  return Math.round(gramsPerPortion * count * 10) / 10;
}

export function nutrientsForGrams(per100g: NutrientAmounts, grams: number): NutrientAmounts {
  const scaled: NutrientAmounts = {};
  for (const id of NUTRIENT_IDS) {
    const value = per100g[id];
    if (value !== undefined) scaled[id] = (value * grams) / 100;
  }
  return scaled;
}

export interface NutrientTotal {
  /** Sum over the portions that have data; null when none do. */
  amount: number | null;
  /** Number of portions with no data for this nutrient, so the total may be an undercount. */
  missingCount: number;
}

export function sumNutrients(
  portions: readonly NutrientAmounts[],
): Record<NutrientId, NutrientTotal> {
  const totals = {} as Record<NutrientId, NutrientTotal>;
  for (const id of NUTRIENT_IDS) {
    let amount: number | null = null;
    let missingCount = 0;
    for (const portion of portions) {
      const value = portion[id];
      if (value === undefined) missingCount++;
      else amount = (amount ?? 0) + value;
    }
    totals[id] = { amount, missingCount };
  }
  return totals;
}
