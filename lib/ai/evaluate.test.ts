import { describe, expect, it } from "vitest";
import { mealsLeft, remaining, snapshot } from "./day";
import { evaluatePlan, evaluationForClaude, sig3 } from "./evaluate";
import { LENTILS, LUNCH, ORANGE_JUICE, SODA, testDay } from "./fixtures";

const lunch = (food: typeof LENTILS, grams: number) => ({
  food,
  grams,
  occasion: LUNCH,
  portionLabel: null,
  portionCount: null,
});

describe("snapshot", () => {
  it("compares consumed intake with goals for visible nutrients only", () => {
    const s = snapshot(testDay());
    const ids = s.nutrients.map((n) => n.id);
    expect(ids).toContain("iron");
    expect(ids).toContain("energy");
    expect(ids).not.toContain("zinc"); // not tracked
    const iron = s.nutrients.find((n) => n.id === "iron")!;
    expect(iron.consumed).toBeCloseTo((0.03 * 244) / 100);
    expect(remaining(iron)).toBeCloseTo(18 - (0.03 * 244) / 100);
  });
});

describe("evaluatePlan", () => {
  it("adds proposed foods to consumed intake, in their meal", () => {
    const day = testDay();
    const plan = [lunch(LENTILS, 198), lunch(ORANGE_JUICE, 248)];
    const result = evaluatePlan(day, plan);
    const iron = result.gaps.find((g) => g.id === "iron")!;
    const ironEaten = (0.03 * 244) / 100;
    expect(iron.before).toBeCloseTo(ironEaten);
    expect(iron.after).toBeCloseTo(ironEaten + (3.33 * 198) / 100 + (0.2 * 248) / 100);
    expect(iron.goal).toBe(18);
    expect(iron.met).toBe(false);
    // Milk has no vitamin C data, so nothing counted toward it before the plan.
    const vitC = result.gaps.find((g) => g.id === "vitamin_c")!;
    expect(vitC.before).toBe(0);
    expect(vitC.met).toBe(true);
    expect(result.calories.added).toBeCloseTo((116 * 198) / 100 + (45 * 248) / 100);
  });

  it("reports a better iron absorption score when vitamin C is eaten with lentils", () => {
    const day = testDay([]);
    const alone = evaluatePlan(day, [lunch(LENTILS, 198)]);
    const paired = evaluatePlan(day, [lunch(LENTILS, 198), lunch(ORANGE_JUICE, 248)]);
    const score = (r: typeof alone) => r.after.nutrients.find((n) => n.id === "iron")!.score!;
    expect(score(paired)).toBeGreaterThan(score(alone));
    expect(paired.scores.some((s) => s.id === "iron")).toBe(true);
  });

  it("flags a meal over the per-meal added sugar limit (each snack on its own)", () => {
    const day = testDay([]);
    const snack = { slot: "snack" as const, snackNumber: 1 };
    const result = evaluatePlan(day, [
      { food: SODA, grams: 368, occasion: snack, portionLabel: "1 can", portionCount: 1 },
    ]);
    expect(result.warnings.map((w) => w.kind)).toContain("meal-limit");
    expect(result.warnings[0].text).toContain("Snack 1");
  });

  it("warns when a plan would go above a tolerable upper limit", () => {
    const day = testDay([]);
    // 1.6 kg of lentils: iron far above the 45 mg UL.
    const result = evaluatePlan(day, [lunch(LENTILS, 1600)]);
    expect(result.warnings.some((w) => w.kind === "over-ul" && w.text.startsWith("Iron"))).toBe(
      true,
    );
  });

  it("gives Claude the same numbers, rounded", () => {
    const day = testDay();
    const plan = [lunch(LENTILS, 198)];
    const evaluation = evaluatePlan(day, plan);
    const forClaude = evaluationForClaude(plan, evaluation, []);
    const iron = forClaude.gaps.find((g) => g.nutrient === "iron")!;
    expect(iron.after).toBe(sig3(evaluation.gaps.find((g) => g.id === "iron")!.after));
    expect(forClaude.items[0].household_portions).toEqual(["1 cup = 198 g"]);
  });
});

describe("mealsLeft", () => {
  it("lists main meals not yet past, plus snacks", () => {
    expect(mealsLeft(8)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
    expect(mealsLeft(13)).toEqual(["lunch", "dinner", "snack"]);
    expect(mealsLeft(23)).toEqual(["snack"]);
  });
});
