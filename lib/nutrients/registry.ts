/**
 * Nutrient registry — the single source of truth for every nutrient the app tracks.
 *
 * Every other part of the app (targets, logging, UI, AI helper) reads nutrient metadata
 * from here. Do not duplicate units, FDC numbers or reference values elsewhere.
 *
 * Sources (all values verified against these tables):
 * - FDA Daily Values: 21 CFR 101.9(c)(8)(iv) and (c)(9); FDA "Daily Value on the Nutrition
 *   and Supplement Facts Labels".
 * - NASEM Dietary Reference Intakes (RDA/AI/UL/CDRR), as published in the joint
 *   US–Canada DRI summary tables.
 * - FDC nutrient numbers: USDA FoodData Central nutrient.csv (Foundation Foods, 2024-10-31).
 */

export const TIERS = ["fda", "average", "athletic"] as const;
export type Tier = (typeof TIERS)[number];

export type Sex = "male" | "female";
export type LifeStage = "none" | "pregnant" | "lactating";

/** DRI life-stage age bands the app supports (users must be 14 or older). */
export const AGE_BANDS = ["14-18", "19-30", "31-50", "51-70", "71+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** DRI pregnancy/lactation age bands. */
export const REPRO_BANDS = ["14-18", "19-30", "31-50"] as const;
export type ReproBand = (typeof REPRO_BANDS)[number];

export type Unit = "kcal" | "g" | "mg" | "mcg" | "mL";
/** Unit string as returned by the FDC API (`nutrient.unitName`). */
export type FdcUnit = "KCAL" | "G" | "MG" | "UG";
export type NutrientKind = "target" | "limit";
export type NutrientCategory = "vitamin" | "mineral" | "macro";

/** A value for every DRI life-stage group from 14 years up. */
export interface DriTable {
  male: Record<AgeBand, number>;
  female: Record<AgeBand, number>;
  pregnant: Record<ReproBand, number>;
  lactating: Record<ReproBand, number>;
}

/** Rules evaluated in lib/nutrients/targets.ts because they depend on the user's body/energy. */
export type ComputedRule =
  | "eer"
  | "eer-athletic"
  | "protein-rda"
  | "protein-athletic"
  | "carbs-amdr"
  | "carbs-athletic"
  | "fat-amdr"
  | "fat-athletic"
  | "sat-fat-10pct"
  | "water-athletic"
  | "sodium-athletic";

/** Period a target or limit applies to. Almost everything is per day. */
export type Period = "day" | "meal";

export type TierValue =
  /** One value for every adult (e.g. FDA Daily Values). `per` defaults to "day". */
  | { type: "fixed"; value: number; per?: Period; basis: string; note?: string }
  /** Value looked up by sex, age and life stage. */
  | { type: "dri"; table: DriTable; basis: "RDA" | "AI" | "CDRR"; note?: string }
  /** Value calculated from the user's profile. */
  | { type: "computed"; rule: ComputedRule; basis: string }
  /** No authoritative body publishes a number for this nutrient/tier. */
  | { type: "none"; reason: string };

export interface UpperLimit {
  table: DriTable;
  /**
   * - "total": applies to intake from all sources, so food intake is compared directly.
   * - "form": applies to one chemical form only; compare the intake of `fdcNumbers` instead.
   * - "supplemental": applies to supplements/fortificants only; food intake cannot exceed it.
   */
  scope: "total" | "form" | "supplemental";
  /** For scope "form": the FDC nutrient number(s) to compare against the UL. */
  fdcNumbers?: string[];
  note?: string;
}

export interface NutrientDefinition {
  id: NutrientId;
  name: string;
  category: NutrientCategory;
  unit: Unit;
  /** Unit FDC reports this nutrient in. Same as `unit` except water (g -> mL, 1:1). */
  fdcUnit: FdcUnit;
  /** FDC nutrient numbers in order of preference; later numbers are fallbacks. */
  fdcNumbers: string[];
  /** "limit" nutrients are things to stay under (e.g. sodium, saturated fat). */
  kind: NutrientKind;
  tiers: Record<Tier, TierValue>;
  /** Tolerable Upper Intake Level, or null when none has been set. */
  ul: UpperLimit | null;
  citation: string;
  note?: string;
}

export const NUTRIENT_IDS = [
  // Vitamins
  "vitamin_a",
  "vitamin_c",
  "vitamin_d",
  "vitamin_e",
  "vitamin_k",
  "thiamin",
  "riboflavin",
  "niacin",
  "pantothenic_acid",
  "vitamin_b6",
  "biotin",
  "folate",
  "vitamin_b12",
  "choline",
  // Minerals
  "calcium",
  "iron",
  "magnesium",
  "zinc",
  "potassium",
  "sodium",
  "chloride",
  "selenium",
  "copper",
  "manganese",
  "phosphorus",
  "iodine",
  "chromium",
  "molybdenum",
  // Macros
  "energy",
  "protein",
  "carbohydrate",
  "fiber",
  "sugars_total",
  "added_sugars",
  "fat",
  "saturated_fat",
  "trans_fat",
  "mufa",
  "pufa",
  "ala",
  "linoleic_acid",
  "cholesterol",
  "water",
] as const;
export type NutrientId = (typeof NUTRIENT_IDS)[number];

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

const FDA_DV = "FDA Daily Values, 21 CFR 101.9(c)(8)(iv) and (c)(9)";
const DRI_CA_D = "NASEM, DRIs for Calcium and Vitamin D (2011)";
const DRI_B =
  "NASEM, DRIs for Thiamin, Riboflavin, Niacin, B6, Folate, B12, Pantothenic Acid, Biotin, and Choline (1998)";
const DRI_C_E_SE = "NASEM, DRIs for Vitamin C, Vitamin E, Selenium, and Carotenoids (2000)";
const DRI_A_K_TRACE =
  "NASEM, DRIs for Vitamin A, Vitamin K, Arsenic, Boron, Chromium, Copper, Iodine, Iron, Manganese, Molybdenum, Nickel, Silicon, Vanadium, and Zinc (2001)";
const DRI_MG_P = "NASEM, DRIs for Calcium, Phosphorus, Magnesium, Vitamin D, and Fluoride (1997)";
const DRI_NA_K = "NASEM, DRIs for Sodium and Potassium (2019)";
const DRI_WATER = "NASEM, DRIs for Water, Potassium, Sodium, Chloride, and Sulfate (2005)";
const DRI_MACRO =
  "NASEM, DRIs for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids (2002/2005)";
const DRI_ENERGY = "NASEM, Dietary Reference Intakes for Energy (2023)";
const DGA = "USDA/HHS, Dietary Guidelines for Americans 2025–2030 (January 2026)";
const SPORTS =
  "Thomas DT, Erdman KA, Burke LM. ACSM/AND/DC joint position: Nutrition and Athletic Performance. Med Sci Sports Exerc. 2016;48(3):543-568";

// ---------------------------------------------------------------------------
// Table builders. Arrays are ordered:
//   five  = [14-18, 19-30, 31-50, 51-70, 71+]
//   three = [≤18, 19-30, 31-50]   (pregnancy / lactation)
// ---------------------------------------------------------------------------

type Five = readonly [number, number, number, number, number];
type Three = readonly [number, number, number];

function five(v: Five): Record<AgeBand, number> {
  return { "14-18": v[0], "19-30": v[1], "31-50": v[2], "51-70": v[3], "71+": v[4] };
}

function three(v: Three): Record<ReproBand, number> {
  return { "14-18": v[0], "19-30": v[1], "31-50": v[2] };
}

function dri(male: Five, female: Five, pregnant: Three, lactating: Three): DriTable {
  return {
    male: five(male),
    female: five(female),
    pregnant: three(pregnant),
    lactating: three(lactating),
  };
}

/** Same value for every group. */
function flat(v: number): DriTable {
  return dri([v, v, v, v, v], [v, v, v, v, v], [v, v, v], [v, v, v]);
}

/** Teen value for 14-18, adult value for 19+ (common UL pattern). */
function teenAdult(teen: number, adult: number): DriTable {
  const a: Five = [teen, adult, adult, adult, adult];
  const r: Three = [teen, adult, adult];
  return dri(a, a, r, r);
}

function fda(value: number, note?: string): TierValue {
  return { type: "fixed", value, basis: "FDA Daily Value", note };
}

/** DGA 2025–2030: avoid added sugars; when eaten, no more than 10 g per meal. */
const DGA_ADDED_SUGARS: TierValue = {
  type: "fixed",
  value: 10,
  per: "meal",
  basis: "At most 10 g per meal (Dietary Guidelines 2025–2030)",
  note: "The Dietary Guidelines advise avoiding added sugars; when eaten, keep each meal at or under 10 g.",
};

const ATHLETIC_MICRO_NOTE =
  "Athletic tier uses the Average DRI: sports-nutrition position stands do not set higher micronutrient targets for athletes.";

/** Micronutrients: the Athletic tier uses the same DRI as Average (no consensus for higher needs). */
function micro(fdaValue: number, table: DriTable, basis: "RDA" | "AI"): Record<Tier, TierValue> {
  return {
    fda: fda(fdaValue),
    average: { type: "dri", table, basis },
    athletic: { type: "dri", table, basis, note: ATHLETIC_MICRO_NOTE },
  };
}

function none(reason: string): Record<Tier, TierValue> {
  const value: TierValue = { type: "none", reason };
  return { fda: value, average: value, athletic: value };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const NUTRIENTS: Record<NutrientId, NutrientDefinition> = {
  // ----- Vitamins -----------------------------------------------------------
  vitamin_a: {
    id: "vitamin_a",
    name: "Vitamin A (RAE)",
    category: "vitamin",
    unit: "mcg",
    fdcUnit: "UG",
    fdcNumbers: ["320"],
    kind: "target",
    tiers: micro(
      900,
      dri(
        [900, 900, 900, 900, 900],
        [700, 700, 700, 700, 700],
        [750, 770, 770],
        [1200, 1300, 1300],
      ),
      "RDA",
    ),
    ul: {
      table: teenAdult(2800, 3000),
      scope: "form",
      fdcNumbers: ["319"],
      note: "UL applies to preformed vitamin A (retinol) only, not provitamin A carotenoids.",
    },
    citation: `${DRI_A_K_TRACE}; ${FDA_DV}`,
    note: "FDC reports vitamin A as RAE, which already accounts for carotenoid conversion. Do not convert again.",
  },
  vitamin_c: {
    id: "vitamin_c",
    name: "Vitamin C",
    category: "vitamin",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["401"],
    kind: "target",
    tiers: micro(
      90,
      dri([75, 90, 90, 90, 90], [65, 75, 75, 75, 75], [80, 85, 85], [115, 120, 120]),
      "RDA",
    ),
    ul: { table: teenAdult(1800, 2000), scope: "total" },
    citation: `${DRI_C_E_SE}; ${FDA_DV}`,
    note: "Smokers need 35 mg/day more than the RDA.",
  },
  vitamin_d: {
    id: "vitamin_d",
    name: "Vitamin D",
    category: "vitamin",
    unit: "mcg",
    fdcUnit: "UG",
    fdcNumbers: ["328"],
    kind: "target",
    tiers: micro(
      20,
      dri([15, 15, 15, 15, 20], [15, 15, 15, 15, 20], [15, 15, 15], [15, 15, 15]),
      "RDA",
    ),
    ul: { table: flat(100), scope: "total" },
    citation: `${DRI_CA_D}; ${FDA_DV}`,
    note: "RDA assumes minimal sun exposure.",
  },
  vitamin_e: {
    id: "vitamin_e",
    name: "Vitamin E (alpha-tocopherol)",
    category: "vitamin",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["323"],
    kind: "target",
    tiers: micro(
      15,
      dri([15, 15, 15, 15, 15], [15, 15, 15, 15, 15], [15, 15, 15], [19, 19, 19]),
      "RDA",
    ),
    ul: {
      table: teenAdult(800, 1000),
      scope: "supplemental",
      note: "UL applies to supplemental alpha-tocopherol only, not vitamin E naturally in food.",
    },
    citation: `${DRI_C_E_SE}; ${FDA_DV}`,
  },
  vitamin_k: {
    id: "vitamin_k",
    name: "Vitamin K",
    category: "vitamin",
    unit: "mcg",
    fdcUnit: "UG",
    fdcNumbers: ["430"],
    kind: "target",
    tiers: micro(
      120,
      dri([75, 120, 120, 120, 120], [75, 90, 90, 90, 90], [75, 90, 90], [75, 90, 90]),
      "AI",
    ),
    ul: null,
    citation: `${DRI_A_K_TRACE}; ${FDA_DV}`,
    note: "FDC number 430 is phylloquinone (K1), the form the AI is based on.",
  },
  thiamin: {
    id: "thiamin",
    name: "Thiamin (B1)",
    category: "vitamin",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["404"],
    kind: "target",
    tiers: micro(
      1.2,
      dri([1.2, 1.2, 1.2, 1.2, 1.2], [1.0, 1.1, 1.1, 1.1, 1.1], [1.4, 1.4, 1.4], [1.4, 1.4, 1.4]),
      "RDA",
    ),
    ul: null,
    citation: `${DRI_B}; ${FDA_DV}`,
  },
  riboflavin: {
    id: "riboflavin",
    name: "Riboflavin (B2)",
    category: "vitamin",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["405"],
    kind: "target",
    tiers: micro(
      1.3,
      dri([1.3, 1.3, 1.3, 1.3, 1.3], [1.0, 1.1, 1.1, 1.1, 1.1], [1.4, 1.4, 1.4], [1.6, 1.6, 1.6]),
      "RDA",
    ),
    ul: null,
    citation: `${DRI_B}; ${FDA_DV}`,
  },
  niacin: {
    id: "niacin",
    name: "Niacin (B3)",
    category: "vitamin",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["406"],
    kind: "target",
    tiers: micro(
      16,
      dri([16, 16, 16, 16, 16], [14, 14, 14, 14, 14], [18, 18, 18], [17, 17, 17]),
      "RDA",
    ),
    ul: {
      table: teenAdult(30, 35),
      scope: "supplemental",
      note: "UL applies to niacin from supplements and fortified foods; FDC does not separate added niacin.",
    },
    citation: `${DRI_B}; ${FDA_DV}`,
    note: "Targets are in niacin equivalents (NE); FDC reports preformed niacin only, so intake from tryptophan is not counted.",
  },
  pantothenic_acid: {
    id: "pantothenic_acid",
    name: "Pantothenic acid (B5)",
    category: "vitamin",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["410"],
    kind: "target",
    tiers: micro(5, dri([5, 5, 5, 5, 5], [5, 5, 5, 5, 5], [6, 6, 6], [7, 7, 7]), "AI"),
    ul: null,
    citation: `${DRI_B}; ${FDA_DV}`,
  },
  vitamin_b6: {
    id: "vitamin_b6",
    name: "Vitamin B6",
    category: "vitamin",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["415"],
    kind: "target",
    tiers: micro(
      1.7,
      dri([1.3, 1.3, 1.3, 1.7, 1.7], [1.2, 1.3, 1.3, 1.5, 1.5], [1.9, 1.9, 1.9], [2.0, 2.0, 2.0]),
      "RDA",
    ),
    ul: { table: teenAdult(80, 100), scope: "total" },
    citation: `${DRI_B}; ${FDA_DV}`,
  },
  biotin: {
    id: "biotin",
    name: "Biotin (B7)",
    category: "vitamin",
    unit: "mcg",
    fdcUnit: "UG",
    fdcNumbers: ["416"],
    kind: "target",
    tiers: micro(
      30,
      dri([25, 30, 30, 30, 30], [25, 30, 30, 30, 30], [30, 30, 30], [35, 35, 35]),
      "AI",
    ),
    ul: null,
    citation: `${DRI_B}; ${FDA_DV}`,
    note: "Few FDC foods report biotin, so logged intake is likely underestimated.",
  },
  folate: {
    id: "folate",
    name: "Folate (DFE)",
    category: "vitamin",
    unit: "mcg",
    fdcUnit: "UG",
    fdcNumbers: ["435"],
    kind: "target",
    tiers: micro(
      400,
      dri([400, 400, 400, 400, 400], [400, 400, 400, 400, 400], [600, 600, 600], [500, 500, 500]),
      "RDA",
    ),
    ul: {
      table: teenAdult(800, 1000),
      scope: "form",
      fdcNumbers: ["431"],
      note: "UL applies to synthetic folic acid (fortified foods and supplements) only.",
    },
    citation: `${DRI_B}; ${FDA_DV}`,
    note: "FDC reports folate as DFE, which already accounts for folic acid's higher bioavailability. Do not convert again.",
  },
  vitamin_b12: {
    id: "vitamin_b12",
    name: "Vitamin B12",
    category: "vitamin",
    unit: "mcg",
    fdcUnit: "UG",
    fdcNumbers: ["418"],
    kind: "target",
    tiers: micro(
      2.4,
      dri([2.4, 2.4, 2.4, 2.4, 2.4], [2.4, 2.4, 2.4, 2.4, 2.4], [2.6, 2.6, 2.6], [2.8, 2.8, 2.8]),
      "RDA",
    ),
    ul: null,
    citation: `${DRI_B}; ${FDA_DV}`,
  },
  choline: {
    id: "choline",
    name: "Choline",
    category: "vitamin",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["421"],
    kind: "target",
    tiers: micro(
      550,
      dri([550, 550, 550, 550, 550], [400, 425, 425, 425, 425], [450, 450, 450], [550, 550, 550]),
      "AI",
    ),
    ul: { table: teenAdult(3000, 3500), scope: "total" },
    citation: `${DRI_B}; ${FDA_DV}`,
  },

  // ----- Minerals -----------------------------------------------------------
  calcium: {
    id: "calcium",
    name: "Calcium",
    category: "mineral",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["301"],
    kind: "target",
    tiers: micro(
      1300,
      dri(
        [1300, 1000, 1000, 1000, 1200],
        [1300, 1000, 1000, 1200, 1200],
        [1300, 1000, 1000],
        [1300, 1000, 1000],
      ),
      "RDA",
    ),
    ul: {
      table: dri(
        [3000, 2500, 2500, 2000, 2000],
        [3000, 2500, 2500, 2000, 2000],
        [3000, 2500, 2500],
        [3000, 2500, 2500],
      ),
      scope: "total",
    },
    citation: `${DRI_CA_D}; ${FDA_DV}`,
  },
  iron: {
    id: "iron",
    name: "Iron",
    category: "mineral",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["303"],
    kind: "target",
    tiers: micro(18, dri([11, 8, 8, 8, 8], [15, 18, 18, 8, 8], [27, 27, 27], [10, 9, 9]), "RDA"),
    ul: { table: flat(45), scope: "total" },
    citation: `${DRI_A_K_TRACE}; ${FDA_DV}`,
    note: "NASEM notes vegetarians may need 1.8x the RDA because non-heme iron is less bioavailable.",
  },
  magnesium: {
    id: "magnesium",
    name: "Magnesium",
    category: "mineral",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["304"],
    kind: "target",
    tiers: micro(
      420,
      dri([410, 400, 420, 420, 420], [360, 310, 320, 320, 320], [400, 350, 360], [360, 310, 320]),
      "RDA",
    ),
    ul: {
      table: flat(350),
      scope: "supplemental",
      note: "UL applies to supplemental magnesium only, not magnesium in food and water.",
    },
    citation: `${DRI_MG_P}; ${FDA_DV}`,
  },
  zinc: {
    id: "zinc",
    name: "Zinc",
    category: "mineral",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["309"],
    kind: "target",
    tiers: micro(11, dri([11, 11, 11, 11, 11], [9, 8, 8, 8, 8], [12, 11, 11], [13, 12, 12]), "RDA"),
    ul: { table: teenAdult(34, 40), scope: "total" },
    citation: `${DRI_A_K_TRACE}; ${FDA_DV}`,
  },
  potassium: {
    id: "potassium",
    name: "Potassium",
    category: "mineral",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["306"],
    kind: "target",
    tiers: micro(
      4700,
      dri(
        [3000, 3400, 3400, 3400, 3400],
        [2300, 2600, 2600, 2600, 2600],
        [2600, 2900, 2900],
        [2500, 2800, 2800],
      ),
      "AI",
    ),
    ul: null,
    citation: `${DRI_NA_K}; ${FDA_DV}`,
  },
  sodium: {
    id: "sodium",
    name: "Sodium",
    category: "mineral",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["307"],
    kind: "limit",
    tiers: {
      fda: fda(2300),
      average: { type: "dri", table: flat(2300), basis: "CDRR" },
      athletic: {
        type: "computed",
        rule: "sodium-athletic",
        basis: "CDRR plus estimated sweat sodium losses",
      },
    },
    ul: null,
    citation: `${DRI_NA_K}; ${FDA_DV}`,
    note: "Limit is the Chronic Disease Risk Reduction intake (CDRR). The AI for adequacy is 1500 mg.",
  },
  chloride: {
    id: "chloride",
    name: "Chloride",
    category: "mineral",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["302"],
    kind: "target",
    tiers: micro(
      2300,
      dri(
        [2300, 2300, 2300, 2000, 1800],
        [2300, 2300, 2300, 2000, 1800],
        [2300, 2300, 2300],
        [2300, 2300, 2300],
      ),
      "AI",
    ),
    ul: { table: flat(3600), scope: "total" },
    citation: `${DRI_WATER}; ${FDA_DV}`,
    note: "Few FDC foods report chloride. Most dietary chloride comes with sodium as salt.",
  },
  selenium: {
    id: "selenium",
    name: "Selenium",
    category: "mineral",
    unit: "mcg",
    fdcUnit: "UG",
    fdcNumbers: ["317"],
    kind: "target",
    tiers: micro(
      55,
      dri([55, 55, 55, 55, 55], [55, 55, 55, 55, 55], [60, 60, 60], [70, 70, 70]),
      "RDA",
    ),
    ul: { table: flat(400), scope: "total" },
    citation: `${DRI_C_E_SE}; ${FDA_DV}`,
  },
  copper: {
    id: "copper",
    name: "Copper",
    category: "mineral",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["312"],
    kind: "target",
    tiers: micro(
      0.9,
      dri([0.89, 0.9, 0.9, 0.9, 0.9], [0.89, 0.9, 0.9, 0.9, 0.9], [1.0, 1.0, 1.0], [1.3, 1.3, 1.3]),
      "RDA",
    ),
    ul: { table: teenAdult(8, 10), scope: "total" },
    citation: `${DRI_A_K_TRACE}; ${FDA_DV}`,
    note: "DRI tables list copper in micrograms; values here are converted to mg to match FDC.",
  },
  manganese: {
    id: "manganese",
    name: "Manganese",
    category: "mineral",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["315"],
    kind: "target",
    tiers: micro(
      2.3,
      dri([2.2, 2.3, 2.3, 2.3, 2.3], [1.6, 1.8, 1.8, 1.8, 1.8], [2.0, 2.0, 2.0], [2.6, 2.6, 2.6]),
      "AI",
    ),
    ul: { table: teenAdult(9, 11), scope: "total" },
    citation: `${DRI_A_K_TRACE}; ${FDA_DV}`,
  },
  phosphorus: {
    id: "phosphorus",
    name: "Phosphorus",
    category: "mineral",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["305"],
    kind: "target",
    tiers: micro(
      1250,
      dri(
        [1250, 700, 700, 700, 700],
        [1250, 700, 700, 700, 700],
        [1250, 700, 700],
        [1250, 700, 700],
      ),
      "RDA",
    ),
    ul: {
      table: dri(
        [4000, 4000, 4000, 4000, 3000],
        [4000, 4000, 4000, 4000, 3000],
        [3500, 3500, 3500],
        [4000, 4000, 4000],
      ),
      scope: "total",
    },
    citation: `${DRI_MG_P}; ${FDA_DV}`,
  },
  iodine: {
    id: "iodine",
    name: "Iodine",
    category: "mineral",
    unit: "mcg",
    fdcUnit: "UG",
    fdcNumbers: ["314"],
    kind: "target",
    tiers: micro(
      150,
      dri([150, 150, 150, 150, 150], [150, 150, 150, 150, 150], [220, 220, 220], [290, 290, 290]),
      "RDA",
    ),
    ul: { table: teenAdult(900, 1100), scope: "total" },
    citation: `${DRI_A_K_TRACE}; ${FDA_DV}`,
    note: "Few FDC foods report iodine, and iodized salt is usually not captured.",
  },
  chromium: {
    id: "chromium",
    name: "Chromium",
    category: "mineral",
    unit: "mcg",
    fdcUnit: "UG",
    fdcNumbers: ["310"],
    kind: "target",
    tiers: micro(
      35,
      dri([35, 35, 35, 30, 30], [24, 25, 25, 20, 20], [29, 30, 30], [44, 45, 45]),
      "AI",
    ),
    ul: null,
    citation: `${DRI_A_K_TRACE}; ${FDA_DV}`,
    note: "Few FDC foods report chromium, so logged intake is likely underestimated.",
  },
  molybdenum: {
    id: "molybdenum",
    name: "Molybdenum",
    category: "mineral",
    unit: "mcg",
    fdcUnit: "UG",
    fdcNumbers: ["316"],
    kind: "target",
    tiers: micro(
      45,
      dri([43, 45, 45, 45, 45], [43, 45, 45, 45, 45], [50, 50, 50], [50, 50, 50]),
      "RDA",
    ),
    ul: { table: teenAdult(1700, 2000), scope: "total" },
    citation: `${DRI_A_K_TRACE}; ${FDA_DV}`,
    note: "Few FDC foods report molybdenum, so logged intake is likely underestimated.",
  },

  // ----- Macros -------------------------------------------------------------
  energy: {
    id: "energy",
    name: "Calories",
    category: "macro",
    unit: "kcal",
    fdcUnit: "KCAL",
    fdcNumbers: ["208", "958", "957"],
    kind: "target",
    tiers: {
      fda: fda(2000, "Reference intake used to set the FDA Daily Values, not a personal target."),
      average: { type: "computed", rule: "eer", basis: "2023 NASEM Estimated Energy Requirement" },
      athletic: {
        type: "computed",
        rule: "eer-athletic",
        basis: "2023 NASEM EER at an activity level that includes training",
      },
    },
    ul: null,
    citation: `${DRI_ENERGY}; ${FDA_DV}`,
  },
  protein: {
    id: "protein",
    name: "Protein",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["203"],
    kind: "target",
    tiers: {
      fda: fda(50),
      average: { type: "computed", rule: "protein-rda", basis: "RDA in g/kg body weight" },
      athletic: {
        type: "computed",
        rule: "protein-athletic",
        basis: "1.2–2.0 g/kg by training type and load",
      },
    },
    ul: null,
    citation: `${DRI_MACRO}; ${SPORTS}; ${FDA_DV}`,
  },
  carbohydrate: {
    id: "carbohydrate",
    name: "Carbohydrates",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["205"],
    kind: "target",
    tiers: {
      fda: fda(275),
      average: { type: "computed", rule: "carbs-amdr", basis: "AMDR 45–65% of energy" },
      athletic: {
        type: "computed",
        rule: "carbs-athletic",
        basis: "3–12 g/kg by daily training hours",
      },
    },
    ul: null,
    citation: `${DRI_MACRO}; ${SPORTS}; ${FDA_DV}`,
  },
  fiber: {
    id: "fiber",
    name: "Fiber",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["291"],
    kind: "target",
    tiers: micro(
      28,
      dri([38, 38, 38, 30, 30], [26, 25, 25, 21, 21], [28, 28, 28], [29, 29, 29]),
      "AI",
    ),
    ul: null,
    citation: `${DRI_MACRO}; ${FDA_DV}`,
  },
  sugars_total: {
    id: "sugars_total",
    name: "Sugars",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["269"],
    kind: "target",
    tiers: none("No FDA Daily Value or DRI exists for total sugars; tracked for information only."),
    ul: null,
    citation: DRI_MACRO,
  },
  added_sugars: {
    id: "added_sugars",
    name: "Added sugars",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["539"],
    kind: "limit",
    tiers: {
      fda: fda(50),
      average: DGA_ADDED_SUGARS,
      athletic: DGA_ADDED_SUGARS,
    },
    ul: null,
    citation: `${DGA}; ${FDA_DV}`,
    note: "Few FDC foods report added sugars; branded foods usually do. The FDA tier keeps the 50 g/day Daily Value.",
  },
  fat: {
    id: "fat",
    name: "Fat",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["204"],
    kind: "target",
    tiers: {
      fda: fda(78),
      average: {
        type: "computed",
        rule: "fat-amdr",
        basis: "AMDR 20–35% of energy (25–35% ages 14–18)",
      },
      athletic: {
        type: "computed",
        rule: "fat-athletic",
        basis: "Energy remaining after protein and carbs, kept within 20–35%",
      },
    },
    ul: null,
    citation: `${DRI_MACRO}; ${SPORTS}; ${FDA_DV}`,
  },
  saturated_fat: {
    id: "saturated_fat",
    name: "Saturated fat",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["606"],
    kind: "limit",
    tiers: {
      fda: fda(20),
      average: { type: "computed", rule: "sat-fat-10pct", basis: "Less than 10% of energy" },
      athletic: { type: "computed", rule: "sat-fat-10pct", basis: "Less than 10% of energy" },
    },
    ul: null,
    citation: `${DGA}; ${FDA_DV}`,
  },
  trans_fat: {
    id: "trans_fat",
    name: "Trans fat",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["605"],
    kind: "limit",
    tiers: none(
      "No numeric limit is set. NASEM advises keeping intake as low as possible while eating a nutritionally adequate diet.",
    ),
    ul: null,
    citation: DRI_MACRO,
  },
  mufa: {
    id: "mufa",
    name: "Monounsaturated fat",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["645"],
    kind: "target",
    tiers: none(
      "No FDA Daily Value or DRI exists for monounsaturated fat; tracked for information only.",
    ),
    ul: null,
    citation: DRI_MACRO,
  },
  pufa: {
    id: "pufa",
    name: "Polyunsaturated fat",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["646"],
    kind: "target",
    tiers: none(
      "No FDA Daily Value or DRI exists for total polyunsaturated fat; see omega-3 ALA and omega-6 linoleic acid.",
    ),
    ul: null,
    citation: DRI_MACRO,
  },
  ala: {
    id: "ala",
    name: "Omega-3 (ALA)",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["851", "619"],
    kind: "target",
    tiers: (() => {
      const table = dri(
        [1.6, 1.6, 1.6, 1.6, 1.6],
        [1.1, 1.1, 1.1, 1.1, 1.1],
        [1.4, 1.4, 1.4],
        [1.3, 1.3, 1.3],
      );
      return {
        fda: {
          type: "dri",
          table,
          basis: "AI",
          note: "FDA sets no Daily Value; uses the NASEM AI.",
        },
        average: { type: "dri", table, basis: "AI" },
        athletic: { type: "dri", table, basis: "AI" },
      } satisfies Record<Tier, TierValue>;
    })(),
    ul: null,
    citation: DRI_MACRO,
    note: "Fallback FDC number 619 (total 18:3) is used when a food does not report ALA separately.",
  },
  linoleic_acid: {
    id: "linoleic_acid",
    name: "Omega-6 (linoleic acid)",
    category: "macro",
    unit: "g",
    fdcUnit: "G",
    fdcNumbers: ["675", "618"],
    kind: "target",
    tiers: (() => {
      const table = dri([16, 17, 17, 14, 14], [11, 12, 12, 11, 11], [13, 13, 13], [13, 13, 13]);
      return {
        fda: {
          type: "dri",
          table,
          basis: "AI",
          note: "FDA sets no Daily Value; uses the NASEM AI.",
        },
        average: { type: "dri", table, basis: "AI" },
        athletic: { type: "dri", table, basis: "AI" },
      } satisfies Record<Tier, TierValue>;
    })(),
    ul: null,
    citation: DRI_MACRO,
    note: "Fallback FDC number 618 (total 18:2) is used when a food does not report linoleic acid separately.",
  },
  cholesterol: {
    id: "cholesterol",
    name: "Cholesterol",
    category: "macro",
    unit: "mg",
    fdcUnit: "MG",
    fdcNumbers: ["601"],
    kind: "limit",
    tiers: {
      fda: fda(300),
      average: {
        type: "none",
        reason:
          "No numeric limit is set. NASEM advises keeping intake as low as possible while eating a nutritionally adequate diet.",
      },
      athletic: {
        type: "none",
        reason:
          "No numeric limit is set. NASEM advises keeping intake as low as possible while eating a nutritionally adequate diet.",
      },
    },
    ul: null,
    citation: `${DRI_MACRO}; ${FDA_DV}`,
  },
  water: {
    id: "water",
    name: "Water",
    category: "macro",
    unit: "mL",
    fdcUnit: "G",
    fdcNumbers: ["255"],
    kind: "target",
    tiers: (() => {
      const table = dri(
        [3300, 3700, 3700, 3700, 3700],
        [2300, 2700, 2700, 2700, 2700],
        [3000, 3000, 3000],
        [3800, 3800, 3800],
      );
      return {
        fda: {
          type: "dri",
          table,
          basis: "AI",
          note: "FDA sets no Daily Value; uses the NASEM AI.",
        },
        average: { type: "dri", table, basis: "AI" },
        athletic: {
          type: "computed",
          rule: "water-athletic",
          basis: "AI plus 1.5 L per kg of sweat loss",
        },
      } satisfies Record<Tier, TierValue>;
    })(),
    ul: null,
    citation: `${DRI_WATER}; ACSM position stand: Exercise and fluid replacement. Med Sci Sports Exerc. 2007;39(2):377-390`,
    note: "AI is total water from drinks and food. FDC reports water in grams; 1 g = 1 mL.",
  },
};

export const NUTRIENT_LIST: readonly NutrientDefinition[] = NUTRIENT_IDS.map((id) => NUTRIENTS[id]);

export function getNutrient(id: NutrientId): NutrientDefinition {
  return NUTRIENTS[id];
}

export function isNutrientId(value: string): value is NutrientId {
  return (NUTRIENT_IDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Life-stage lookups
// ---------------------------------------------------------------------------

export const MIN_AGE = 14;

export function ageBand(age: number): AgeBand {
  if (!Number.isFinite(age) || age < MIN_AGE) {
    throw new RangeError(`Age must be ${MIN_AGE} or older (got ${age}).`);
  }
  if (age < 19) return "14-18";
  if (age < 31) return "19-30";
  if (age < 51) return "31-50";
  if (age < 71) return "51-70";
  return "71+";
}

export function reproBand(age: number): ReproBand {
  const band = ageBand(age);
  if (band === "14-18" || band === "19-30") return band;
  // DRI tables stop at 50 for pregnancy/lactation; older ages use the 31-50 values.
  return "31-50";
}

export function lookupDri(
  table: DriTable,
  sex: Sex,
  age: number,
  lifeStage: LifeStage = "none",
): number {
  if (sex === "female" && lifeStage !== "none") {
    return table[lifeStage][reproBand(age)];
  }
  return table[sex][ageBand(age)];
}
