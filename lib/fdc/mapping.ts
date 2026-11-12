/**
 * Maps FDC nutrient numbers to registry nutrient ids. FDC detail responses report every
 * nutrient per 100 g, so values only need unit conversion.
 */

import { NUTRIENT_LIST, type FdcUnit, type NutrientId } from "@/lib/nutrients/registry";
import type { FdcFoodNutrient } from "./types";

export interface FdcAmount {
  amount: number;
  unit: FdcUnit;
}

/** Every nutrient FDC reported for a food, per 100 g, keyed by FDC nutrient number. */
export type FdcNutrientMap = Record<string, FdcAmount>;

/** Amounts in each nutrient's registry unit. A missing key means "no data", not zero. */
export type NutrientAmounts = Partial<Record<NutrientId, number>>;

const UNITS: Record<string, FdcUnit> = { KCAL: "KCAL", G: "G", MG: "MG", UG: "UG", MCG: "UG" };

/**
 * Parses FDC's `unitName` ("g", "mg", "µg", "kcal"). Returns null for units we never use,
 * such as IU and kJ, which FDC reports under separate nutrient numbers.
 */
export function parseFdcUnit(unitName: string | undefined): FdcUnit | null {
  if (!unitName) return null;
  // Both the micro sign (U+00B5) and Greek mu (U+03BC) appear; "µ".toUpperCase() is Greek "Μ".
  const key = unitName.trim().replace(/[µμ]/g, "u").toUpperCase();
  return UNITS[key] ?? null;
}

const MICROGRAMS: Partial<Record<FdcUnit, number>> = { G: 1e6, MG: 1e3, UG: 1 };

/** Converts between mass units; energy only converts to itself. Null when incompatible. */
export function convertFdcAmount(amount: number, from: FdcUnit, to: FdcUnit): number | null {
  if (from === to) return amount;
  const a = MICROGRAMS[from];
  const b = MICROGRAMS[to];
  if (a === undefined || b === undefined) return null;
  return (amount * a) / b;
}

/** Reads FDC's `foodNutrients` into a map keyed by nutrient number. */
export function readFdcNutrients(foodNutrients: readonly FdcFoodNutrient[] = []): FdcNutrientMap {
  const map: FdcNutrientMap = {};
  for (const { nutrient, amount } of foodNutrients) {
    const number = nutrient?.number;
    const unit = parseFdcUnit(nutrient?.unitName);
    if (!number || !unit || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      continue;
    }
    map[number] ??= { amount, unit };
  }
  return map;
}

export interface RegistryMapping {
  per100g: NutrientAmounts;
  /** Registry nutrients this food has no data for. */
  missing: NutrientId[];
}

/**
 * Picks each registry nutrient's value from the first FDC number (in registry preference order)
 * the food reports, converted to the registry unit. Vitamin A (RAE) and folate (DFE) are
 * copied as reported: FDC has already applied their bioavailability conversions.
 */
export function mapToRegistry(fdc: FdcNutrientMap): RegistryMapping {
  const per100g: NutrientAmounts = {};
  const missing: NutrientId[] = [];
  for (const def of NUTRIENT_LIST) {
    let value: number | null = null;
    for (const number of def.fdcNumbers) {
      const entry = fdc[number];
      if (!entry) continue;
      value = convertFdcAmount(entry.amount, entry.unit, def.fdcUnit);
      if (value !== null) break;
    }
    // Water: FDC grams equal millilitres, so the value carries over unchanged.
    if (value === null) missing.push(def.id);
    else per100g[def.id] = value;
  }
  return { per100g, missing };
}
