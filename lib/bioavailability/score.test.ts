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
  it("is 1 when absorption matches a typical diet that meets the goal", () => {
    // Iron: typical mixed diet absorbs 16%; 18 mg goal -> 2.88 mg expected absorbed.
    const s = absorptionScore("iron", est(18, 2.88), 18)!;
    expect(s.expectedAbsorbed).toBeCloseTo(2.88);
    expect(s.score).toBeCloseTo(1);
    expect(s.progress).toBeCloseTo(1);
    expect(s.pairing).toBeCloseTo(1);
    expect(s.scoreLow).toBeCloseTo(0.8);
    expect(s.scoreHigh).toBeCloseTo(1.2);
  });

  it("separates progress (consumed vs goal) from pairing quality", () => {
    // Half the goal eaten, but absorbed twice as well as a typical diet.
    const s = absorptionScore("iron", est(9, 2.88), 18)!;
    expect(s.progress).toBeCloseTo(0.5);
    expect(s.score).toBeCloseTo(1);
    expect(s.pairing).toBeCloseTo(2);
  });

  it("rises when orange juice is paired with lentils", () => {
    const score = (foods: Parameters<typeof absorbMeal>[0]) =>
      absorptionScore("iron", absorbMeal(foods).totals.iron, 18)!;
    const alone = score([lentils()]);
    const withOj = score([lentils(), orangeJuice()]);
    expect(withOj.score).toBeGreaterThan(alone.score);
    expect(withOj.pairing!).toBeGreaterThan(alone.pairing!);
    // Lentils alone fall short of a typical mixed diet; with juice they come closer or beat it.
    expect(alone.pairing!).toBeLessThan(1);
  });

  it("equals progress for vitamin A (RAE) when the meal has fat", () => {
    const totals = absorbMeal([carrots(), oliveOil()]).totals.vitamin_a;
    const s = absorptionScore("vitamin_a", totals, 900)!;
    expect(s.score).toBeCloseTo(s.progress);
    expect(s.pairing).toBeCloseTo(1);
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

  it("has no pairing value when nothing was eaten", () => {
    expect(absorptionScore("zinc", est(0, 0), 11)!.pairing).toBeNull();
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

  it("reads copper off its intake curve at the goal amount", () => {
    const copper = typicalAbsorption("copper", 0.9)!.value;
    expect(copper).toBeLessThan(0.75);
    expect(copper).toBeGreaterThan(0.12);
  });
});
