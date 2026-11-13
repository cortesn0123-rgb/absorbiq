/**
 * Daily targets — a pure function from a user's profile to their daily nutrient targets.
 *
 * Reference values come from lib/nutrients/registry.ts. This module only holds the rules
 * that depend on the user's body and energy needs (EER, g/kg rules, % of energy).
 */

import {
  NUTRIENT_IDS,
  NUTRIENTS,
  ageBand,
  lookupDri,
  type ComputedRule,
  type LifeStage,
  type NutrientId,
  type NutrientKind,
  type Period,
  type Sex,
  type Tier,
  type Unit,
  type UpperLimit,
} from "./registry";
import { SWEAT_ELECTROLYTES_MG_PER_L, estimateSweatLoss, type TrainingSession } from "./training";

export const ACTIVITY_LEVELS = ["inactive", "low_active", "active", "very_active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const TRAINING_TYPES = ["none", "endurance", "strength", "team_sport", "mixed"] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

export interface TargetInput {
  tier: Tier;
  sex: Sex;
  /** Years; must be 14 or older. */
  age: number;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  trainingHoursPerDay: number;
  trainingType?: TrainingType;
  lifeStage?: LifeStage;
  /** Pregnancy only: weeks of gestation. */
  gestationWeeks?: number | null;
  /** Pregnancy only: used to classify pre-pregnancy BMI for the energy deposition term. */
  prepregnancyWeightKg?: number | null;
  /** Lactation only: months since giving birth. */
  lactationMonthsPostpartum?: number | null;
  /** Athletic tier: today's training sessions, used to add sweat losses on training days. */
  trainingToday?: readonly TrainingSession[];
}

export interface DailyTarget {
  nutrientId: NutrientId;
  unit: Unit;
  kind: NutrientKind;
  /** Target or limit for one `per` period; null when no authority sets a number for this tier. */
  value: number | null;
  /** "meal" limits are checked against each meal's total (see meal-limits.ts), not the day's. */
  per: Period;
  min?: number;
  max?: number;
  /** Tolerable upper intake level for this life stage, or null. */
  ul: number | null;
  ulScope: UpperLimit["scope"] | null;
  basis: string;
  notes: string[];
}

export type DailyTargets = Record<NutrientId, DailyTarget>;

// ---------------------------------------------------------------------------
// Energy: 2023 NASEM Dietary Reference Intakes for Energy, Summary Table S-1.
// Coefficients are [intercept, age (y), height (cm), weight (kg)].
// ---------------------------------------------------------------------------

type Coefficients = readonly [number, number, number, number];

const ADULT_TEE: Record<Sex, Record<ActivityLevel, Coefficients>> = {
  male: {
    inactive: [753.07, -10.83, 6.5, 14.1],
    low_active: [581.47, -10.83, 8.3, 14.94],
    active: [1004.82, -10.83, 6.52, 15.91],
    very_active: [-517.88, -10.83, 15.61, 19.11],
  },
  female: {
    inactive: [584.9, -7.01, 5.72, 11.71],
    low_active: [575.77, -7.01, 6.6, 12.14],
    active: [710.25, -7.01, 6.54, 12.34],
    very_active: [511.83, -7.01, 9.07, 12.56],
  },
};

/** Boys and girls 3–18 years. */
const YOUTH_TEE: Record<Sex, Record<ActivityLevel, Coefficients>> = {
  male: {
    inactive: [-447.51, 3.68, 13.01, 13.15],
    low_active: [19.12, 3.68, 8.62, 20.28],
    active: [-388.19, 3.68, 12.66, 20.46],
    very_active: [-671.75, 3.68, 15.38, 23.25],
  },
  female: {
    inactive: [55.59, -22.25, 8.43, 17.07],
    low_active: [-297.54, -22.25, 12.77, 14.73],
    active: [-189.55, -22.25, 11.74, 18.34],
    very_active: [-709.59, -22.25, 18.22, 14.25],
  },
};

/** Energy cost of growth for ages 14–18 (kcal/day). */
const YOUTH_GROWTH_KCAL = 20;

/** Pregnancy, 2nd and 3rd trimesters; plus 9.16 kcal per week of gestation. */
const PREGNANCY_TEE: Record<ActivityLevel, Coefficients> = {
  inactive: [1131.2, -2.04, 0.34, 12.15],
  low_active: [693.35, -2.04, 5.73, 10.2],
  active: [-223.84, -2.04, 13.23, 8.15],
  very_active: [-779.72, -2.04, 18.45, 8.73],
};
const PREGNANCY_GESTATION_COEF = 9.16;
/** First trimester ends after week 13; it uses the non-pregnant equation. */
const FIRST_TRIMESTER_LAST_WEEK = 13;

/** Pregnancy energy deposition by pre-pregnancy BMI category (kcal/day). */
function pregnancyDeposition(bmi: number): number {
  if (bmi < 18.5) return 300;
  if (bmi < 25) return 200;
  if (bmi < 30) return 150;
  return -50;
}

/** Lactation: 0–6 months = +540 milk production − 140 mobilization; 7–12 months = +380. */
const LACTATION_KCAL_0_6 = 400;
const LACTATION_KCAL_7_12 = 380;

function applyEquation(c: Coefficients, age: number, heightCm: number, weightKg: number): number {
  return c[0] + c[1] * age + c[2] * heightCm + c[3] * weightKg;
}

function nonPregnantEer(
  sex: Sex,
  age: number,
  heightCm: number,
  weightKg: number,
  pa: ActivityLevel,
) {
  if (age < 19) {
    return applyEquation(YOUTH_TEE[sex][pa], age, heightCm, weightKg) + YOUTH_GROWTH_KCAL;
  }
  return applyEquation(ADULT_TEE[sex][pa], age, heightCm, weightKg);
}

export function estimatedEnergyRequirement(
  input: TargetInput,
  pa: ActivityLevel,
): { kcal: number; notes: string[] } {
  const { sex, age, heightCm, weightKg } = input;
  const lifeStage = sex === "female" ? (input.lifeStage ?? "none") : "none";
  const notes: string[] = [];
  const base = nonPregnantEer(sex, age, heightCm, weightKg, pa);

  if (lifeStage === "pregnant") {
    const weeks = input.gestationWeeks;
    if (weeks == null) {
      notes.push("Gestation week not set; using the non-pregnant equation.");
      return { kcal: base, notes };
    }
    if (weeks <= FIRST_TRIMESTER_LAST_WEEK) {
      return { kcal: base, notes };
    }
    let deposition = 200;
    if (input.prepregnancyWeightKg != null && input.prepregnancyWeightKg > 0) {
      const heightM = heightCm / 100;
      deposition = pregnancyDeposition(input.prepregnancyWeightKg / (heightM * heightM));
    } else {
      notes.push("Pre-pregnancy weight not set; assuming normal-weight BMI for energy deposition.");
    }
    const tee =
      applyEquation(PREGNANCY_TEE[pa], age, heightCm, weightKg) + PREGNANCY_GESTATION_COEF * weeks;
    return { kcal: tee + deposition, notes };
  }

  if (lifeStage === "lactating") {
    const months = input.lactationMonthsPostpartum;
    if (months == null) {
      notes.push("Months postpartum not set; assuming 0–6 months.");
      return { kcal: base + LACTATION_KCAL_0_6, notes };
    }
    if (months <= 6) return { kcal: base + LACTATION_KCAL_0_6, notes };
    if (months <= 12) return { kcal: base + LACTATION_KCAL_7_12, notes };
    notes.push(
      "NASEM lactation adjustments cover the first 12 months; using the non-pregnant equation.",
    );
    return { kcal: base, notes };
  }

  return { kcal: base, notes };
}

// ---------------------------------------------------------------------------
// Athletic rules
// ---------------------------------------------------------------------------

/**
 * Minimum PA category implied by daily training time. PAL bands in the DRI reports:
 * low active ≈ 30–60 min/day of moderate activity, active ≈ 1–2 h, very active ≈ 2 h or more.
 * The user's own everyday activity level is used if it is higher.
 */
export function activityFromTraining(hoursPerDay: number): ActivityLevel {
  if (hoursPerDay >= 2) return "very_active";
  if (hoursPerDay >= 1) return "active";
  if (hoursPerDay >= 0.5) return "low_active";
  return "inactive";
}

function maxActivity(a: ActivityLevel, b: ActivityLevel): ActivityLevel {
  return ACTIVITY_LEVELS.indexOf(a) >= ACTIVITY_LEVELS.indexOf(b) ? a : b;
}

/**
 * Protein for athletes, g/kg/day. Position stands give 1.2–2.0 g/kg (Thomas 2016; ISSN, Jäger 2017).
 * Strength and team sports start at 1.6 g/kg (Morton 2018 meta-analysis plateau); endurance at 1.4.
 * Two or more training hours per day add 0.2 g/kg, capped at 2.0.
 */
export const ATHLETIC_PROTEIN = {
  minGPerKg: 1.2,
  maxGPerKg: 2.0,
  baseGPerKg: { none: 1.2, endurance: 1.4, strength: 1.6, team_sport: 1.6, mixed: 1.6 },
  highLoadHours: 2,
  highLoadBonusGPerKg: 0.2,
} as const satisfies {
  minGPerKg: number;
  maxGPerKg: number;
  baseGPerKg: Record<TrainingType, number>;
  highLoadHours: number;
  highLoadBonusGPerKg: number;
};

/** Carbohydrate bands, g/kg/day, from Thomas et al. 2016 (Table 1), keyed by training hours/day. */
export const ATHLETIC_CARB_BANDS = [
  { label: "light", maxHoursExclusive: 0.75, min: 3, max: 5 },
  { label: "moderate", maxHoursExclusive: 1.5, min: 5, max: 7 },
  { label: "high", maxHoursExclusive: 4, min: 6, max: 10 },
  { label: "very high", maxHoursExclusive: Infinity, min: 8, max: 12 },
] as const;

/**
 * Fat AMDR as shares of energy: 25–35% for ages 14–18, 20–35% for adults (NASEM macronutrient
 * DRIs, 2002/2005). The lower bound is also the Athletic tier's fat minimum.
 */
export function fatAmdr(age: number): { min: number; max: number } {
  return age < 19 ? { min: 0.25, max: 0.35 } : { min: 0.2, max: 0.35 };
}

/** ACSM 2007: drink about 1.5 L per kg of body mass lost to sweat. */
export const SWEAT_REPLACEMENT_ML_PER_KG = 1500;

/**
 * Iron for athletes. Training may raise iron needs by 30–70% in female athletes and ~70% in
 * endurance runners (NASEM 2001 iron report; Thomas et al. 2016). Not an official recommendation.
 * Multipliers apply to the Average RDA; pregnancy and lactation keep their DRI.
 */
export const ATHLETIC_IRON = {
  defaultMultiplier: 1.3,
  femaleEnduranceMultiplier: 1.7,
} as const;

export function athleticCarbBand(hoursPerDay: number) {
  return ATHLETIC_CARB_BANDS.find((b) => hoursPerDay < b.maxHoursExclusive)!;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function validate(input: TargetInput): void {
  ageBand(input.age); // throws for age < 14
  if (!(input.weightKg > 0)) throw new RangeError("weightKg must be positive.");
  if (!(input.heightCm > 0)) throw new RangeError("heightCm must be positive.");
  if (!(input.trainingHoursPerDay >= 0))
    throw new RangeError("trainingHoursPerDay must be 0 or more.");
}

interface EnergyContext {
  kcal: number;
  notes: string[];
}

export function getDailyTargets(input: TargetInput): DailyTargets {
  validate(input);
  const lifeStage: LifeStage = input.sex === "female" ? (input.lifeStage ?? "none") : "none";
  const isTeen = input.age < 19;
  const w = input.weightKg;

  // Energy is needed by several % of energy rules, so compute it once.
  const energy: EnergyContext =
    input.tier === "athletic"
      ? estimatedEnergyRequirement(
          input,
          maxActivity(input.activityLevel, activityFromTraining(input.trainingHoursPerDay)),
        )
      : estimatedEnergyRequirement(input, input.activityLevel);
  const E = energy.kcal;

  // Sweat losses only adjust the Athletic tier, and only on training days.
  const sweat = estimateSweatLoss(input.trainingToday ?? []);
  const sweatNotes = (message: string): string[] => {
    if (sweat.kg <= 0) return [];
    return sweat.estimatedFromTime
      ? [
          message,
          "Sweat loss is estimated at ~1 L per training hour; weigh yourself before and after training for a better figure.",
        ]
      : [message];
  };

  const lifeStageProteinGPerKg = (): number => {
    if (lifeStage === "lactating") return 1.3;
    // The pregnancy RDA applies to the second half of pregnancy.
    if (lifeStage === "pregnant" && (input.gestationWeeks == null || input.gestationWeeks >= 20)) {
      return 1.1;
    }
    return isTeen ? 0.85 : 0.8;
  };
  const carbRdaG = lifeStage === "pregnant" ? 175 : lifeStage === "lactating" ? 210 : 130;
  const proteinAmdrMax = isTeen ? 0.3 : 0.35;

  const athleticProteinGPerKg = (): number => {
    const p = ATHLETIC_PROTEIN;
    let gPerKg = p.baseGPerKg[input.trainingType ?? "none"];
    if (input.trainingHoursPerDay >= p.highLoadHours) gPerKg += p.highLoadBonusGPerKg;
    return Math.max(Math.min(gPerKg, p.maxGPerKg), lifeStageProteinGPerKg());
  };

  const athleticCarbs = () => {
    const band = athleticCarbBand(input.trainingHoursPerDay);
    const mid = (band.min + band.max) / 2;
    return {
      value: Math.max(mid * w, carbRdaG),
      min: Math.max(band.min * w, carbRdaG),
      max: band.max * w,
      band: band.label,
    };
  };

  function computed(
    rule: ComputedRule,
  ): Omit<DailyTarget, "nutrientId" | "unit" | "kind" | "per" | "ul" | "ulScope" | "basis"> {
    switch (rule) {
      case "eer":
      case "eer-athletic":
        return { value: round(E), notes: [...energy.notes] };

      case "protein-rda": {
        const value = lifeStageProteinGPerKg() * w;
        return {
          value: round(value),
          min: round(value),
          max: round(Math.max(value, (proteinAmdrMax * E) / 4)),
          notes: [],
        };
      }
      case "protein-athletic":
        return {
          value: round(athleticProteinGPerKg() * w),
          min: round(Math.max(ATHLETIC_PROTEIN.minGPerKg, lifeStageProteinGPerKg()) * w),
          max: round(ATHLETIC_PROTEIN.maxGPerKg * w),
          notes: [],
        };

      case "carbs-amdr":
        return {
          value: round(Math.max((0.55 * E) / 4, carbRdaG)),
          min: round(Math.max((0.45 * E) / 4, carbRdaG)),
          max: round((0.65 * E) / 4),
          notes: [],
        };
      case "carbs-athletic": {
        const c = athleticCarbs();
        return {
          value: round(c.value),
          min: round(c.min),
          max: round(c.max),
          notes: [`Training load band: ${c.band}.`],
        };
      }

      case "fat-amdr": {
        const { min: lo, max: hi } = fatAmdr(input.age);
        return {
          value: round((((lo + hi) / 2) * E) / 9),
          min: round((lo * E) / 9),
          max: round((hi * E) / 9),
          notes: [],
        };
      }
      case "fat-athletic":
        // Set by balanceAthleticFat once protein and carbs are final (after the Average floor).
        return { value: null, min: round((fatAmdr(input.age).min * E) / 9), notes: [] };

      case "sat-fat-10pct":
        return { value: round((0.1 * E) / 9), notes: [] };

      case "water-athletic": {
        const ai = lookupDri(driTable("water"), input.sex, input.age, lifeStage);
        const extra = sweat.kg * SWEAT_REPLACEMENT_ML_PER_KG;
        return {
          value: round(ai + extra),
          notes: sweatNotes(`Includes ${round(extra)} mL to replace sweat loss.`),
        };
      }
      case "sodium-athletic": {
        const extra = sweat.kg * SWEAT_ELECTROLYTES_MG_PER_L.sodium;
        return {
          value: round(2300 + extra),
          notes: sweatNotes(`Raised by ${round(extra)} mg for estimated sweat sodium losses.`),
        };
      }
      case "chloride-athletic": {
        const ai = lookupDri(driTable("chloride"), input.sex, input.age, lifeStage);
        const extra = sweat.kg * SWEAT_ELECTROLYTES_MG_PER_L.chloride;
        const ul = lookupDri(NUTRIENTS.chloride.ul!.table, input.sex, input.age, lifeStage);
        const notes = sweatNotes(
          `Raised by ${round(extra)} mg for estimated sweat chloride losses.`,
        );
        if (ai + extra > ul) {
          notes.push(
            `Capped at the ${ul} mg upper limit; ask a sports dietitian about replacing heavy sweat losses.`,
          );
        }
        return { value: round(Math.min(ai + extra, ul)), notes };
      }
      case "potassium-athletic": {
        const ai = lookupDri(driTable("potassium"), input.sex, input.age, lifeStage);
        const extra = sweat.kg * SWEAT_ELECTROLYTES_MG_PER_L.potassium;
        return {
          value: round(ai + extra),
          notes: sweatNotes(`Raised by ${round(extra)} mg for estimated sweat potassium losses.`),
        };
      }

      case "iron-athletic": {
        const rda = lookupDri(driTable("iron"), input.sex, input.age, lifeStage);
        const ul = lookupDri(NUTRIENTS.iron.ul!.table, input.sex, input.age, lifeStage);
        if (lifeStage !== "none") {
          return {
            value: rda,
            notes: [
              "Pregnancy and lactation use the DRI. Ask your clinician whether training changes your iron needs.",
            ],
          };
        }
        const isFemale = input.sex === "female";
        const multiplier =
          isFemale && input.trainingType === "endurance"
            ? ATHLETIC_IRON.femaleEnduranceMultiplier
            : ATHLETIC_IRON.defaultMultiplier;
        const max = isFemale
          ? ATHLETIC_IRON.femaleEnduranceMultiplier
          : ATHLETIC_IRON.defaultMultiplier;
        return {
          value: round(Math.min(rda * multiplier, ul), 1),
          min: rda,
          max: round(Math.min(rda * max, ul), 1),
          notes: [
            `Training may raise iron needs by 30–70%; this is not an official recommendation. Stays under the ${ul} mg upper limit.`,
            "Ask a doctor about a ferritin blood test before taking iron supplements.",
          ],
        };
      }
    }
  }

  const result = {} as DailyTargets;
  for (const id of NUTRIENT_IDS) {
    const def = NUTRIENTS[id];
    const tierValue = def.tiers[input.tier];
    const ul = def.ul ? lookupDri(def.ul.table, input.sex, input.age, lifeStage) : null;
    const base = {
      nutrientId: id,
      unit: def.unit,
      kind: def.kind,
      per: "day" as Period,
      ul,
      ulScope: def.ul?.scope ?? null,
    };

    switch (tierValue.type) {
      case "fixed":
        result[id] = {
          ...base,
          value: tierValue.value,
          per: tierValue.per ?? "day",
          basis: tierValue.basis,
          notes: tierValue.note ? [tierValue.note] : [],
        };
        break;
      case "dri":
        result[id] = {
          ...base,
          value: lookupDri(tierValue.table, input.sex, input.age, lifeStage),
          basis: tierValue.basis,
          notes: tierValue.note ? [tierValue.note] : [],
        };
        break;
      case "computed":
        result[id] = { ...base, basis: tierValue.basis, ...computed(tierValue.rule) };
        break;
      case "none":
        result[id] = { ...base, value: null, basis: tierValue.reason, notes: [] };
        break;
    }
  }
  if (input.tier === "athletic") {
    const average = getDailyTargets({ ...input, tier: "average" });
    floorAtAverage(result, average);
    balanceAthleticFat(result, average.carbohydrate.value, fatAmdr(input.age));
  }
  return result;
}

/**
 * Athletic macro targets never go below the Average tier's value for the same profile (e.g.
 * the 3–5 g/kg light-training carb band can fall under the AMDR midpoint). Limits are left
 * alone (raising a limit would loosen it), and so is fat, which is set by balanceAthleticFat.
 */
function floorAtAverage(athletic: DailyTargets, average: DailyTargets): void {
  for (const id of NUTRIENT_IDS) {
    const a = athletic[id];
    const avg = average[id].value;
    if (NUTRIENTS[id].category !== "macro" || a.kind !== "target" || id === "fat") continue;
    if (a.value === null || avg === null || a.value >= avg) continue;
    athletic[id] = {
      ...a,
      value: avg,
      max: a.max === undefined ? undefined : Math.max(a.max, avg),
      notes: [
        ...a.notes,
        `Raised from ${a.value} to the Average tier's ${avg} ${a.unit}: Athletic targets never go below Average.`,
      ],
    };
  }
}

/**
 * Athletic fat: the energy left after protein and carbs, so protein + carbs + fat = the energy
 * target (4/4/9 kcal per g). Fat never goes below the AMDR minimum (25% of energy at 14–18, 20%
 * for adults); when protein and carbs leave less, carbs give way, down to the bottom of their
 * training-load band (and never below the Average tier's carbs). Only if that is not enough do
 * calories run over the energy target. There is no upper cap; a note flags fat above the 35%
 * AMDR maximum (e.g. moderate training with a high energy target).
 */
function balanceAthleticFat(
  t: DailyTargets,
  averageCarbsG: number | null,
  amdr: { min: number; max: number },
): void {
  const E = t.energy.value;
  const proteinG = t.protein.value;
  const carbsG = t.carbohydrate.value;
  if (E === null || proteinG === null || carbsG === null) return;

  const minFatKcal = amdr.min * E;
  const minPct = `${Math.round(amdr.min * 100)}%`;
  let carbs = carbsG;
  if (E - proteinG * 4 - carbs * 4 < minFatKcal) {
    const lowestCarbs = Math.max(t.carbohydrate.min ?? carbs, averageCarbsG ?? 0);
    carbs = Math.min(carbs, Math.max(lowestCarbs, Math.floor((E - proteinG * 4 - minFatKcal) / 4)));
    if (carbs < carbsG) {
      t.carbohydrate = {
        ...t.carbohydrate,
        value: carbs,
        notes: [
          ...t.carbohydrate.notes,
          `Lowered from ${carbsG} g so fat can stay at ${minPct} of energy within your energy target.`,
        ],
      };
    }
  }

  const fatKcal = Math.max(E - proteinG * 4 - carbs * 4, minFatKcal);
  const fat = Math.round(fatKcal / 9);
  const notes = [`Fat is the energy left after protein and carbs (at least ${minPct} of energy).`];
  if (fatKcal > E - proteinG * 4 - carbs * 4) {
    notes.push(
      `Protein and carbs leave less than ${minPct} of energy for fat even at the bottom of the carb band; fat is set to the ${minPct} minimum, so total calories will run above the energy target.`,
    );
  }
  if (fatKcal > amdr.max * E) {
    notes.push(
      "Fat is above 35% of energy, the top of the AMDR, because protein and carb targets leave that much of your energy target.",
    );
  }
  t.fat = {
    ...t.fat,
    value: fat,
    max: Math.max(Math.round((amdr.max * E) / 9), fat),
    notes,
  };
}

/** The Average-tier DRI table for a nutrient (used as the base for Athletic rules). */
function driTable(id: NutrientId) {
  const average = NUTRIENTS[id].tiers.average;
  if (average.type !== "dri") throw new Error(`Registry: ${id} average tier must be a DRI table.`);
  return average.table;
}
