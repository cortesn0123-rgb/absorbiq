/**
 * Household portions for suggested foods. The helper proposes grams; we snap them to the food's
 * own FDC household portion ("1 cup", "1 medium") when one is close, so the suggestion reads
 * naturally and the grams we evaluate are exactly what gets logged.
 */

import type { Portion } from "@/lib/fdc/portions";
import { MAX_PORTION_GRAMS, portionGrams } from "@/lib/nutrients/portion";

export interface SnappedPortion {
  grams: number;
  /** null when no household portion fits; the amount is shown in grams. */
  portionLabel: string | null;
  portionCount: number | null;
}

/** Household counts we offer: quarters up to 2, halves up to 4, then whole numbers up to 8. */
function niceCount(count: number): number {
  if (count <= 2) return Math.max(0.25, Math.round(count * 4) / 4);
  if (count <= 4) return Math.round(count * 2) / 2;
  return Math.round(count);
}

/** Largest change to the proposed grams we accept when snapping. */
export const SNAP_TOLERANCE = 0.15;
const MAX_COUNT = 8;

export function snapPortion(grams: number, portions: readonly Portion[]): SnappedPortion {
  const clamped = Math.min(Math.max(grams, 1), MAX_PORTION_GRAMS);
  let best: { error: number; portion: Portion; count: number } | null = null;
  for (const portion of portions) {
    if (portion.grams <= 0) continue;
    const count = niceCount(clamped / portion.grams);
    if (count > MAX_COUNT) continue;
    const error = Math.abs(portion.grams * count - clamped) / clamped;
    // Prefer the closest fit; on a tie, the smaller count (e.g. "1 cup" over "16 tbsp").
    if (
      !best ||
      error < best.error - 1e-9 ||
      (Math.abs(error - best.error) < 1e-9 && count < best.count)
    ) {
      best = { error, portion, count };
    }
  }
  if (best && best.error <= SNAP_TOLERANCE) {
    return {
      grams: portionGrams(best.portion.grams, best.count),
      portionLabel: best.portion.label,
      portionCount: best.count,
    };
  }
  return { grams: Math.round(clamped), portionLabel: null, portionCount: null };
}
