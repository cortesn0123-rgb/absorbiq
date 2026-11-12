/**
 * One absorption rule per nutrient. Each rule turns a food's consumed amount into absorbed
 * amounts (low / central / high) and plain-English reasons, given the whole meal.
 * Every number comes from the factor table; see docs/bioavailability.md.
 */

import { formatNumber } from "@/lib/format";
import type { FoodGroup } from "@/lib/fdc/tag-rules";
import type { NutrientId } from "@/lib/nutrients/registry";
import {
  curveAt,
  pick,
  pickInverse,
  triple,
  type FactorTable,
  type Scenario,
  type Triple,
} from "./factor-table";
import type { FactorRow } from "./factors";
import { contentFor, type MealContext, type MealFood } from "./meal-context";
import type { Basis, EngineProfile } from "./types";

export interface RuleInput {
  food: MealFood;
  /** Consumed amount of this nutrient in this food (known, not null). */
  consumed: number;
  ctx: MealContext;
  table: FactorTable;
  profile: EngineProfile;
}

export interface RuleOutput {
  absorbed: Triple;
  reasons: string[];
  basis?: Basis;
}

type Rule = (input: RuleInput) => RuleOutput;

const PHYTIC_ACID_MOLAR_MASS = 660.04;
const ZINC_MOLAR_MASS = 65.38;
const OLDER_ADULT_AGE = 51;

const pct = (fraction: number) => `${formatNumber(fraction * 100)}%`;
const num = formatNumber;
const scaleTriple = (amount: number, f: Triple): Triple => triple((s) => amount * f[s]);
const isOlderAdult = (profile: EngineProfile) =>
  profile.age !== null && profile.age >= OLDER_ADULT_AGE;

function rangeText(f: Triple): string {
  const lo = Math.min(f.low, f.high);
  const hi = Math.max(f.low, f.high);
  return Math.abs(hi - lo) < 1e-9 ? pct(f.value) : `${pct(f.value)} (range ${pct(lo)}–${pct(hi)})`;
}

/** A single factor applied to the consumed amount, explained by its own description. */
function baseline(nutrient: string, key = "base"): Rule {
  return ({ consumed, table }) => {
    const row = table.get(nutrient, key);
    return {
      absorbed: scaleTriple(
        consumed,
        triple((s) => pick(row, s)),
      ),
      reasons: [row.description],
    };
  };
}

// ---------------------------------------------------------------------------
// Iron
// ---------------------------------------------------------------------------

/** Effect of a cup-sized drink, scaled down for smaller amounts. */
function drinkRemaining(row: FactorRow, grams: number, s: Scenario, refG: number) {
  if (grams <= 0) return 1;
  return 1 - (1 - pick(row, s)) * Math.min(1, grams / refG);
}

interface NonhemeModel {
  fraction: Triple;
  reasons: string[];
}

/** One Hallberg & Hulthén factor per meal component; each multiplies absorption once. */
interface NonhemeFactors {
  phytate: number;
  vitaminC: number;
  meat: number;
  calcium: number;
  egg: number;
  soy: number;
  tea: number;
  coffee: number;
}

export function nonhemeFactors(ctx: MealContext, table: FactorTable, s: Scenario): NonhemeFactors {
  const f = (key: string) => table.get("iron", key).value;
  const phytateP = contentFor(ctx.phytateMg, s) * f("phytate_p_share");
  const aa = ctx.vitaminCMg;
  const eggs = Math.min(1, ctx.eggG / f("egg_grams"));
  const soyProtein = Math.min(ctx.soyProteinG, f("soy_protein_cap_g"));
  const cup = f("drink_reference_g");
  return {
    phytate: (1 + phytateP) ** -f("hh_phytate_exponent"),
    vitaminC:
      aa > 0
        ? 1 +
          f("hh_aa_linear") * aa +
          f("hh_aa_phytate_coef") * Math.log10(phytateP + 1) * (aa + 1) ** f("hh_aa_exponent")
        : 1,
    meat: 1 + f("hh_mfp_coef") * ctx.mfpGrams[s] * (1 + f("hh_mfp_phytate_coef") * phytateP),
    calcium:
      f("hh_calcium_min") +
      f("hh_calcium_span") /
        (1 +
          10 **
            (-f("hh_calcium_slope") *
              (f("hh_calcium_midpoint_log") - Math.log10(ctx.calciumMg + 1)))),
    egg: 1 - f("hh_egg_coef") * eggs,
    soy: 1 - f("hh_soy_coef") * soyProtein,
    tea: drinkRemaining(table.get("iron", "tea_remaining"), ctx.teaG, s, cup),
    coffee: drinkRemaining(table.get("iron", "coffee_remaining"), ctx.coffeeG, s, cup),
  };
}

/**
 * Non-heme iron absorption for the whole meal (Hallberg & Hulthén 2000): absorption from an
 * inhibitor-free meal, times one factor per enhancer or inhibitor, times iron status.
 */
export function nonhemeIron(ctx: MealContext, table: FactorTable): NonhemeModel {
  const basal = table.get("iron", "hh_basal_absorption");
  const store = table.get("iron", "nonheme_store_scale");
  const product = (x: NonhemeFactors) =>
    x.phytate * x.vitaminC * x.meat * x.calcium * x.egg * x.soy * x.tea * x.coffee;
  const fraction = triple(
    (s) => pick(basal, s) * pick(store, s) * product(nonhemeFactors(ctx, table, s)),
  );

  const x = nonhemeFactors(ctx, table, "value");
  const lower = (factor: number) => `about ${pct(1 - factor)}`;
  const times = (factor: number) => `about ${num(factor)}x`;
  const reasons = [
    `Non-heme iron uses the Hallberg & Hulthén (2000) algorithm: ${pct(basal.value)} from a meal with nothing that helps or hinders, then each factor below is applied once.`,
  ];
  if (x.phytate < 0.99) {
    reasons.push(
      `Phytate in this meal (about ${num(ctx.phytateMg.value)} mg, from ${ctx.phytateSources.join(", ")}) lowers non-heme iron absorption by ${lower(x.phytate)}.`,
    );
  }
  if (x.vitaminC > 1.01) {
    reasons.push(
      `Vitamin C in this meal (${num(ctx.vitaminCMg)} mg) raises non-heme iron absorption ${times(x.vitaminC)}${x.phytate < 0.99 ? ", partly offsetting the phytate" : ""}.`,
    );
  }
  if (x.meat > 1.01) {
    reasons.push(
      `Meat, poultry or fish in this meal (about ${num(ctx.mfpGrams.value)} g) raises non-heme iron absorption ${times(x.meat)}.`,
    );
  }
  if (x.vitaminC <= 1.01 && x.meat <= 1.01) {
    reasons.push("No vitamin C or meat in this meal to raise non-heme iron absorption.");
  }
  if (x.calcium < 0.99) {
    reasons.push(
      `Calcium in this meal (${num(ctx.calciumMg)} mg) lowers non-heme iron absorption by ${lower(x.calcium)}.`,
    );
  }
  if (x.egg < 1)
    reasons.push(`Egg in this meal lowers non-heme iron absorption by ${lower(x.egg)}.`);
  if (x.soy < 1) {
    reasons.push(
      `Soy protein in this meal (${num(ctx.soyProteinG)} g) lowers non-heme iron absorption by ${lower(x.soy)}.`,
    );
  }
  if (x.tea < 1)
    reasons.push(`Tea with this meal lowers non-heme iron absorption by ${lower(x.tea)}.`);
  if (x.coffee < 1) {
    reasons.push(`Coffee with this meal lowers non-heme iron absorption by ${lower(x.coffee)}.`);
  }
  reasons.push(
    `Non-heme iron in this meal: about ${rangeText(fraction)} absorbed, assuming modest iron stores (serum ferritin about 23 µg/L); more stores mean less absorption.`,
  );
  return { fraction, reasons };
}

const iron: Rule = ({ food, consumed, ctx, table }) => {
  const share = table.get("iron", "heme_share");
  const hemeAbs = table.get("iron", "heme_absorption");
  const heme = food.food.tags.isHemeSource ? consumed * share.value : 0;
  const nonheme = consumed - heme;
  const model = nonhemeIron(ctx, table);

  const reasons: string[] = [];
  if (heme > 0) {
    reasons.push(
      `About ${pct(share.value)} of the iron in meat, poultry and fish is heme iron (${num(heme)} mg here), absorbed at about ${pct(hemeAbs.value)} (${pct(hemeAbs.low)}–${pct(hemeAbs.high)} depending on your iron stores).`,
    );
  }
  if (nonheme > 0) reasons.push(...model.reasons);
  return {
    absorbed: triple((s) => heme * pick(hemeAbs, s) + nonheme * model.fraction[s]),
    reasons,
  };
};

// ---------------------------------------------------------------------------
// Zinc
// ---------------------------------------------------------------------------

export function phytateZincRatio(phytateMg: number, zincMg: number): number {
  if (zincMg <= 0) return 0;
  return phytateMg / PHYTIC_ACID_MOLAR_MASS / (zincMg / ZINC_MOLAR_MASS);
}

const zinc: Rule = ({ consumed, ctx, table }) => {
  const cutHigh = table.get("zinc", "ratio_cutoff_high").value;
  const cutLow = table.get("zinc", "ratio_cutoff_low").value;
  const band = (ratio: number) => (ratio < cutHigh ? "high" : ratio <= cutLow ? "moderate" : "low");
  const ratio = (s: Scenario) => phytateZincRatio(contentFor(ctx.phytateMg, s), ctx.zincMg);
  const fraction = triple((s) => pick(table.get("zinc", `absorption_${band(ratio(s))}`), s));

  const r = ratio("value");
  const reasons =
    ctx.phytateMg.value <= 0
      ? [
          `This meal has no phytate, so zinc bioavailability is high: about ${rangeText(fraction)} absorbed.`,
        ]
      : [
          `The phytate:zinc molar ratio of this meal is about ${num(r)}. WHO rates zinc bioavailability as high under ${cutHigh}, moderate from ${cutHigh} to ${cutLow} and low over ${cutLow}, so about ${rangeText(fraction)} of the zinc is absorbed.`,
        ];
  return { absorbed: scaleTriple(consumed, fraction), reasons };
};

// ---------------------------------------------------------------------------
// Calcium
// ---------------------------------------------------------------------------

function calciumKey(food: MealFood): { key: string; reason: (pctText: string) => string } {
  const { tags, name } = food.food;
  if (tags.oxalateLevel === "high") {
    return {
      key: "high_oxalate",
      reason: (p) => `${name} is high in oxalate, which binds its calcium: about ${p} is absorbed.`,
    };
  }
  if (tags.isLowOxalateGreen) {
    return {
      key: "low_oxalate_greens",
      reason: (p) => `${name} is a low-oxalate green, so its calcium is well absorbed: about ${p}.`,
    };
  }
  if (tags.foodGroup === "dairy") {
    return { key: "dairy", reason: (p) => `Calcium from dairy is about ${p} absorbed.` };
  }
  if (tags.isFortified) {
    return {
      key: "fortified",
      reason: (p) => `Calcium in fortified foods is about ${p} absorbed, similar to dairy.`,
    };
  }
  if ((tags.foodGroup === "legume" || tags.foodGroup === "soy") && tags.phytateLevel === "high") {
    return {
      key: "high_phytate_legumes",
      reason: (p) => `Phytate in ${name} lowers calcium absorption to about ${p}.`,
    };
  }
  return { key: "default", reason: (p) => `Adults absorb about ${p} of the calcium in food.` };
}

const calcium: Rule = ({ food, consumed, table, profile }) => {
  const { key, reason } = calciumKey(food);
  const row = table.get("calcium", key);
  const fraction = triple((s) => pick(row, s));
  const reasons = [reason(rangeText(fraction))];
  if (isOlderAdult(profile)) {
    reasons.push(
      "Calcium absorption declines with age, so the lower end of the range is more likely.",
    );
  }
  return { absorbed: scaleTriple(consumed, fraction), reasons };
};

// ---------------------------------------------------------------------------
// Fat-soluble vitamins
// ---------------------------------------------------------------------------

/** Multiplier for a low-fat meal: phased in linearly below the adequate-fat threshold. */
function fatMultiplier(
  ctx: MealContext,
  table: FactorTable,
  nutrient: string,
  key: string,
  s: Scenario,
) {
  const threshold = pickInverse(table.get("fat_soluble", "adequate_fat_g"), s);
  if (ctx.fatG >= threshold) return 1;
  const atZero = pick(table.get(nutrient, key), s);
  return atZero + ((1 - atZero) * ctx.fatG) / threshold;
}

function fatReason(ctx: MealContext, table: FactorTable, what: string): string {
  const threshold = table.get("fat_soluble", "adequate_fat_g").value;
  return ctx.fatG < threshold
    ? `This meal has only ${num(ctx.fatG)} g of fat; ${what} needs fat to be absorbed (about ${threshold} g per meal), so less is absorbed.`
    : `This meal has ${num(ctx.fatG)} g of fat, enough to absorb ${what}.`;
}

function fatSoluble(nutrient: string, what: string): Rule {
  return ({ consumed, ctx, table }) => {
    const base = table.get(nutrient, "base");
    const fraction = triple(
      (s) => pick(base, s) * fatMultiplier(ctx, table, nutrient, "low_fat", s),
    );
    return {
      absorbed: scaleTriple(consumed, fraction),
      reasons: [base.description, fatReason(ctx, table, what)],
    };
  };
}

const ANIMAL_GROUPS: readonly FoodGroup[] = ["meat", "fish", "egg", "dairy"];

const vitaminA: Rule = ({ food, consumed, ctx, table }) => {
  const { retinolPer100g, grams, tags } = food.food;
  // RAE = retinol + carotenoids/12 (or /24). When FDC has no retinol figure, animal foods are
  // assumed to be all retinol and plant foods all carotenoids.
  const retinol =
    retinolPer100g !== null
      ? Math.min(consumed, (retinolPer100g * grams) / 100)
      : ANIMAL_GROUPS.includes(tags.foodGroup)
        ? consumed
        : 0;
  const provitamin = consumed - retinol;
  const rae = table.get("vitamin_a", "rae");
  const reasons = [
    "USDA reports vitamin A as RAE (retinol activity equivalents), which already accounts for absorption and for converting carotenoids to vitamin A. No second conversion is applied.",
  ];
  if (provitamin > 0) reasons.push(fatReason(ctx, table, "vitamin A from carotenoids"));
  return {
    absorbed: triple(
      (s) =>
        pick(rae, s) *
        (retinol + provitamin * fatMultiplier(ctx, table, "vitamin_a", "provitamin_low_fat", s)),
    ),
    reasons,
  };
};

// ---------------------------------------------------------------------------
// Dose-dependent: B12 and vitamin C per meal, copper per day
// ---------------------------------------------------------------------------

/** Total B12 absorbed from one meal: saturable intrinsic factor plus ~1% passive diffusion. */
export function b12AbsorbedPerMeal(doseUg: number, table: FactorTable, s: Scenario): number {
  if (doseUg <= 0) return 0;
  const capacity = pick(table.get("vitamin_b12", "active_capacity_ug"), s);
  const half = table.get("vitamin_b12", "half_saturation_ug").value;
  const passive = pick(table.get("vitamin_b12", "passive_fraction"), s);
  return (capacity * doseUg) / (half + doseUg) + passive * doseUg;
}

const vitaminB12: Rule = ({ consumed, ctx, table, profile }) => {
  const dose = ctx.b12Ug;
  const share = dose > 0 ? consumed / dose : 0;
  const mealAbsorbed = triple((s) => b12AbsorbedPerMeal(dose, table, s));
  const capacity = table.get("vitamin_b12", "active_capacity_ug");
  const reasons = [
    `B12 is absorbed through intrinsic factor, which handles only about ${num(capacity.value)} mcg per meal (${num(capacity.low)}–${num(capacity.high)} mcg). This meal has ${num(dose)} mcg, so about ${dose > 0 ? pct(mealAbsorbed.value / dose) : "0%"} is absorbed.`,
  ];
  if (isOlderAdult(profile)) {
    reasons.push(
      "After about age 50, atrophic gastritis becomes more common (8–9% of adults 65 and older), which lowers B12 absorption from food.",
    );
  }
  return { absorbed: triple((s) => mealAbsorbed[s] * share), reasons };
};

const vitaminC: Rule = ({ consumed, ctx, table }) => {
  const fraction = triple((s) => curveAt(table, "vitamin_c", "dose_mg", ctx.vitaminCMg, s));
  return {
    absorbed: scaleTriple(consumed, fraction),
    reasons: [
      `This meal has ${num(ctx.vitaminCMg)} mg of vitamin C; about ${rangeText(fraction)} is absorbed at this dose (70–90% at normal intakes, less than 50% above 1 g).`,
    ],
  };
};

const copper: Rule = ({ consumed, ctx, table }) => {
  const fraction = triple((s) => curveAt(table, "copper", "daily_mg", ctx.dayCopperMg, s, "log"));
  return {
    absorbed: scaleTriple(consumed, fraction),
    reasons: [
      `Copper absorption depends on how much you eat in a day: about ${pct(fraction.value)} at ${num(ctx.dayCopperMg)} mg (75% at 0.4 mg/day, falling to 12% at 7.5 mg/day).`,
    ],
  };
};

// ---------------------------------------------------------------------------
// Other vitamins
// ---------------------------------------------------------------------------

const niacin: Rule = ({ food, consumed, table }) => {
  const bound = food.food.tags.foodGroup === "grain" && !food.food.tags.isFortified;
  const row = table.get("niacin", bound ? "grains" : "base");
  return {
    absorbed: scaleTriple(
      consumed,
      triple((s) => pick(row, s)),
    ),
    reasons: [row.description],
  };
};

const folate: Rule = ({ consumed, table }) => {
  const row = table.get("folate", "dfe");
  return {
    absorbed: scaleTriple(
      consumed,
      triple((s) => pick(row, s)),
    ),
    reasons: [
      "USDA reports folate as DFE (dietary folate equivalents), which already accounts for folic acid being absorbed better than food folate. No second conversion is applied.",
    ],
  };
};

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------

const PROTEIN_GROUP_LABELS: Partial<Record<FoodGroup, string>> = {
  egg: "egg",
  dairy: "dairy",
  meat: "meat",
  fish: "fish",
  soy: "soy",
  legume: "beans and other legumes",
  nut_seed: "nuts and seeds",
  grain: "grains",
};

const protein: Rule = ({ food, consumed, table }) => {
  const group = food.food.tags.foodGroup;
  const label = PROTEIN_GROUP_LABELS[group];
  const row = table.get("protein", label ? group : "default");
  const fraction = triple((s) => pick(row, s));
  return {
    absorbed: scaleTriple(consumed, fraction),
    reasons: [
      label
        ? `Protein from ${label} is about ${rangeText(fraction)} digestible (WHO true digestibility).`
        : `Protein from this food is assumed about ${rangeText(fraction)} digestible (mixed-diet value).`,
    ],
  };
};

const fatRule: Rule = ({ consumed, table }) => {
  const row = table.get("fat", "base");
  return {
    absorbed: scaleTriple(
      consumed,
      triple((s) => pick(row, s)),
    ),
    reasons: [`About ${pct(row.value)} of dietary fat is digested and absorbed.`],
  };
};

const carbohydrate: Rule = ({ food, consumed, table }) => {
  const row = table.get("carbohydrate", "base");
  const fiber = food.amounts.fiber;
  const digestible = fiber === undefined ? consumed : Math.max(0, consumed - fiber);
  return {
    absorbed: scaleTriple(
      digestible,
      triple((s) => pick(row, s)),
    ),
    reasons: [
      fiber === undefined
        ? `About ${pct(row.value)} of carbohydrate is absorbed. This food has no fiber data, so fiber could not be excluded.`
        : `Fiber (${num(fiber)} g) is not digested, so it is excluded; about ${pct(row.value)} of the remaining carbohydrate is absorbed.`,
    ],
  };
};

const sugars: Rule = ({ consumed, table }) => {
  const row = table.get("carbohydrate", "base");
  return {
    absorbed: scaleTriple(
      consumed,
      triple((s) => pick(row, s)),
    ),
    reasons: [`Sugars are digestible carbohydrate; about ${pct(row.value)} is absorbed.`],
  };
};

const energy: Rule = ({ consumed, table }) => {
  const row = table.get("energy", "base");
  return {
    absorbed: scaleTriple(
      consumed,
      triple((s) => pick(row, s)),
    ),
    reasons: [
      "USDA calories are calculated with Atwater factors, which already allow for digestion, so they are counted as eaten.",
    ],
  };
};

function asEaten(reason: string): Rule {
  return ({ consumed }) => ({
    absorbed: { low: consumed, value: consumed, high: consumed },
    reasons: [reason],
    basis: "as-eaten",
  });
}

// ---------------------------------------------------------------------------
// Rule per nutrient
// ---------------------------------------------------------------------------

export const RULES: Record<NutrientId, Rule> = {
  vitamin_a: vitaminA,
  vitamin_c: vitaminC,
  vitamin_d: fatSoluble("vitamin_d", "vitamin D"),
  vitamin_e: fatSoluble("vitamin_e", "vitamin E"),
  vitamin_k: fatSoluble("vitamin_k", "vitamin K"),
  thiamin: baseline("thiamin"),
  riboflavin: baseline("riboflavin"),
  niacin,
  pantothenic_acid: baseline("pantothenic_acid"),
  vitamin_b6: baseline("vitamin_b6"),
  biotin: baseline("biotin"),
  folate,
  vitamin_b12: vitaminB12,
  choline: baseline("choline"),

  calcium,
  iron,
  magnesium: baseline("magnesium"),
  zinc,
  potassium: baseline("potassium"),
  sodium: baseline("sodium"),
  chloride: baseline("chloride"),
  selenium: baseline("selenium"),
  copper,
  manganese: baseline("manganese"),
  phosphorus: baseline("phosphorus"),
  iodine: baseline("iodine"),
  chromium: baseline("chromium"),
  molybdenum: baseline("molybdenum"),

  energy,
  protein,
  carbohydrate,
  fiber: asEaten("Fiber is not absorbed; it counts toward your fiber goal as eaten."),
  sugars_total: sugars,
  added_sugars: sugars,
  fat: fatRule,
  saturated_fat: fatRule,
  trans_fat: fatRule,
  mufa: fatRule,
  pufa: fatRule,
  ala: fatRule,
  linoleic_acid: fatRule,
  cholesterol: baseline("cholesterol"),
  water: asEaten("Water is counted as eaten."),
};
