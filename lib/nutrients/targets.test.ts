import { describe, expect, it } from "vitest";
import { NUTRIENT_IDS, NUTRIENTS, TIERS } from "./registry";
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

    it("scales carbs by training hours (g/kg bands), trimming them so fat can reach 20%", () => {
      // High band 6–10 g/kg: the 640 g midpoint leaves only 12% of energy for fat, so carbs drop
      // to (3496 − 128 × 4 − 20% × 3496) / 4 = 571 g, still inside the band.
      expect(t.carbohydrate).toMatchObject({ value: 571, min: 480, max: 800 });
      expect(t.carbohydrate.notes.join(" ")).toMatch(/Lowered from 640 g/);
    });

    describe("fat = energy left after protein and carbs", () => {
      const kcal = (x: ReturnType<typeof getDailyTargets>) =>
        x.protein.value! * 4 + x.carbohydrate.value! * 4 + x.fat.value! * 9;

      it("fills the energy target at 20% of energy or more", () => {
        expect(t.fat.value).toBe(78); // (3496 − 128 × 4 − 571 × 4) / 9
        expect(Math.abs(kcal(t) - t.energy.value!)).toBeLessThanOrEqual(5);
        expect(t.fat.notes.join(" ")).not.toMatch(/run above/);
      });

      it.each([
        ["rest day", { trainingHoursPerDay: 0, trainingType: "none" as const }],
        ["light training", { trainingHoursPerDay: 0.5 }],
        ["moderate training", { trainingHoursPerDay: 1 }],
        ["3 h/day", { trainingHoursPerDay: 3 }],
        ["woman", { sex: "female" as const, weightKg: 60, heightCm: 165 }],
        ["teen", { age: 16, weightKg: 60, heightCm: 170 }],
      ])("protein + carbs + fat = energy target: %s", (_, change) => {
        const x = getDailyTargets({ ...athlete, ...change });
        expect(Math.abs(kcal(x) - x.energy.value!)).toBeLessThanOrEqual(5);
        expect(x.fat.value! * 9).toBeGreaterThanOrEqual(0.2 * x.energy.value! - 5);
        expect(x.fat.notes.join(" ")).not.toMatch(/run above/);
      });

      it("is not floored at the Average tier's fat", () => {
        const average = getDailyTargets({ ...athlete, tier: "average" });
        expect(t.fat.value!).toBeLessThan(average.fat.value!); // 78 g vs 90 g
      });

      it("runs over the energy target only when the bottom of the carb band cannot fit", () => {
        const x = getDailyTargets({ ...athlete, trainingHoursPerDay: 5 });
        expect(x.carbohydrate.value).toBe(640); // 8 g/kg, the very-high band minimum
        expect(x.fat.value).toBe(78); // 20% of energy
        expect(kcal(x)).toBeGreaterThan(x.energy.value!);
        expect(x.fat.notes.join(" ")).toMatch(/run above the energy target/);
      });
    });

    describe("never below the Average tier for macro targets other than fat", () => {
      const profiles: TargetInput[] = [
        athlete,
        { ...athlete, trainingHoursPerDay: 0, trainingType: "none" },
        { ...athlete, trainingHoursPerDay: 0.5, activityLevel: "very_active" },
        { ...athlete, trainingHoursPerDay: 1, trainingType: "strength" },
        { ...woman, tier: "athletic", trainingHoursPerDay: 0.25, trainingType: "mixed" },
        { ...woman, tier: "athletic", age: 16, weightKg: 45, heightCm: 155 },
        {
          ...woman,
          tier: "athletic",
          lifeStage: "pregnant",
          gestationWeeks: 30,
          trainingHoursPerDay: 0.5,
        },
        { ...woman, tier: "athletic", lifeStage: "lactating", trainingHoursPerDay: 1 },
      ];

      it.each(profiles.map((p, i) => [i, p] as const))("profile %i", (_, profile) => {
        const athletic = getDailyTargets(profile);
        const average = getDailyTargets({ ...profile, tier: "average" });
        for (const id of NUTRIENT_IDS) {
          const a = athletic[id];
          const avg = average[id].value;
          if (NUTRIENTS[id].category !== "macro" || a.kind !== "target" || id === "fat") continue;
          if (avg === null || a.value === null) continue;
          expect(a.value, id).toBeGreaterThanOrEqual(avg);
          if (a.max !== undefined) expect(a.max, id).toBeGreaterThanOrEqual(a.value!);
        }
      });

      it("uses Average carbs when light training gives fewer (3–5 g/kg band)", () => {
        const light = { ...athlete, trainingHoursPerDay: 0.5, activityLevel: "active" as const };
        const average = getDailyTargets({ ...light, tier: "average" });
        const athletic = getDailyTargets(light);
        // Band midpoint 4 g/kg × 80 kg = 320 g; Average is 55% of the EER / 4.
        expect(average.carbohydrate.value!).toBeGreaterThan(320);
        expect(athletic.carbohydrate.value).toBe(average.carbohydrate.value);
        expect(athletic.carbohydrate.notes.join(" ")).toMatch(/Raised from 320/);
      });

      it("leaves limits alone", () => {
        const light = { ...athlete, trainingHoursPerDay: 0, trainingType: "none" as const };
        expect(getDailyTargets(light).sodium.value).toBe(2300);
        expect(getDailyTargets(light).added_sugars.value).toBe(10);
      });
    });

    describe("sweat losses on training days", () => {
      const measured = getDailyTargets({
        ...athlete,
        trainingToday: [{ minutes: 90, intensity: "high", sweatLossKg: 1.2 }],
      });

      it("makes no adjustment on rest days", () => {
        expect(t.water.value).toBe(3700);
        expect(t.sodium.value).toBe(2300);
        expect(t.potassium.value).toBe(3400);
        expect(t.chloride.value).toBe(2300);
        expect(t.water.notes).toEqual([]);
      });

      it("adds measured sweat loss to water, sodium and potassium", () => {
        expect(measured.water.value).toBe(3700 + 1800); // 1.5 L per kg
        expect(measured.sodium).toMatchObject({ kind: "limit", value: 2300 + 1104 }); // 920 mg/L
        expect(measured.potassium.value).toBe(3400 + 235); // 196 mg/L
        expect(measured.water.notes.join(" ")).not.toMatch(/estimated at ~1 L/);
      });

      it("adds sweat chloride, capped at the 3600 mg UL", () => {
        expect(measured.chloride.value).toBe(3600); // 2300 + 1489 would exceed the UL
        expect(measured.chloride.notes.join(" ")).toMatch(/Capped at the 3600 mg upper limit/);
        const light = getDailyTargets({
          ...athlete,
          trainingToday: [{ minutes: 30, intensity: "moderate", sweatLossKg: 0.5 }],
        });
        expect(light.chloride.value).toBe(2921); // 2300 + 0.5 × 1241
      });

      it("estimates ~1 L of sweat per hour when sweat loss was not measured", () => {
        const estimated = getDailyTargets({
          ...athlete,
          trainingToday: [{ minutes: 90, intensity: "high" }],
        });
        expect(estimated.water.value).toBe(3700 + 2250);
        expect(estimated.sodium.value).toBe(2300 + 1380);
        expect(estimated.sodium.notes.join(" ")).toMatch(/estimated at ~1 L per training hour/);
      });

      it("does not adjust the Average tier", () => {
        const avg = getDailyTargets({
          ...man,
          trainingToday: [{ minutes: 90, intensity: "high", sweatLossKg: 1.2 }],
        });
        expect(avg.water.value).toBe(3700);
        expect(avg.sodium.value).toBe(2300);
      });
    });

    describe("iron", () => {
      const woman30: TargetInput = {
        ...athlete,
        sex: "female",
        age: 30,
        weightKg: 60,
        heightCm: 165,
      };

      it("adds 30% for men", () => {
        expect(t.iron).toMatchObject({ value: 10.4, min: 8, max: 10.4 });
      });

      it("adds 30% for women by default, allowing up to 70%", () => {
        const w = getDailyTargets({ ...woman30, trainingType: "strength" });
        expect(w.iron).toMatchObject({ value: 23.4, min: 18, max: 30.6 });
      });

      it("adds 70% for female endurance athletes", () => {
        expect(getDailyTargets(woman30).iron).toMatchObject({ value: 30.6, min: 18, max: 30.6 });
        expect(getDailyTargets({ ...woman30, age: 16 }).iron.value).toBe(25.5); // 15 × 1.7
      });

      it("stays under the 45 mg UL and suggests a ferritin test", () => {
        const w = getDailyTargets(woman30);
        expect(w.iron.value!).toBeLessThanOrEqual(45);
        expect(w.iron.ul).toBe(45);
        expect(w.iron.notes.join(" ")).toMatch(/not an official recommendation/);
        expect(w.iron.notes.join(" ")).toMatch(/ferritin/);
      });

      it("keeps the DRI in pregnancy and lactation", () => {
        const p = getDailyTargets({ ...woman30, lifeStage: "pregnant", gestationWeeks: 20 });
        expect(p.iron.value).toBe(27);
        expect(p.iron.notes.join(" ")).toMatch(/clinician/);
        const l = getDailyTargets({ ...woman30, lifeStage: "lactating" });
        expect(l.iron.value).toBe(9);
      });
    });

    it("keeps vitamin D at the RDA with a get-tested note", () => {
      expect(t.vitamin_d.value).toBe(15);
      expect(t.vitamin_d.notes.join(" ")).toMatch(/25\(OH\)D of 30 ng\/mL/);
      expect(t.vitamin_d.notes.join(" ")).toMatch(/getting tested/);
    });

    it("uses the Average DRI for other micronutrients", () => {
      expect(t.zinc.value).toBe(getDailyTargets(man).zinc.value);
      expect(t.calcium.value).toBe(getDailyTargets(man).calcium.value);
      expect(t.zinc.notes[0]).toMatch(/Average DRI/);
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
