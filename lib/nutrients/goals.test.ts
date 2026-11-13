import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/logs/validate";
import {
  applyCustomGoals,
  goalLabel,
  goalProgress,
  goalRange,
  goalSource,
  parseCustomGoal,
  parseNutrientId,
} from "./goals";
import { getDailyTargets, type TargetInput } from "./targets";

const woman: TargetInput = {
  tier: "average",
  sex: "female",
  age: 30,
  weightKg: 60,
  heightCm: 165,
  activityLevel: "low_active",
  trainingHoursPerDay: 0,
};
const targets = getDailyTargets(woman);

describe("applyCustomGoals", () => {
  it("keeps recommended goals when there are no overrides", () => {
    const goals = applyCustomGoals(targets, {});
    expect(goals.iron).toMatchObject({ value: 18, recommended: 18, custom: false });
  });

  it("replaces the value and range with an override, remembering the recommendation", () => {
    const goals = applyCustomGoals(targets, { iron: 27, protein: 120 });
    expect(goals.iron).toMatchObject({ value: 27, recommended: 18, custom: true });
    expect(goals.protein.custom).toBe(true);
    expect(goals.protein.min).toBeUndefined();
    expect(goals.protein.max).toBeUndefined();
    expect(goals.calcium.custom).toBe(false);
  });
});

describe("goalSource", () => {
  it("names the basis and the registry citation", () => {
    const goals = applyCustomGoals(targets, {});
    const source = goalSource(goals.iron);
    expect(source).toContain("RDA");
    expect(source).toContain("NASEM");
  });

  it("says when a goal is custom", () => {
    expect(goalSource(applyCustomGoals(targets, { iron: 27 }).iron)).toMatch(/custom/i);
  });
});

describe("goalLabel / goalRange", () => {
  const goals = applyCustomGoals(getDailyTargets({ ...woman, tier: "fda" }), {});

  it("labels limits and per-meal limits", () => {
    expect(goalLabel(goals.iron)).toBe("18 mg");
    expect(goalLabel(goals.sodium)).toBe("max 2,300 mg");
    expect(goalLabel(applyCustomGoals(targets, {}).added_sugars)).toBe("max 10 g per meal");
  });

  it("shows a range only when one exists", () => {
    expect(goalRange(applyCustomGoals(targets, {}).carbohydrate)).toMatch(/^range \d+–\d+ g$/);
    expect(goalRange(goals.iron)).toBeNull();
  });
});

describe("goalProgress", () => {
  const goals = applyCustomGoals(targets, {});

  it("compares consumed intake with a target", () => {
    expect(goalProgress(goals.iron, 9)).toEqual({ ratio: 0.5, status: "under", overUl: false });
    expect(goalProgress(goals.iron, 18).status).toBe("met");
  });

  it("flags limits that are exceeded", () => {
    expect(goalProgress(goals.sodium, 3000).status).toBe("over-limit");
    expect(goalProgress(goals.sodium, 1000).status).toBe("under-limit");
  });

  it("warns above a total-intake UL", () => {
    expect(goalProgress(goals.iron, 50).overUl).toBe(true);
    // Magnesium's UL applies to supplements only, so food intake never triggers it.
    expect(goalProgress(goals.magnesium, 2000).overUl).toBe(false);
  });

  it("has no ratio without data", () => {
    expect(goalProgress(goals.iron, null)).toEqual({ ratio: null, status: "none", overUl: false });
  });
});

describe("parsing", () => {
  it("accepts registry ids only", () => {
    expect(parseNutrientId("iron")).toBe("iron");
    expect(() => parseNutrientId("unobtainium")).toThrow(ValidationError);
  });

  it("accepts positive goals or null", () => {
    expect(parseCustomGoal(27)).toBe(27);
    expect(parseCustomGoal(null)).toBeNull();
    for (const bad of [0, -1, Number.NaN, "5", 1e9]) {
      expect(() => parseCustomGoal(bad)).toThrow(ValidationError);
    }
  });
});
