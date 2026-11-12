/** The portion a user is choosing in the UI: a household portion times a count, or grams. */

import type { Portion } from "@/lib/fdc/portions";
import { portionGrams } from "@/lib/nutrients/portion";
import type { PortionInput } from "./validate";

/** Text fields stay strings while the user types; resolveChoice() parses them. */
export type PortionChoice =
  { kind: "portion"; index: number; count: string } | { kind: "grams"; grams: string };

/** Parses "1.5", "1,5", "1/2" or "1 1/2". Null when not a positive number. */
export function parseQuantity(text: string): number | null {
  const t = text.trim().replace(",", ".");
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  const fraction = /^(\d+)\/(\d+)$/.exec(t);
  let value: number;
  if (mixed) value = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  else if (fraction) value = Number(fraction[1]) / Number(fraction[2]);
  else if (/^\d*\.?\d+$|^\d+\.$/.test(t)) value = Number(t);
  else return null;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** The portion to save, or null while the input is incomplete or invalid. */
export function resolveChoice(
  choice: PortionChoice,
  portions: readonly Portion[],
): PortionInput | null {
  if (choice.kind === "grams") {
    const grams = parseQuantity(choice.grams);
    return grams === null ? null : { grams, portionLabel: null, portionCount: null };
  }
  const portion = portions[choice.index];
  const count = parseQuantity(choice.count);
  if (!portion || count === null) return null;
  return {
    grams: portionGrams(portion.grams, count),
    portionLabel: portion.label,
    portionCount: count,
  };
}

/** Preselects a saved portion when it still exists, else the first household portion, else 100 g. */
export function initialChoice(portions: readonly Portion[], saved?: PortionInput): PortionChoice {
  if (saved) {
    const index = saved.portionLabel
      ? portions.findIndex((p) => p.label === saved.portionLabel)
      : -1;
    if (index >= 0 && saved.portionCount) {
      return { kind: "portion", index, count: String(saved.portionCount) };
    }
    return { kind: "grams", grams: String(saved.grams) };
  }
  if (portions.length > 0) return { kind: "portion", index: 0, count: "1" };
  return { kind: "grams", grams: "100" };
}
