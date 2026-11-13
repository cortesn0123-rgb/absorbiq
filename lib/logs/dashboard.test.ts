import { describe, expect, it } from "vitest";
import type { NutrientAmounts } from "@/lib/fdc/mapping";
import { formatAmount } from "@/lib/format";
import { applyCustomGoals } from "@/lib/nutrients/goals";
import { getDailyTargets } from "@/lib/nutrients/targets";
import { visibleNutrients } from "@/lib/nutrients/tracking";
import {
  bandOf,
  biggestGaps,
  historyRows,
  macroSummary,
  microRows,
  upperLimitWarnings,
} from "./dashboard";
import { buildGoalRows } from "./day-goals";

const goals = applyCustomGoals(
  getDailyTargets({
    tier: "average",
    sex: "female",
    age: 30,
    weightKg: 60,
    heightCm: 165,
    activityLevel: "low_active",
    trainingHoursPerDay: 0,
  }),
  {},
);

const lunch = { slot: "lunch" as const, snackNumber: null };
const eat = (amounts: NutrientAmounts) => ({ occasion: lunch, amounts });

describe("bandOf", () => {
  it("splits targets at 50% and 100%, and flags limits and upper limits", () => {
    expect(bandOf({ ratio: 0.2, status: "under", overUl: null })).toBe("low");
    expect(bandOf({ ratio: 0.5, status: "under", overUl: null })).toBe("partway");
    expect(bandOf({ ratio: 1, status: "met", overUl: null })).toBe("met");
    expect(bandOf({ ratio: 3, status: "met", overUl: { ul: 45 } })).toBe("over-ul");
    expect(bandOf({ ratio: 0.5, status: "under-limit", overUl: null })).toBe("under-limit");
    expect(bandOf({ ratio: 0.9, status: "under-limit", overUl: null })).toBe("near-limit");
    expect(bandOf({ ratio: 1.2, status: "over-limit", overUl: null })).toBe("over-limit");
    expect(bandOf({ ratio: null, status: "none", overUl: null })).toBe("none");
  });
});

describe("today", () => {
  const rows = buildGoalRows({
    visible: visibleNutrients(["iron", "calcium", "vitamin_c", "zinc", "magnesium"]),
    goals,
    foods: [eat({ iron: 9, calcium: 100, vitamin_c: 200, zinc: 6, magnesium: 300 })],
    showScore: false,
  });

  it("keeps only micros for the Today card", () => {
    expect(microRows(rows).map((r) => r.id)).toEqual([
      "vitamin_c",
      "calcium",
      "iron",
      "magnesium",
      "zinc",
    ]);
  });

  it("lists the three micros furthest below goal, most behind first", () => {
    // calcium 100/1000 = 10%, iron 9/18 = 50%, zinc 6/8 = 75%, magnesium 300/310 = 97%.
    expect(biggestGaps(rows).map((r) => r.id)).toEqual(["calcium", "iron", "zinc"]);
  });

  it("warns when food intake passes a tolerable upper limit", () => {
    const high = buildGoalRows({
      visible: visibleNutrients(["iron"]),
      goals,
      foods: [eat({ iron: 50 })],
      showScore: false,
    });
    expect(upperLimitWarnings(high).map((r) => r.id)).toEqual(["iron"]);
  });
});

describe("macroSummary", () => {
  it("shows grams and % of calories with the target range, water from drinks and food", () => {
    const m = macroSummary({
      goals,
      foods: [eat({ energy: 2000, protein: 100, carbohydrate: 250, fat: 66.7, water: 500 })],
      waterDrunkMl: 1000,
    });
    const protein = m.shares.find((s) => s.id === "protein")!;
    expect(protein.grams).toBe(100);
    expect(protein.pctOfCalories).toBeCloseTo(0.2);
    expect(protein.targetPct!.max).toBeCloseTo((goals.protein.max! * 4) / goals.energy.value!);
    expect(m.water).toMatchObject({ consumed: 1500, drinksMl: 1000, foodMl: 500 });
    expect(m.limits.map((r) => r.id)).toEqual(["saturated_fat", "added_sugars", "sodium"]);
    // Average tier: no numeric cholesterol limit, so it is shown without a bar.
    expect(m.noLimit.map((n) => n.id)).toContain("cholesterol");
  });
});

describe("historyRows", () => {
  it("gives percent of goal per nutrient per day, blank on days with nothing logged", () => {
    const rows = historyRows(
      [
        { date: "2026-11-10", goals, foods: [eat({ iron: 9 })] },
        { date: "2026-11-11", goals, foods: [] },
      ],
      visibleNutrients(["iron"]),
      formatAmount,
    );
    const iron = rows.find((r) => r.id === "iron")!;
    expect(iron.cells[0]).toMatchObject({ ratio: 0.5, band: "partway", detail: "9 mg / 18 mg" });
    expect(iron.cells[1]).toMatchObject({ ratio: null, band: "none" });
    expect(rows.map((r) => r.id)).not.toContain("water");
  });
});
