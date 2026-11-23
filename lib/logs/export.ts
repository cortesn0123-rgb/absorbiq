/** CSV export of eaten and absorbed amounts per nutrient per day. Pure; tested. */

import type { TotalEstimates } from "@/lib/bioavailability";
import { addDays } from "@/lib/dates";
import { NUTRIENTS, type NutrientId } from "@/lib/nutrients/registry";
import { parseDate, ValidationError } from "./validate";

/** Longest range one export may cover. */
export const MAX_EXPORT_DAYS = 366;

export const CSV_HEADER = [
  "date",
  "nutrient",
  "unit",
  "consumed",
  "absorbed_estimate",
  "absorbed_low",
  "absorbed_high",
  "foods_missing_data",
] as const;

export interface ExportDay {
  date: string;
  /** Day totals from the engine; null when nothing was logged that day. */
  totals: TotalEstimates | null;
}

/** Validates `from`/`to` (YYYY-MM-DD, inclusive). Returns every date in the range, oldest first. */
export function parseExportRange(from: unknown, to: unknown): string[] {
  const start = parseDate(from);
  const end = parseDate(to);
  if (start > end) throw new ValidationError("The start date must be on or before the end date.");
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (dates.length === MAX_EXPORT_DAYS) {
      throw new ValidationError(`Export at most ${MAX_EXPORT_DAYS} days at a time.`);
    }
    dates.push(d);
  }
  return dates;
}

function num(value: number | null): string {
  return value === null ? "" : String(Math.round(value * 1000) / 1000);
}

function cell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * One row per logged day and nutrient in `visible` (the user's selection). Days with nothing
 * logged are left out. Empty cells mean no data. Absorbed amounts are estimates with a range.
 */
export function buildExportCsv(days: readonly ExportDay[], visible: readonly NutrientId[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const { date, totals } of days) {
    if (!totals) continue;
    for (const id of visible) {
      const t = totals[id];
      const n = NUTRIENTS[id];
      lines.push(
        [
          date,
          cell(n.name),
          n.unit,
          num(t.consumed),
          num(t.absorbed),
          num(t.low),
          num(t.high),
          String(t.missingCount),
        ].join(","),
      );
    }
  }
  return lines.join("\r\n") + "\r\n";
}
