import { describe, expect, it } from "vitest";
import { absorbMeal, type TotalEstimates } from "@/lib/bioavailability";
import { lentils, orangeJuice } from "@/lib/bioavailability/test-foods";
import type { NutrientAmounts } from "@/lib/fdc/mapping";
import { applyCustomGoals } from "@/lib/nutrients/goals";
import { getDailyTargets } from "@/lib/nutrients/targets";
import { visibleNutrients } from "@/lib/nutrients/tracking";
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

const noAbsorption = absorbMeal([]).totals;

describe("buildGoalRows", () => {
  it("shows only Iron, Calcium and Vitamin D among micros when only those are tracked", () => {
    const rows = buildGoalRows({
      visible: visibleNutrients(["iron", "calcium", "vitamin_d"]),
      goals,
      foods: [],
      absorption: noAbsorption,
      showScore: false,
    });
    const ids = rows.map((r) => r.id);
    expect(ids.filter((id) => ["vitamin_d", "calcium", "iron"].includes(id))).toEqual([
      "vitamin_d",
      "calcium",
      "iron",
    ]);
    expect(ids).toEqual([
      "vitamin_d",
      "calcium",
      "iron",
      "energy",
      "protein",
      "carbohydrate",
      "fiber",
      "added_sugars",
      "fat",
      "saturated_fat",
    ]);
    const iron = rows.find((r) => r.id === "iron")!;
    expect(iron).toMatchObject({ consumed: 0, goalLabel: "18 mg", ratio: 0 });
  });

  it("compares consumed (not absorbed) intake with the goal, and adds the score when asked", () => {
    const meal = absorbMeal([lentils(), orangeJuice()]);
    const foods = meal.foods.map((f) => ({
      occasion: { slot: "lunch" as const, snackNumber: null },
      amounts: Object.fromEntries(
        Object.entries(f.nutrients).flatMap(([id, e]) =>
          e.consumed === null ? [] : [[id, e.consumed]],
        ),
      ) as NutrientAmounts,
    }));
    const [iron] = buildGoalRows({
      visible: ["iron"],
      goals,
      foods,
      absorption: meal.totals as TotalEstimates,
      showScore: true,
    });
    expect(iron.consumed).toBeCloseTo(meal.totals.iron.consumed!);
    expect(iron.ratio).toBeCloseTo(meal.totals.iron.consumed! / 18);
    expect(iron.score).not.toBeNull();
    expect(iron.score!.value).toBeGreaterThan(0);

    const [withoutScore] = buildGoalRows({
      visible: ["iron"],
      goals,
      foods,
      absorption: meal.totals as TotalEstimates,
      showScore: false,
    });
    expect(withoutScore.score).toBeNull();
    expect(withoutScore.ratio).toBe(iron.ratio);
  });

  it("checks added sugars per meal, each snack on its own", () => {
    const sugar = (g: number): NutrientAmounts => ({ added_sugars: g });
    const [row] = buildGoalRows({
      visible: ["added_sugars"],
      goals,
      foods: [
        { occasion: { slot: "snack", snackNumber: 1 }, amounts: sugar(8) },
        { occasion: { slot: "snack", snackNumber: 2 }, amounts: sugar(8) },
        { occasion: { slot: "dinner", snackNumber: null }, amounts: sugar(12) },
      ],
      absorption: noAbsorption,
      showScore: true,
    });
    expect(row).toMatchObject({ consumed: 12, status: "over-limit", score: null });
    expect(row.detail).toMatch(/^1 meal over/);
  });

  it("says no data rather than zero when no food reports the nutrient", () => {
    const [row] = buildGoalRows({
      visible: ["iodine"],
      goals,
      foods: [{ occasion: { slot: "lunch", snackNumber: null }, amounts: { iron: 2 } }],
      absorption: noAbsorption,
      showScore: false,
    });
    expect(row).toMatchObject({ consumed: null, ratio: null, status: "none" });
  });
});
