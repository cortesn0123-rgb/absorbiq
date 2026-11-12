/** Lookup over absorption factor rows, plus the interpolation helpers the rules share. */

import { FACTOR_ROWS, type FactorRow } from "./factors";

/**
 * Every estimate is computed three times: with the central values, and with the values that
 * give the lowest and the highest plausible absorption.
 */
export type Scenario = "low" | "value" | "high";
export const SCENARIOS: readonly Scenario[] = ["low", "value", "high"];

export type Triple = Record<Scenario, number>;

const rowKey = (nutrient: string, key: string) => `${nutrient}/${key}`;

export class FactorTable {
  private readonly rows = new Map<string, FactorRow>();

  constructor(rows: readonly FactorRow[]) {
    for (const row of rows) this.rows.set(rowKey(row.nutrient, row.key), row);
  }

  /** Rows from the database replace the built-in defaults key by key. */
  static withOverrides(
    overrides: readonly FactorRow[],
    defaults: readonly FactorRow[] = FACTOR_ROWS,
  ): FactorTable {
    return new FactorTable([...defaults, ...overrides]);
  }

  get(nutrient: string, key: string): FactorRow {
    const row = this.rows.get(rowKey(nutrient, key));
    if (!row) throw new Error(`Missing absorption factor ${rowKey(nutrient, key)}`);
    return row;
  }

  /** Curve points stored as `<prefix>:<x>` keys, sorted by x. */
  curve(nutrient: string, prefix: string): { x: number; row: FactorRow }[] {
    const points: { x: number; row: FactorRow }[] = [];
    for (const row of this.rows.values()) {
      if (row.nutrient !== nutrient || !row.key.startsWith(`${prefix}:`)) continue;
      const x = Number(row.key.slice(prefix.length + 1));
      if (Number.isFinite(x)) points.push({ x, row });
    }
    if (points.length === 0)
      throw new Error(`Missing absorption curve ${rowKey(nutrient, prefix)}`);
    return points.sort((a, b) => a.x - b.x);
  }

  all(): FactorRow[] {
    return [...this.rows.values()];
  }
}

export const DEFAULT_FACTORS = new FactorTable(FACTOR_ROWS);

/** A factor's value in a scenario, when a higher value means more absorption. */
export function pick(row: FactorRow, scenario: Scenario): number {
  return row[scenario];
}

/** A quantity's value in a scenario, when a higher value means LESS absorption (e.g. phytate). */
export function pickInverse(row: FactorRow, scenario: Scenario): number {
  if (scenario === "low") return row.high;
  if (scenario === "high") return row.low;
  return row.value;
}

export function triple(fn: (scenario: Scenario) => number): Triple {
  return { low: fn("low"), value: fn("value"), high: fn("high") };
}

/**
 * Interpolates a curve at x, holding the end values outside it. "log" interpolates on
 * ln(x + 1), for dose–response curves measured at doses spread over orders of magnitude.
 */
export function interpolate(
  points: readonly { x: number; y: number }[],
  x: number,
  scale: "linear" | "log" = "linear",
): number {
  const t = (v: number) => (scale === "log" ? Math.log(v + 1) : v);
  if (x <= points[0].x) return points[0].y;
  const last = points[points.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (x <= b.x) {
      const f = (t(x) - t(a.x)) / (t(b.x) - t(a.x));
      return a.y + f * (b.y - a.y);
    }
  }
  return last.y;
}

/** A stored curve evaluated at x in one scenario. */
export function curveAt(
  table: FactorTable,
  nutrient: string,
  prefix: string,
  x: number,
  scenario: Scenario,
  scale: "linear" | "log" = "linear",
): number {
  const points = table.curve(nutrient, prefix).map((p) => ({ x: p.x, y: pick(p.row, scenario) }));
  return interpolate(points, x, scale);
}
