import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/logs/validate";
import { getDailyTargets } from "@/lib/nutrients/targets";
import {
  EMPTY_PROFILE,
  cmToFtIn,
  ftInToCm,
  isProfileComplete,
  kgToLb,
  lbToKg,
  parseProfileForm,
  profileFromRow,
  targetInput,
  type CompleteProfile,
  type ProfileRow,
} from "./profile";

const form = {
  age: "30",
  sex: "male",
  diet_type: "omnivore",
  weight_lb: "176",
  height_ft: "5",
  height_in: "10",
  activity_level: "active",
  training_hours: "1.5",
  training_type: "endurance",
  target_tier: "average",
};

describe("units", () => {
  it("converts lb and ft/in to kg and cm", () => {
    expect(lbToKg(176)).toBe(79.8);
    expect(ftInToCm(5, 10)).toBe(177.8);
  });

  it("round-trips for display", () => {
    expect(kgToLb(lbToKg(150))).toBe(150);
    expect(cmToFtIn(ftInToCm(5, 10))).toEqual({ ft: 5, in: 10 });
    expect(cmToFtIn(ftInToCm(5, 11.9))).toEqual({ ft: 6, in: 0 });
  });
});

describe("parseProfileForm", () => {
  it("stores kg and cm", () => {
    expect(parseProfileForm(form)).toMatchObject({
      age: 30,
      sex: "male",
      life_stage: "none",
      weight_kg: 79.8,
      height_cm: 177.8,
      activity_level: "active",
      training_hours_per_day: 1.5,
      training_type: "endurance",
      target_tier: "average",
      body_fat_pct: null,
    });
  });

  it("rejects users under 14", () => {
    expect(() => parseProfileForm({ ...form, age: "13" })).toThrow(ValidationError);
  });

  it("requires every core field", () => {
    for (const key of Object.keys(form)) {
      if (key === "training_type") continue;
      expect(() => parseProfileForm({ ...form, [key]: "" }), key).toThrow(ValidationError);
    }
  });

  it("sets training type to none when there is no training", () => {
    expect(
      parseProfileForm({ ...form, training_hours: "0", training_type: "" }).training_type,
    ).toBe("none");
  });

  it("keeps pregnancy details only for pregnant women", () => {
    const pregnant = parseProfileForm({
      ...form,
      sex: "female",
      life_stage: "pregnant",
      gestation_weeks: "24",
      prepregnancy_weight_lb: "140",
      lactation_months: "3",
    });
    expect(pregnant).toMatchObject({
      life_stage: "pregnant",
      gestation_weeks: 24,
      prepregnancy_weight_kg: 63.5,
      lactation_months_postpartum: null,
    });
    // Men are never pregnant, whatever the form says.
    expect(
      parseProfileForm({ ...form, life_stage: "pregnant", gestation_weeks: "24" }),
    ).toMatchObject({ life_stage: "none", gestation_weeks: null });
  });
});

describe("profileFromRow / isProfileComplete", () => {
  it("treats the empty sign-up row as incomplete", () => {
    expect(isProfileComplete(EMPTY_PROFILE)).toBe(false);
    expect(isProfileComplete(profileFromRow(null))).toBe(false);
  });

  it("reads numeric columns returned as strings", () => {
    const row: ProfileRow = {
      age: 30,
      sex: "male",
      life_stage: "none",
      gestation_weeks: null,
      prepregnancy_weight_kg: null,
      lactation_months_postpartum: null,
      diet_type: "vegan",
      weight_kg: "79.8",
      height_cm: "177.8",
      body_fat_pct: null,
      activity_level: "active",
      training_hours_per_day: "1.50",
      training_type: "endurance",
      target_tier: "athletic",
      goal_view: "consumed",
    };
    const profile = profileFromRow(row);
    expect(isProfileComplete(profile)).toBe(true);
    expect(profile).toMatchObject({
      weightKg: 79.8,
      trainingHoursPerDay: 1.5,
      goalView: "consumed",
    });
  });
});

describe("targetInput", () => {
  const profile: CompleteProfile = {
    ...EMPTY_PROFILE,
    age: 30,
    sex: "male",
    dietType: "omnivore",
    weightKg: 80,
    heightCm: 180,
    activityLevel: "active",
    trainingHoursPerDay: 2,
    trainingType: "strength",
    targetTier: "average",
  };

  it("switching to Athletic raises protein and carbs from weight and training hours", () => {
    const average = getDailyTargets(targetInput(profile));
    const athletic = getDailyTargets(targetInput({ ...profile, targetTier: "athletic" }));
    // Strength 1.6 g/kg + 0.2 g/kg for 2 h/day = 1.8 g/kg × 80 kg.
    expect(athletic.protein.value).toBe(144);
    expect(athletic.protein.value!).toBeGreaterThan(average.protein.value!);
    // 2 h/day is the "high" band, 6–10 g/kg. The 640 g midpoint would leave fat under 20% of the
    // 3496 kcal target, so carbs are trimmed to (3496 − 144 × 4 − 20% × 3496) / 4 = 555 g.
    expect(athletic.carbohydrate.value).toBe(555);
    expect(athletic.carbohydrate.value!).toBeGreaterThan(average.carbohydrate.value!);
  });

  it("scales Athletic targets with body weight", () => {
    const light = getDailyTargets(
      targetInput({ ...profile, targetTier: "athletic", weightKg: 60 }),
    );
    expect(light.protein.value).toBe(108);
    expect(light.carbohydrate.value).toBe(480);
  });
});
