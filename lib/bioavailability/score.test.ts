import { describe, expect, it } from "vitest";
import { absorbMeal } from "./engine";
import { absorptionScore, typicalAbsorption } from "./score";
import { carrots, lentils, oliveOil, orangeJuice } from "./test-foods";

const est = (consumed: number, absorbed: number) => ({
  consumed,
  absorbed,
  low: absorbed * 0.8,
  high: absorbed * 1.2,
});

describe("absorption score", () => {
  it("is absorbed ÷ (consumed × typical absorption), so 1 means typical for what was eaten", () => {
    // Iron: a typical mixed diet absorbs 16%; 10 mg eaten -> 1.6 mg typical absorbed.
    const s = absorptionScore("iron", est(10, 1.6), 18)!;
    expect(s.typicalAbsorbed).toBeCloseTo(1.6);
    expect(s.score).toBeCloseTo(1);
    expect(s.scoreLow).toBeCloseTo(0.8);
    expect(s.scoreHigh).toBeCloseTo(1.2);
  });

  it("does not depend on how much was eaten or on the goal", () => {
    // Same absorption rate (twice typical) at a fifth of the goal and at the full goal.
    const small = absorptionScore("iron", est(3.6, 3.6 * 0.32), 18)!;
    const full = absorptionScore("iron", est(18, 18 * 0.32), 18)!;
    const otherGoal = absorptionScore("iron", est(18, 18 * 0.32), 8)!;
    expect(small.score).toBeCloseTo(2);
    expect(full.score).toBeCloseTo(2);
    expect(otherGoal.score).toBeCloseTo(2);
  });

  it("rises when orange juice is paired with lentils", () => {
    const score = (foods: Parameters<typeof absorbMeal>[0]) =>
      absorptionScore("iron", absorbMeal(foods).totals.iron, 18)!.score!;
    const alone = score([lentils()]);
    const withOj = score([lentils(), orangeJuice()]);
    expect(withOj).toBeGreaterThan(alone);
    // Lentils alone fall short of a typical mixed diet.
    expect(alone).toBeLessThan(1);
  });

  it("is 1 for vitamin A (RAE) when the meal has fat, whatever the amount", () => {
    for (const grams of [30, 60, 240]) {
      const totals = absorbMeal([carrots(grams), oliveOil()]).totals.vitamin_a;
      expect(absorptionScore("vitamin_a", totals, 900)!.score).toBeCloseTo(1);
    }
  });

  it("is 1 for copper, whose typical absorption is read at the amount eaten", () => {
    const totals = absorbMeal([lentils()]).totals.copper;
    expect(absorptionScore("copper", totals, 0.9)!.score).toBeCloseTo(1);
  });

  it("is not computed for limits, as-eaten nutrients, carbohydrate or missing goals", () => {
    for (const id of ["sodium", "saturated_fat", "added_sugars", "cholesterol"] as const) {
      expect(absorptionScore(id, est(10, 9), 20)).toBeNull();
    }
    for (const id of ["energy", "fiber", "water", "carbohydrate"] as const) {
      expect(absorptionScore(id, est(10, 9), 20)).toBeNull();
    }
    expect(absorptionScore("iron", est(10, 1), null)).toBeNull();
    expect(absorptionScore("iron", est(10, 1), 0)).toBeNull();
    expect(
      absorptionScore("iron", { consumed: null, absorbed: null, low: null, high: null }, 18),
    ).toBeNull();
  });

  it("has no value when nothing was eaten (shown as —)", () => {
    expect(absorptionScore("zinc", est(0, 0), 11)).toEqual({
      typicalAbsorbed: 0,
      score: null,
      scoreLow: null,
      scoreHigh: null,
    });
  });
});

describe("typical absorption", () => {
  it("reuses each nutrient's baseline from the factor table", () => {
    expect(typicalAbsorption("zinc", 11)!.value).toBe(0.3);
    expect(typicalAbsorption("calcium", 1000)!.value).toBe(0.25);
    expect(typicalAbsorption("protein", 50)!.value).toBe(0.92);
    expect(typicalAbsorption("vitamin_b12", 2.4)!.value).toBe(0.5);
    expect(typicalAbsorption("folate", 400)!.value).toBe(1);
  });

  it("reads copper off its intake curve at the daily amount", () => {
    const copper = typicalAbsorption("copper", 0.9)!.value;
    expect(copper).toBeLessThan(0.75);
    expect(copper).toBeGreaterThan(0.12);
  });
});
