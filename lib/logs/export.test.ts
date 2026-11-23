import { describe, expect, it } from "vitest";
import type { TotalEstimate, TotalEstimates } from "@/lib/bioavailability";
import { NUTRIENT_IDS } from "@/lib/nutrients/registry";
import { buildExportCsv, CSV_HEADER, MAX_EXPORT_DAYS, parseExportRange } from "./export";
import { addDays } from "@/lib/dates";

function totals(over: Partial<Record<string, Partial<TotalEstimate>>> = {}): TotalEstimates {
  const t = {} as TotalEstimates;
  for (const id of NUTRIENT_IDS) {
    t[id] = {
      consumed: null,
      absorbed: null,
      low: null,
      high: null,
      reasons: [],
      basis: "absorbed",
      missingCount: 0,
      ...over[id],
    } as TotalEstimate;
  }
  return t;
}

describe("parseExportRange", () => {
  it("lists every date, inclusive", () => {
    expect(parseExportRange("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });
  it("rejects bad or reversed dates", () => {
    expect(() => parseExportRange("2026-13-01", "2026-12-01")).toThrow();
    expect(() => parseExportRange(null, "2026-12-01")).toThrow();
    expect(() => parseExportRange("2026-12-02", "2026-12-01")).toThrow(/on or before/);
  });
  it("caps the range length", () => {
    const from = "2025-01-01";
    expect(parseExportRange(from, addDays(from, MAX_EXPORT_DAYS - 1))).toHaveLength(
      MAX_EXPORT_DAYS,
    );
    expect(() => parseExportRange(from, addDays(from, MAX_EXPORT_DAYS))).toThrow(/at most/);
  });
});

describe("buildExportCsv", () => {
  it("writes one row per logged day and visible nutrient, blanks for no data", () => {
    const csv = buildExportCsv(
      [
        {
          date: "2026-11-20",
          totals: totals({
            iron: { consumed: 12.34567, absorbed: 1.2, low: 0.8, high: 1.9, missingCount: 1 },
          }),
        },
        { date: "2026-11-21", totals: null },
      ],
      ["iron", "calcium"],
    );
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(CSV_HEADER.join(","));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("2026-11-20,Iron,mg,12.346,1.2,0.8,1.9,1");
    expect(lines[2]).toMatch(/^2026-11-20,Calcium,mg,,,,,0$/);
  });
});
