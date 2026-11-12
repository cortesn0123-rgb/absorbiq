import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_FACTORS } from "./factor-table";
import { FACTOR_ROWS } from "./factors";

describe("absorption factor rows", () => {
  it("each have low <= value <= high, non-negative", () => {
    for (const r of FACTOR_ROWS) {
      expect(r.low, `${r.nutrient}/${r.key}`).toBeGreaterThanOrEqual(0);
      expect(r.low, `${r.nutrient}/${r.key}`).toBeLessThanOrEqual(r.value);
      expect(r.value, `${r.nutrient}/${r.key}`).toBeLessThanOrEqual(r.high);
    }
  });

  it("each have a description and a source", () => {
    for (const r of FACTOR_ROWS) {
      expect(r.description.length, `${r.nutrient}/${r.key}`).toBeGreaterThan(10);
      expect(r.source.length, `${r.nutrient}/${r.key}`).toBeGreaterThan(10);
    }
  });

  it("have unique keys", () => {
    const keys = FACTOR_ROWS.map((r) => `${r.nutrient}/${r.key}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keep absorption fractions at or below 100%", () => {
    const notFractions =
      /(_g|_ug|_mg|ef_slope|ef_cap|ratio_cutoff|store_scale|per_g_protein|mg_per_100g)/;
    for (const r of FACTOR_ROWS) {
      if (r.nutrient === "phytate" || notFractions.test(r.key)) continue;
      expect(r.high, `${r.nutrient}/${r.key}`).toBeLessThanOrEqual(1);
    }
  });

  it("cover every phytate level", () => {
    for (const level of ["none", "low", "medium", "high"]) {
      expect(() => DEFAULT_FACTORS.get("phytate", `mg_per_100g_dry:${level}`)).not.toThrow();
    }
  });

  it("match the latest seed migration exactly", () => {
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const file = readdirSync(dir)
      .filter((f) => f.endsWith("_absorption_factors.sql"))
      .sort()
      .at(-1);
    expect(file, "an absorption factors seed migration").toBeDefined();
    const sql = readFileSync(path.join(dir, file!), "utf8");
    const tuple =
      /^ {2}\('([^']*)', '([^']*)', ([\d.e+-]+), ([\d.e+-]+), ([\d.e+-]+), '((?:[^']|'')*)', '((?:[^']|'')*)'\)/gm;
    const unquote = (s: string) => s.replace(/''/g, "'");
    const seeded = [...sql.matchAll(tuple)].map((m) => ({
      nutrient: m[1],
      key: m[2],
      value: Number(m[3]),
      low: Number(m[4]),
      high: Number(m[5]),
      description: unquote(m[6]),
      source: unquote(m[7]),
    }));
    expect(seeded).toEqual(FACTOR_ROWS);
  });
});
