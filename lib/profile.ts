/**
 * The user's profile: mapping from the profiles table, validation of the setup/edit form, and
 * conversion to the inputs targets.ts and the bioavailability engine need.
 *
 * The form takes US units (lb, ft/in); the database stores kg and cm.
 */

import type { EngineProfile } from "@/lib/bioavailability";
import { ValidationError } from "@/lib/logs/validate";
import { MIN_AGE, TIERS, type LifeStage, type Sex, type Tier } from "@/lib/nutrients/registry";
import {
  ACTIVITY_LEVELS,
  TRAINING_TYPES,
  type ActivityLevel,
  type TargetInput,
  type TrainingType,
} from "@/lib/nutrients/targets";
import type { TrainingSession } from "@/lib/nutrients/training";

export const DIET_TYPES = ["omnivore", "pescatarian", "vegetarian", "vegan"] as const;
export type DietType = (typeof DIET_TYPES)[number];

export const GOAL_VIEWS = ["absorption", "consumed"] as const;
/** Whether the absorption score is shown next to each consumed-vs-goal bar. */
export type GoalView = (typeof GOAL_VIEWS)[number];

const SEXES = ["male", "female"] as const;
const LIFE_STAGES = ["none", "pregnant", "lactating"] as const;

export interface Profile {
  age: number | null;
  sex: Sex | null;
  lifeStage: LifeStage;
  gestationWeeks: number | null;
  prepregnancyWeightKg: number | null;
  lactationMonthsPostpartum: number | null;
  dietType: DietType | null;
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPct: number | null;
  activityLevel: ActivityLevel | null;
  trainingHoursPerDay: number;
  trainingType: TrainingType;
  targetTier: Tier;
  goalView: GoalView;
}

export interface CompleteProfile extends Profile {
  age: number;
  sex: Sex;
  dietType: DietType;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
}

/** Columns of public.profiles, as returned by Supabase (numeric columns may come back as strings). */
export interface ProfileRow {
  age: number | null;
  sex: string | null;
  life_stage: string | null;
  gestation_weeks: number | null;
  prepregnancy_weight_kg: number | string | null;
  lactation_months_postpartum: number | null;
  diet_type: string | null;
  weight_kg: number | string | null;
  height_cm: number | string | null;
  body_fat_pct: number | string | null;
  activity_level: string | null;
  training_hours_per_day: number | string | null;
  training_type: string | null;
  target_tier: string | null;
  goal_view: string | null;
}

export const PROFILE_COLUMNS =
  "age, sex, life_stage, gestation_weeks, prepregnancy_weight_kg, lactation_months_postpartum, diet_type, weight_kg, height_cm, body_fat_pct, activity_level, training_hours_per_day, training_type, target_tier, goal_view";

function oneOf<T extends string>(values: readonly T[], value: unknown): T | null {
  return (values as readonly unknown[]).includes(value) ? (value as T) : null;
}

function num(value: number | string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const EMPTY_PROFILE: Profile = {
  age: null,
  sex: null,
  lifeStage: "none",
  gestationWeeks: null,
  prepregnancyWeightKg: null,
  lactationMonthsPostpartum: null,
  dietType: null,
  weightKg: null,
  heightCm: null,
  bodyFatPct: null,
  activityLevel: null,
  trainingHoursPerDay: 0,
  trainingType: "none",
  targetTier: "fda",
  goalView: "absorption",
};

export function profileFromRow(row: ProfileRow | null): Profile {
  if (!row) return EMPTY_PROFILE;
  const sex = oneOf(SEXES, row.sex);
  return {
    age: row.age,
    sex,
    lifeStage: sex === "female" ? (oneOf(LIFE_STAGES, row.life_stage) ?? "none") : "none",
    gestationWeeks: row.gestation_weeks,
    prepregnancyWeightKg: num(row.prepregnancy_weight_kg),
    lactationMonthsPostpartum: row.lactation_months_postpartum,
    dietType: oneOf(DIET_TYPES, row.diet_type),
    weightKg: num(row.weight_kg),
    heightCm: num(row.height_cm),
    bodyFatPct: num(row.body_fat_pct),
    activityLevel: oneOf(ACTIVITY_LEVELS, row.activity_level),
    trainingHoursPerDay: num(row.training_hours_per_day) ?? 0,
    trainingType: oneOf(TRAINING_TYPES, row.training_type) ?? "none",
    targetTier: oneOf(TIERS, row.target_tier) ?? "fda",
    goalView: oneOf(GOAL_VIEWS, row.goal_view) ?? "absorption",
  };
}

/** Everything targets.ts needs is filled in (set on the first-login setup screen). */
export function isProfileComplete(p: Profile): p is CompleteProfile {
  return (
    p.age !== null &&
    p.age >= MIN_AGE &&
    p.sex !== null &&
    p.dietType !== null &&
    p.weightKg !== null &&
    p.heightCm !== null &&
    p.activityLevel !== null
  );
}

export function targetInput(
  p: CompleteProfile,
  trainingToday: readonly TrainingSession[] = [],
): TargetInput {
  return {
    tier: p.targetTier,
    sex: p.sex,
    age: p.age,
    weightKg: p.weightKg,
    heightCm: p.heightCm,
    activityLevel: p.activityLevel,
    trainingHoursPerDay: p.trainingHoursPerDay,
    trainingType: p.trainingType,
    lifeStage: p.lifeStage,
    gestationWeeks: p.gestationWeeks,
    prepregnancyWeightKg: p.prepregnancyWeightKg,
    lactationMonthsPostpartum: p.lactationMonthsPostpartum,
    trainingToday,
  };
}

export function engineProfile(p: Profile): EngineProfile {
  return { age: p.age, sex: p.sex, lifeStage: p.lifeStage };
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function lbToKg(lb: number): number {
  return round1(lb * KG_PER_LB);
}

/** Whole pounds, for showing a stored weight in the form. */
export function kgToLb(kg: number): number {
  return Math.round(kg / KG_PER_LB);
}

export function ftInToCm(ft: number, inches: number): number {
  return round1((ft * 12 + inches) * CM_PER_IN);
}

/** Feet and whole inches, for showing a stored height in the form. */
export function cmToFtIn(cm: number): { ft: number; in: number } {
  const total = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(total / 12), in: total % 12 };
}

// ---------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------

/** Result of submitting the profile form. */
export interface ProfileFormState {
  error: string | null;
  saved: boolean;
}

/** Column values to write to public.profiles. */
export interface ProfileUpdate {
  age: number;
  sex: Sex;
  life_stage: LifeStage;
  gestation_weeks: number | null;
  prepregnancy_weight_kg: number | null;
  lactation_months_postpartum: number | null;
  diet_type: DietType;
  weight_kg: number;
  height_cm: number;
  body_fat_pct: number | null;
  activity_level: ActivityLevel;
  training_hours_per_day: number;
  training_type: TrainingType;
  target_tier: Tier;
}

function text(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
}

function choice<T extends string>(
  raw: Record<string, unknown>,
  key: string,
  values: readonly T[],
  message: string,
): T {
  const v = oneOf(values, text(raw, key));
  if (v === null) throw new ValidationError(message);
  return v;
}

function number(
  raw: Record<string, unknown>,
  key: string,
  {
    min,
    max,
    label,
    integer = false,
  }: { min: number; max: number; label: string; integer?: boolean },
): number {
  const s = text(raw, key);
  const n = Number(s);
  if (s === "" || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new ValidationError(
      `${label} must be ${integer ? "a whole number " : ""}from ${min} to ${max}.`,
    );
  }
  return n;
}

function optionalNumber(
  raw: Record<string, unknown>,
  key: string,
  opts: { min: number; max: number; label: string; integer?: boolean },
): number | null {
  return text(raw, key) === "" ? null : number(raw, key, opts);
}

/**
 * Validates the profile form (field names as in components/ProfileForm.tsx) and converts it to
 * database units.
 */
export function parseProfileForm(raw: Record<string, unknown>): ProfileUpdate {
  const age = number(raw, "age", { min: MIN_AGE, max: 120, label: "Age", integer: true });
  const sex = choice(raw, "sex", SEXES, "Choose a sex for the DRI tables.");
  const lifeStage =
    sex === "female"
      ? choice(raw, "life_stage", LIFE_STAGES, "Choose pregnancy or breastfeeding status.")
      : "none";
  const weightLb = number(raw, "weight_lb", { min: 50, max: 700, label: "Weight (lb)" });
  const ft = number(raw, "height_ft", { min: 3, max: 8, label: "Height (ft)", integer: true });
  const inches = number(raw, "height_in", { min: 0, max: 11.9, label: "Height (in)" });
  const trainingHours = number(raw, "training_hours", {
    min: 0,
    max: 12,
    label: "Training hours per day",
  });
  const prepregnancyLb =
    lifeStage === "pregnant"
      ? optionalNumber(raw, "prepregnancy_weight_lb", {
          min: 50,
          max: 700,
          label: "Pre-pregnancy weight (lb)",
        })
      : null;

  return {
    age,
    sex,
    life_stage: lifeStage,
    gestation_weeks:
      lifeStage === "pregnant"
        ? optionalNumber(raw, "gestation_weeks", {
            min: 1,
            max: 42,
            label: "Weeks pregnant",
            integer: true,
          })
        : null,
    prepregnancy_weight_kg: prepregnancyLb === null ? null : lbToKg(prepregnancyLb),
    lactation_months_postpartum:
      lifeStage === "lactating"
        ? optionalNumber(raw, "lactation_months", {
            min: 0,
            max: 60,
            label: "Months since giving birth",
            integer: true,
          })
        : null,
    diet_type: choice(raw, "diet_type", DIET_TYPES, "Choose a diet type."),
    weight_kg: lbToKg(weightLb),
    height_cm: ftInToCm(ft, inches),
    body_fat_pct: optionalNumber(raw, "body_fat_pct", { min: 3, max: 69, label: "Body fat %" }),
    activity_level: choice(raw, "activity_level", ACTIVITY_LEVELS, "Choose an activity level."),
    training_hours_per_day: Math.round(trainingHours * 100) / 100,
    training_type:
      trainingHours === 0
        ? "none"
        : choice(raw, "training_type", TRAINING_TYPES, "Choose a training type."),
    target_tier: choice(raw, "target_tier", TIERS, "Choose a target tier."),
  };
}
