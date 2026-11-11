import { describe, expect, it } from "vitest";
import { NUTRIENT_IDS, TIERS } from "./registry";
import {
  activityFromTraining,
  athleticCarbBand,
  estimatedEnergyRequirement,
  getDailyTargets,
  type TargetInput,
} from "./targets";

const man: TargetInput = {
  tier: "average",
  sex: "male",
  age: 30,
  weightKg: 80,
  heightCm: 180,
  activityLevel: "active",
  trainingHoursPerDay: 0,
};

const woman: TargetInput = {
  tier: "average",
  sex: "female",
  age: 40,
  weightKg: 60,
  heightCm: 165,
  activityLevel: "inactive",
  trainingHoursPerDay: 0,
};

describe("estimatedEnergyRequirement (2023 NASEM)", () => {
  it("adult man, active", () => {
    // 1004.82 − 10.83·30 + 6.52·180 + 15.91·80 = 3126.32
    expect(estimatedEnergyRequirement(man, "active").kcal).toBeCloseTo(3126.32, 2);
  });

  it("adult woman, inactive", () => {
    // 584.90 − 7.01·40 + 5.72·165 + 11.71·60 = 1950.9
    expect(estimatedEnergyRequirement(woman, "inactive").kcal).toBeCloseTo(1950.9, 2);
  });

  it("teen boy uses the youth equation plus 20 kcal growth", () => {
    const teen: TargetInput = { ...man, age: 16, heightCm: 175, weightKg: 65 };
    // 19.12 + 3.68·16 + 8.62·175 + 20.28·65 + 20 = 2924.7
    expect(estimatedEnergyRequirement(teen, "low_active").kcal).toBeCloseTo(2924.7, 2);
  });

  it("pregnancy, 2nd trimester, normal pre-pregnancy BMI", () => {
    const p: TargetInput = {
      ...woman,
      age: 30,
      weightKg: 70,
      lifeStage: "pregnant",
      gestationWeeks: 24,
      prepregnancyWeightKg: 60,
    };
    // 1131.20 − 2.04·30 + 0.34·165 + 12.15·70 + 9.16·24 + 200 = 2396.44
    expect(estimatedEnergyRequirement(p, "inactive").kcal).toBeCloseTo(2396.44, 2);
  });

  it("pregnancy, 1st trimester uses the non-pregnant equation", () => {
    const p: TargetInput = {
      ...woman,
      age: 30,
      weightKg: 70,
      lifeStage: "pregnant",
      gestationWeeks: 10,
    };
    // 584.90 − 7.01·30 + 5.72·165 + 11.71·70 = 2138.1
    expect(estimatedEnergyRequirement(p, "inactive").kcal).toBeCloseTo(2138.1, 2);
  });

  it("pregnancy deposition follows pre-pregnancy BMI", () => {
    const base: TargetInput = { ...woman, lifeStage: "pregnant", gestationWeeks: 30 };
    const kcal = (w: number) =>
      estimatedEnergyRequirement({ ...base, prepregnancyWeightKg: w }, "inactive").kcal;
    // height 1.65 m: 48 kg → BMI 17.6, 60 → 22.0, 72 → 26.4, 90 → 33.1
    expect(kcal(48) - kcal(60)).toBeCloseTo(100, 6);
    expect(kcal(60) - kcal(72)).toBeCloseTo(50, 6);
    expect(kcal(72) - kcal(90)).toBeCloseTo(200, 6);
  });

  it("lactation adds 400 kcal (0–6 mo) or 380 kcal (7–12 mo)", () => {
    const base = estimatedEnergyRequirement(woman, "inactive").kcal;
    const l = (m: number) =>
      estimatedEnergyRequirement(
        { ...woman, lifeStage: "lactating", lactationMonthsPostpartum: m },
        "inactive",
      ).kcal;
    expect(l(3) - base).toBeCloseTo(400, 6);
    expect(l(9) - base).toBeCloseTo(380, 6);
    expect(l(18) - base).toBeCloseTo(0, 6);
  });

  it("ignores life stage for males", () => {
    expect(
      estimatedEnergyRequirement({ ...man, lifeStage: "pregnant", gestationWeeks: 30 }, "active")
        .kcal,
    ).toBe(estimatedEnergyRequirement(man, "active").kcal);
  });
});

describe("getDailyTargets", () => {
  it.each(TIERS)("returns every nutrient for the %s tier", (tier) => {
    const t = getDailyTargets({ ...man, tier });
    expect(Object.keys(t).sort()).toEqual([...NUTRIENT_IDS].sort());
  });

  it("rejects invalid input", () => {
    expect(() => getDailyTargets({ ...man, age: 12 })).toThrow(RangeError);
    expect(() => getDailyTargets({ ...man, weightKg: 0 })).toThrow(RangeError);
    expect(() => getDailyTargets({ ...man, heightCm: -1 })).toThrow(RangeError);
    expect(() => getDailyTargets({ ...man, trainingHoursPerDay: -1 })).toThrow(RangeError);
  });

  describe("FDA tier", () => {
    const t = getDailyTargets({ ...woman, tier: "fda" });

    it("uses one Daily Value for everyone", () => {
      expect(t.energy.value).toBe(2000);
      expect(t.protein.value).toBe(50);
      expect(t.iron.value).toBe(18);
      expect(getDailyTargets({ ...man, tier: "fda" }).iron.value).toBe(18);
    });

    it("labels sodium, saturated fat, added sugars and cholesterol as limits", () => {
      expect(t.sodium).toMatchObject({ kind: "limit", value: 2300 });
      expect(t.saturated_fat).toMatchObject({ kind: "limit", value: 20 });
      expect(t.added_sugars).toMatchObject({ kind: "limit", value: 50, per: "day" });
      expect(t.cholesterol).toMatchObject({ kind: "limit", value: 300 });
    });

    it("falls back to the NASEM AI where FDA sets no Daily Value", () => {
      expect(t.ala.value).toBe(1.1);
      expect(t.water.value).toBe(2700);
      expect(t.ala.notes[0]).toMatch(/no Daily Value/);
    });
  });

  describe("Average tier", () => {
    const t = getDailyTargets(man);

    it("uses the EER for energy", () => {
      expect(t.energy.value).toBe(3126);
    });

    it("uses 0.8 g/kg protein for adults and 0.85 for teens", () => {
      expect(t.protein.value).toBe(64);
      expect(getDailyTargets({ ...man, age: 16 }).protein.value).toBe(Math.round(0.85 * 80));
    });

    it("uses AMDR ranges for carbs and fat", () => {
      expect(t.carbohydrate).toMatchObject({ value: 430, min: 352, max: 508 });
      expect(t.fat).toMatchObject({ value: 96, min: 69, max: 122 });
    });

    it("limits saturated fat to 10% of energy per day (DGA 2025–2030)", () => {
      expect(t.saturated_fat).toMatchObject({ kind: "limit", value: 35, per: "day" });
    });

    it("limits added sugars to 10 g per meal (DGA 2025–2030)", () => {
      expect(t.added_sugars).toMatchObject({ kind: "limit", value: 10, per: "meal" });
      expect(getDailyTargets({ ...man, tier: "athletic" }).added_sugars).toMatchObject({
        value: 10,
        per: "meal",
      });
    });

    it("uses DRIs by sex, age and life stage", () => {
      expect(getDailyTargets({ ...woman, age: 30 }).iron.value).toBe(18);
      expect(getDailyTargets(woman).calcium.value).toBe(1000);
      expect(getDailyTargets({ ...woman, age: 55 }).calcium.value).toBe(1200);
      expect(
        getDailyTargets({ ...woman, lifeStage: "pregnant", gestationWeeks: 25 }).iron.value,
      ).toBe(27);
    });

    it("returns null for nutrients with no published target", () => {
      expect(t.trans_fat.value).toBeNull();
      expect(t.cholesterol.value).toBeNull();
      expect(t.cholesterol.basis).toMatch(/as low as possible/);
    });

    it("returns the UL and its scope", () => {
      expect(t.vitamin_a).toMatchObject({ ul: 3000, ulScope: "form" });
      expect(t.iron).toMatchObject({ ul: 45, ulScope: "total" });
      expect(t.magnesium).toMatchObject({ ul: 350, ulScope: "supplemental" });
      expect(t.vitamin_k.ul).toBeNull();
    });

    it("raises protein and carb floors in pregnancy and lactation", () => {
      const p = getDailyTargets({ ...woman, lifeStage: "pregnant", gestationWeeks: 25 });
      expect(p.protein.value).toBe(Math.round(1.1 * 60));
      const early = getDailyTargets({ ...woman, lifeStage: "pregnant", gestationWeeks: 12 });
      expect(early.protein.value).toBe(Math.round(0.8 * 60));
      const l = getDailyTargets({ ...woman, lifeStage: "lactating", lactationMonthsPostpartum: 2 });
      expect(l.protein.value).toBe(Math.round(1.3 * 60));
      expect(l.carbohydrate.min).toBeGreaterThanOrEqual(210);
    });
  });

  describe("Athletic tier", () => {
    const athlete: TargetInput = {
      ...man,
      tier: "athletic",
      activityLevel: "low_active",
      trainingHoursPerDay: 2.5,
      trainingType: "endurance",
    };
    const t = getDailyTargets(athlete);

    it("raises the activity category from training hours", () => {
      // very active: −517.88 − 10.83·30 + 15.61·180 + 19.11·80 = 3495.82
      expect(t.energy.value).toBe(3496);
    });

    it("scales protein by training type and load", () => {
      expect(t.protein.value).toBe(128); // (1.4 + 0.2) g/kg × 80
      expect(t.protein).toMatchObject({ min: 96, max: 160 });
      const strength = getDailyTargets({
        ...athlete,
        trainingType: "strength",
        trainingHoursPerDay: 1,
      });
      expect(strength.protein.value).toBe(128); // 1.6 g/kg
      const none = getDailyTargets({ ...athlete, trainingType: "none", trainingHoursPerDay: 0.25 });
      expect(none.protein.value).toBe(96); // 1.2 g/kg
    });

    it("scales carbs by training hours (g/kg bands)", () => {
      expect(t.carbohydrate).toMatchObject({ value: 640, min: 480, max: 800 });
    });

    it("keeps fat at or above 20% of energy and says when it had to", () => {
      expect(t.fat.value).toBe(78); // 20% of 3495.82 / 9
      expect(t.fat.notes.join(" ")).toMatch(/20% minimum/);
    });

    it("adds sweat losses to water and sodium", () => {
      const sweaty = getDailyTargets({ ...athlete, sweatLossKg: 1.2 });
      expect(sweaty.water.value).toBe(3700 + 1800);
      expect(sweaty.sodium).toMatchObject({ kind: "limit", value: 2300 + 1104 });
      expect(t.water.value).toBe(3700);
    });

    it("uses the Average DRI for micronutrients", () => {
      expect(t.iron.value).toBe(getDailyTargets(man).iron.value);
      expect(t.iron.notes[0]).toMatch(/Average DRI/);
    });
  });
});

describe("athletic helpers", () => {
  it.each([
    [0, "inactive"],
    [0.5, "low_active"],
    [1, "active"],
    [2, "very_active"],
    [5, "very_active"],
  ] as const)("%s h/day -> %s", (h, level) => {
    expect(activityFromTraining(h)).toBe(level);
  });

  it.each([
    [0.5, "light"],
    [1, "moderate"],
    [2, "high"],
    [5, "very high"],
  ] as const)("%s h/day -> %s carb band", (h, band) => {
    expect(athleticCarbBand(h).label).toBe(band);
  });
});
