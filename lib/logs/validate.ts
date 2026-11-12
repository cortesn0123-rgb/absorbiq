/** Validates untrusted input to the logging server actions. */

import { isIsoDate } from "@/lib/dates";
import { MAX_SNACKS_PER_DAY, isMealSlot, type MealOccasion } from "@/lib/meals";
import { MAX_PORTION_GRAMS } from "@/lib/nutrients/portion";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface PortionInput {
  grams: number;
  /** null when the user entered grams directly. */
  portionLabel: string | null;
  portionCount: number | null;
}

export interface LogEntryInput {
  foodId: number;
  date: string;
  occasion: MealOccasion;
  portion: PortionInput;
}

export const MAX_WATER_ML = 5000;

function record(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) throw new ValidationError("Invalid input.");
  return raw as Record<string, unknown>;
}

export function parseId(raw: unknown, what = "id"): number {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw <= 0) {
    throw new ValidationError(`Invalid ${what}.`);
  }
  return raw;
}

export function parseDate(raw: unknown): string {
  if (!isIsoDate(raw)) throw new ValidationError("Invalid date.");
  return raw;
}

export function parseOccasion(raw: unknown): MealOccasion {
  const { slot, snackNumber } = record(raw);
  if (!isMealSlot(slot)) throw new ValidationError("Choose a meal.");
  if (slot !== "snack") return { slot, snackNumber: null };
  if (
    typeof snackNumber !== "number" ||
    !Number.isInteger(snackNumber) ||
    snackNumber < 1 ||
    snackNumber > MAX_SNACKS_PER_DAY
  ) {
    throw new ValidationError("Choose a snack.");
  }
  return { slot, snackNumber };
}

export function parsePortion(raw: unknown): PortionInput {
  const { grams, portionLabel, portionCount } = record(raw);
  if (typeof grams !== "number" || !Number.isFinite(grams)) {
    throw new ValidationError("Enter an amount.");
  }
  const rounded = Math.round(grams * 10) / 10;
  if (rounded <= 0 || rounded > MAX_PORTION_GRAMS) {
    throw new ValidationError(`Amount must be between 0.1 and ${MAX_PORTION_GRAMS} g.`);
  }
  if (portionLabel === null || portionLabel === undefined) {
    return { grams: rounded, portionLabel: null, portionCount: null };
  }
  if (typeof portionLabel !== "string" || !portionLabel.trim() || portionLabel.length > 200) {
    throw new ValidationError("Invalid portion.");
  }
  if (
    typeof portionCount !== "number" ||
    !Number.isFinite(portionCount) ||
    portionCount <= 0 ||
    portionCount > 1000
  ) {
    throw new ValidationError("Invalid number of portions.");
  }
  return {
    grams: rounded,
    portionLabel: portionLabel.trim(),
    portionCount: Math.round(portionCount * 100) / 100,
  };
}

export function parseLogEntry(raw: unknown): LogEntryInput {
  const input = record(raw);
  return {
    foodId: parseId(input.foodId, "food"),
    date: parseDate(input.date),
    occasion: parseOccasion(input.occasion),
    portion: parsePortion(input.portion),
  };
}

export function parseWaterMl(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0 || raw > MAX_WATER_ML) {
    throw new ValidationError(`Enter between 1 and ${MAX_WATER_ML} mL.`);
  }
  return raw;
}
