/** Household portions ("1 cup", "1 medium") from an FDC food, with their gram weights. */

import type { FdcFoodDetail, FdcFoodPortion } from "./types";

export interface Portion {
  label: string;
  grams: number;
}

/** Survey (FNDDS) default portion; not a real household measure. */
const UNSPECIFIED = "quantity not specified";

/**
 * Branded serving units in grams or millilitres. Branded nutrients for liquids are per 100 mL;
 * we treat 1 mL as 1 g (no density data), so millilitre servings carry over unchanged.
 */
const SERVING_UNITS = new Set(["g", "grm", "ml", "mlt"]);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function portionLabel(p: FdcFoodPortion): string | null {
  const description = p.portionDescription?.trim();
  if (description && description.toLowerCase() !== UNSPECIFIED) return description;

  const amount = p.amount && p.amount > 0 ? p.amount : 1;
  const unit = p.measureUnit?.name?.trim();
  // Survey modifiers are numeric codes, not words.
  const modifier = p.modifier?.trim() && !/^\d+$/.test(p.modifier.trim()) ? p.modifier.trim() : "";

  if (unit && unit !== "undetermined") {
    // RACC = FDA Reference Amount Customarily Consumed, i.e. a standard serving.
    const name = unit === "RACC" ? "serving" : unit;
    return [String(amount), name, modifier].filter(Boolean).join(" ");
  }
  if (modifier) return `${amount} ${modifier}`;
  return null;
}

function brandedServing(food: FdcFoodDetail): Portion | null {
  const size = food.servingSize;
  const unit = food.servingSizeUnit?.trim().toLowerCase();
  if (!size || size <= 0 || !unit || !SERVING_UNITS.has(unit)) return null;
  const household = food.householdServingFullText?.trim().toLowerCase();
  return { label: household || "1 serving", grams: round1(size) };
}

/** Portions in FDC order, without duplicates. The UI always offers grams as well. */
export function portionsFromFdc(food: FdcFoodDetail): Portion[] {
  const candidates: Portion[] = [];
  const serving = brandedServing(food);
  if (serving) candidates.push(serving);

  const sorted = [...(food.foodPortions ?? [])].sort(
    (a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0),
  );
  for (const p of sorted) {
    if (!p.gramWeight || p.gramWeight <= 0) continue;
    const label = portionLabel(p);
    if (label) candidates.push({ label, grams: round1(p.gramWeight) });
  }

  const seen = new Set<string>();
  return candidates.filter((p) => {
    const key = p.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
