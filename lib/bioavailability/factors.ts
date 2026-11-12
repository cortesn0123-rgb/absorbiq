/**
 * Absorption factors: every number the bioavailability engine uses, with a low–high range and
 * a source. This file seeds the absorption_factors table (see scripts/absorption-seed.ts); at
 * runtime the engine uses the database rows, falling back to these values for missing rows.
 *
 * Conventions
 * - For absorption fractions and multipliers, `low` gives the lowest plausible absorption and
 *   `high` the highest.
 * - For quantities that are not absorption fractions (phytate content, thresholds, curve
 *   constants), `low`/`high` are the plausible range of that quantity; the engine knows which
 *   direction lowers absorption.
 * - Keys ending in ":<number>" are points on a curve, interpolated by the engine.
 * - When a source gives a single value, low = high = value unless noted.
 *
 * Plain-English explanations of every rule are in docs/bioavailability.md.
 */

export interface FactorRow {
  nutrient: string;
  key: string;
  value: number;
  low: number;
  high: number;
  description: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const MONSEN_1978 =
  "Monsen ER et al. Estimation of available dietary iron. Am J Clin Nutr 1978;31:134-41";
const MONSEN_BALINTFY_1982 =
  "Monsen ER, Balintfy JL. Calculating dietary iron bioavailability: refinement and computerization. J Am Diet Assoc 1982;80:307-11";
const HALLBERG_1989 =
  "Hallberg L, Brune M, Rossander L. Iron absorption in man: ascorbic acid and dose-dependent inhibition by phytate. Am J Clin Nutr 1989;49:140-4";
const HALLBERG_1991 =
  "Hallberg L et al. Calcium: effect of different amounts on nonheme- and heme-iron absorption in humans. Am J Clin Nutr 1991;53:112-9";
const HALLBERG_ROSSANDER_1982 =
  "Hallberg L, Rossander L. Effect of different drinks on the absorption of non-heme iron from composite meals. Hum Nutr Appl Nutr 1982;36:116-23";
const MORCK_1983 =
  "Morck TA, Lynch SR, Cook JD. Inhibition of food iron absorption by coffee. Am J Clin Nutr 1983;37:416-20";
const TSENG_1997 =
  "Tseng M et al. Adjustment of iron intake for dietary enhancers and inhibitors in population studies. J Nutr 1997;127:1456-68";
const FAO_WHO_2004_ZINC =
  "FAO/WHO. Vitamin and mineral requirements in human nutrition, 2nd ed. (2004), ch. 12 Zinc, Tables 54-55";
const ODS = (sheet: string) =>
  `NIH Office of Dietary Supplements, ${sheet} Fact Sheet for Health Professionals`;
const DTU_PHYTATE =
  "DTU Food. Phytate - a natural component in plant food (2011); Schlemmer U et al. Phytate in foods and significance for humans. Mol Nutr Food Res 2009;53:S330-75";
const WEAVER_1999 =
  "Weaver CM, Proulx WR, Heaney R. Choices for achieving adequate dietary calcium with a vegetarian diet. Am J Clin Nutr 1999;70(suppl):543S-8S";
const BROWN_2004 =
  "Brown MJ et al. Carotenoid bioavailability is higher from salads ingested with full-fat than with fat-reduced salad dressings. Am J Clin Nutr 2004;80:396-403";
const DAWSON_HUGHES_2015 =
  "Dawson-Hughes B et al. Dietary fat increases vitamin D-3 absorption. J Acad Nutr Diet 2015;115:225-30";
const BRUNO_2006 =
  "Bruno RS et al. Human vitamin E requirements assessed with the use of apples fortified with deuterium-labeled alpha-tocopheryl acetate. Am J Clin Nutr 2006;83:299-304";
const GIJSBERS_1996 =
  "Gijsbers BL, Jie KS, Vermeer C. Effect of food composition on vitamin K absorption in human volunteers. Br J Nutr 1996;76:223-9";
const WHO_2007_PROTEIN =
  "WHO/FAO/UNU. Protein and amino acid requirements in human nutrition. WHO Technical Report Series 935 (2007), Table 5: true digestibility of protein in humans";
const MERRILL_WATT =
  "Merrill AL, Watt BK. Energy value of foods: basis and derivation. USDA Agriculture Handbook No. 74 (1955, rev. 1973): Atwater mixed-diet digestibility coefficients";
const BOSNER_1999 =
  "Bosner MS et al. Percent cholesterol absorption in normal women and men quantified with dual stable isotopic tracers. J Lipid Res 1999;40:302-8";
const NASEM_NA_K =
  "NASEM. Dietary Reference Intakes for Sodium and Potassium (2019): about 98% of sodium and chloride is absorbed";
const ASSUMPTION = "Modelling assumption (see docs/bioavailability.md)";

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const fixed = (
  nutrient: string,
  key: string,
  value: number,
  description: string,
  source: string,
): FactorRow => ({ nutrient, key, value, low: value, high: value, description, source });

export const FACTOR_ROWS: readonly FactorRow[] = [
  // ----- Iron: heme ---------------------------------------------------------
  fixed(
    "iron",
    "heme_share",
    0.4,
    "Share of the iron in meat, poultry and fish that is heme iron.",
    `${MONSEN_1978}`,
  ),
  {
    nutrient: "iron",
    key: "heme_absorption",
    value: 0.23,
    low: 0.15,
    high: 0.35,
    description:
      "Fraction of heme iron absorbed: 23% at 500 mg iron stores; 15% (1000 mg stores) to 35% (no stores).",
    source: MONSEN_1978,
  },
  // ----- Iron: non-heme, enhancers (Monsen & Balintfy) ----------------------
  fixed(
    "iron",
    "nonheme_base",
    0.03,
    "Non-heme iron absorbed from a meal with no enhancers (500 mg iron stores).",
    MONSEN_BALINTFY_1982,
  ),
  fixed(
    "iron",
    "nonheme_ef_slope",
    0.0893,
    "Slope of the enhancer curve: absorption = base + slope x ln((EF + 100) / 100), EF = mg vitamin C + g meat/fish/poultry.",
    MONSEN_BALINTFY_1982,
  ),
  fixed(
    "iron",
    "nonheme_ef_cap",
    75,
    "Enhancing-factor units (mg vitamin C + g meat/fish/poultry) above which absorption no longer rises (8%).",
    MONSEN_BALINTFY_1982,
  ),
  {
    nutrient: "iron",
    key: "nonheme_store_scale",
    value: 1,
    low: 0.65,
    high: 1.52,
    description:
      "Scales non-heme absorption for iron status, using the same ratios as heme (15/23 and 35/23) because iron status is not known.",
    source: `${MONSEN_1978}; ${ASSUMPTION}`,
  },
  {
    nutrient: "iron",
    key: "mfp_grams_per_g_protein",
    value: 4,
    low: 3.3,
    high: 5,
    description:
      "Grams of cooked meat, poultry or fish per gram of protein (cooked lean meats are about 20-30% protein), used to estimate the meat content of mixed dishes.",
    source: `USDA FoodData Central SR Legacy cooked meats; ${ASSUMPTION}`,
  },
  // ----- Iron: non-heme, inhibitors -----------------------------------------
  fixed(
    "iron",
    "phytate_p_share",
    0.2816,
    "Phosphorus share of phytic acid by mass (6 x 30.97 / 660.04), to convert phytate to phytate phosphorus.",
    "Phytic acid formula C6H18O24P6 (molar mass 660.04 g/mol)",
  ),
  fixed(
    "iron",
    "phytate_p_mg:0",
    1,
    "Non-heme iron absorption remaining with no phytate.",
    HALLBERG_1989,
  ),
  fixed(
    "iron",
    "phytate_p_mg:2",
    0.82,
    "Non-heme iron absorption remaining with 2 mg phytate phosphorus (18% lower).",
    HALLBERG_1989,
  ),
  fixed(
    "iron",
    "phytate_p_mg:25",
    0.36,
    "Non-heme iron absorption remaining with 25 mg phytate phosphorus (64% lower).",
    HALLBERG_1989,
  ),
  fixed(
    "iron",
    "phytate_p_mg:250",
    0.18,
    "Non-heme iron absorption remaining with 250 mg phytate phosphorus (82% lower).",
    HALLBERG_1989,
  ),
  {
    nutrient: "iron",
    key: "tea_remaining",
    value: 0.38,
    low: 0.36,
    high: 0.38,
    description: "Non-heme iron absorption remaining when tea is drunk with a meal (62-64% lower).",
    source: `${HALLBERG_ROSSANDER_1982}; ${MORCK_1983}`,
  },
  {
    nutrient: "iron",
    key: "coffee_remaining",
    value: 0.63,
    low: 0.61,
    high: 0.65,
    description:
      "Non-heme iron absorption remaining when coffee is drunk with a meal (35-39% lower).",
    source: `${HALLBERG_ROSSANDER_1982}; ${MORCK_1983}`,
  },
  fixed(
    "iron",
    "drink_reference_g",
    200,
    "A cup of tea or coffee (g). Smaller amounts have a proportionally smaller effect.",
    ASSUMPTION,
  ),
  fixed(
    "iron",
    "calcium_mg:0",
    1,
    "Non-heme iron absorption remaining with no calcium in the meal.",
    HALLBERG_1991,
  ),
  {
    nutrient: "iron",
    key: "calcium_mg:165",
    value: 0.45,
    low: 0.4,
    high: 0.5,
    description:
      "Non-heme iron absorption remaining with 165 mg calcium in the meal (50-60% lower); the effect is dose-related up to about 300 mg.",
    source: HALLBERG_1991,
  },
  {
    nutrient: "iron",
    key: "calcium_mg:600",
    value: 0.45,
    low: 0.4,
    high: 0.5,
    description:
      "Non-heme iron absorption remaining with 300-600 mg calcium in the meal (50-60% lower, a plateau).",
    source: HALLBERG_1991,
  },

  // ----- Phytate content estimates (mg phytic acid per 100 g dry matter) ----
  fixed("phytate", "mg_per_100g_dry:none", 0, "No phytate.", ASSUMPTION),
  {
    nutrient: "phytate",
    key: "mg_per_100g_dry:high",
    value: 1200,
    low: 500,
    high: 2900,
    description:
      "Phytic acid in high-phytate foods (legumes, nuts, seeds, bran), per 100 g dry matter. Legumes range 0.2-2.9%.",
    source: DTU_PHYTATE,
  },
  {
    nutrient: "phytate",
    key: "mg_per_100g_dry:medium",
    value: 1000,
    low: 500,
    high: 2200,
    description:
      "Phytic acid in whole grains, per 100 g dry matter. Cereals are typically about 1% (range 0.06-2.2%).",
    source: DTU_PHYTATE,
  },
  {
    nutrient: "phytate",
    key: "mg_per_100g_dry:low",
    value: 150,
    low: 60,
    high: 400,
    description:
      "Phytic acid in refined grains, per 100 g dry matter: the low end of the cereal range.",
    source: `${DTU_PHYTATE}; ${ASSUMPTION}`,
  },

  // ----- Zinc ---------------------------------------------------------------
  fixed(
    "zinc",
    "ratio_cutoff_high",
    5,
    "Phytate:zinc molar ratio below which zinc bioavailability is high.",
    FAO_WHO_2004_ZINC,
  ),
  fixed(
    "zinc",
    "ratio_cutoff_low",
    15,
    "Phytate:zinc molar ratio above which zinc bioavailability is low.",
    FAO_WHO_2004_ZINC,
  ),
  {
    nutrient: "zinc",
    key: "absorption_high",
    value: 0.5,
    low: 0.3,
    high: 0.5,
    description: "Zinc absorbed when the phytate:zinc molar ratio is under 5.",
    source: `${FAO_WHO_2004_ZINC}; ${ODS("Zinc")} (5% to more than 50%)`,
  },
  {
    nutrient: "zinc",
    key: "absorption_moderate",
    value: 0.3,
    low: 0.15,
    high: 0.5,
    description: "Zinc absorbed when the phytate:zinc molar ratio is 5-15.",
    source: `${FAO_WHO_2004_ZINC}; ${ODS("Zinc")}`,
  },
  {
    nutrient: "zinc",
    key: "absorption_low",
    value: 0.15,
    low: 0.05,
    high: 0.3,
    description: "Zinc absorbed when the phytate:zinc molar ratio is over 15.",
    source: `${FAO_WHO_2004_ZINC}; ${ODS("Zinc")}`,
  },

  // ----- Calcium ------------------------------------------------------------
  {
    nutrient: "calcium",
    key: "high_oxalate",
    value: 0.05,
    low: 0.05,
    high: 0.05,
    description: "Calcium absorbed from high-oxalate greens such as spinach (about 5%).",
    source: `${ODS("Calcium")}; ${WEAVER_1999} (spinach 5.1%)`,
  },
  {
    nutrient: "calcium",
    key: "low_oxalate_greens",
    value: 0.53,
    low: 0.49,
    high: 0.61,
    description: "Calcium absorbed from low-oxalate greens: kale 49%, bok choy 54%, broccoli 61%.",
    source: WEAVER_1999,
  },
  {
    nutrient: "calcium",
    key: "dairy",
    value: 0.3,
    low: 0.27,
    high: 0.32,
    description: "Calcium absorbed from dairy foods (about 30%; milk 27-32%).",
    source: `${ODS("Calcium")}; ${WEAVER_1999}`,
  },
  {
    nutrient: "calcium",
    key: "fortified",
    value: 0.3,
    low: 0.27,
    high: 0.32,
    description: "Calcium absorbed from fortified foods (about 30%, similar to dairy).",
    source: ODS("Calcium"),
  },
  {
    nutrient: "calcium",
    key: "high_phytate_legumes",
    value: 0.24,
    low: 0.22,
    high: 0.27,
    description: "Calcium absorbed from beans and other high-phytate legumes (22-27%).",
    source: WEAVER_1999,
  },
  {
    nutrient: "calcium",
    key: "default",
    value: 0.25,
    low: 0.15,
    high: 0.45,
    description:
      "Calcium absorbed from other foods: about 25% for adults; 45% at low intakes, 15% at very high intakes.",
    source: ODS("Calcium"),
  },

  // ----- Fat-soluble vitamins -----------------------------------------------
  {
    nutrient: "fat_soluble",
    key: "adequate_fat_g",
    value: 5,
    low: 3,
    high: 5,
    description:
      "Grams of fat in a meal at which fat-soluble vitamin absorption is no longer limited by fat. Below it, the low-fat multiplier is phased in linearly.",
    source: `${BROWN_2004}; ${ASSUMPTION}`,
  },
  fixed(
    "vitamin_a",
    "rae",
    1,
    "Vitamin A is reported by USDA as RAE, which already accounts for absorption and carotenoid conversion; no further factor is applied.",
    `${ODS("Vitamin A")}; USDA FoodData Central nutrient 320 (RAE)`,
  ),
  {
    nutrient: "vitamin_a",
    key: "provitamin_low_fat",
    value: 0.1,
    low: 0,
    high: 0.3,
    description:
      "Multiplier on vitamin A from carotenoids when a meal has almost no fat: absorption was negligible with fat-free dressing.",
    source: `${BROWN_2004}; ${ASSUMPTION} (exact value)`,
  },
  fixed(
    "vitamin_d",
    "base",
    1,
    "Vitamin D in food is well absorbed; no reliable fractional figure exists, so it is counted as eaten when fat is present.",
    ODS("Vitamin D"),
  ),
  {
    nutrient: "vitamin_d",
    key: "low_fat",
    value: 0.76,
    low: 0.66,
    high: 0.9,
    description:
      "Multiplier on vitamin D with a fat-free meal: blood levels peaked 32% (11-52%) higher with a fat-containing meal.",
    source: DAWSON_HUGHES_2015,
  },
  {
    nutrient: "vitamin_e",
    key: "base",
    value: 0.33,
    low: 0.28,
    high: 0.38,
    description: "Vitamin E (alpha-tocopherol) absorbed with a meal containing fat (33 +/- 5%).",
    source: BRUNO_2006,
  },
  {
    nutrient: "vitamin_e",
    key: "low_fat",
    value: 0.3,
    low: 0.18,
    high: 0.42,
    description:
      "Multiplier on vitamin E with a fat-free meal: 10 +/- 4% absorbed vs 33% with fat.",
    source: BRUNO_2006,
  },
  {
    nutrient: "vitamin_k",
    key: "base",
    value: 0.1,
    low: 0.03,
    high: 0.14,
    description:
      "Vitamin K (phylloquinone) absorbed from foods: free phylloquinone is about 80% absorbed, and food phylloquinone 4-17% as well as a tablet.",
    source: `${ODS("Vitamin K")}; ${GIJSBERS_1996}`,
  },
  fixed(
    "vitamin_k",
    "low_fat",
    0.31,
    "Multiplier on vitamin K with no fat: spinach alone gave 4% of a tablet's absorption vs 13% with butter.",
    GIJSBERS_1996,
  ),

  // ----- Vitamin B12 (per meal, saturating) ---------------------------------
  {
    nutrient: "vitamin_b12",
    key: "active_capacity_ug",
    value: 1.5,
    low: 1,
    high: 2,
    description:
      "Most B12 absorbed per meal through intrinsic factor, which is saturated at about 1-2 mcg.",
    source: ODS("Vitamin B12"),
  },
  fixed(
    "vitamin_b12",
    "half_saturation_ug",
    2.06,
    "Dose (mcg) at which intrinsic-factor absorption is half its maximum; set so that about 50% of a 1 mcg dose is absorbed.",
    `${ODS("Vitamin B12")} (about 50% at doses under 1-2 mcg); ${ASSUMPTION} (curve shape)`,
  ),
  {
    nutrient: "vitamin_b12",
    key: "passive_fraction",
    value: 0.01,
    low: 0.01,
    high: 0.02,
    description:
      "Fraction of B12 absorbed by passive diffusion, independent of intrinsic factor (about 1-2%).",
    source: `${ODS("Vitamin B12")} (2% at 500 mcg, 1.3% at 1000 mcg)`,
  },

  // ----- Vitamin C (per meal, dose-dependent) -------------------------------
  {
    nutrient: "vitamin_c",
    key: "dose_mg:0",
    value: 0.8,
    low: 0.7,
    high: 0.9,
    description: "Vitamin C absorbed at moderate intakes (70-90%).",
    source: ODS("Vitamin C"),
  },
  {
    nutrient: "vitamin_c",
    key: "dose_mg:180",
    value: 0.8,
    low: 0.7,
    high: 0.9,
    description: "Vitamin C absorbed at up to 180 mg (70-90%).",
    source: ODS("Vitamin C"),
  },
  {
    nutrient: "vitamin_c",
    key: "dose_mg:1000",
    value: 0.45,
    low: 0.3,
    high: 0.5,
    description: "Vitamin C absorbed at doses above 1 g: less than 50%.",
    source: `${ODS("Vitamin C")}; ${ASSUMPTION} (low end)`,
  },

  // ----- Copper (depends on the day's intake) -------------------------------
  fixed(
    "copper",
    "daily_mg:0.4",
    0.75,
    "Copper absorbed when the diet has 0.4 mg/day.",
    ODS("Copper"),
  ),
  fixed(
    "copper",
    "daily_mg:7.5",
    0.12,
    "Copper absorbed when the diet has 7.5 mg/day.",
    ODS("Copper"),
  ),

  // ----- Other micronutrients: one baseline factor --------------------------
  {
    nutrient: "magnesium",
    key: "base",
    value: 0.35,
    low: 0.3,
    high: 0.4,
    description: "Magnesium absorbed from food (30-40%).",
    source: ODS("Magnesium"),
  },
  {
    nutrient: "potassium",
    key: "base",
    value: 0.875,
    low: 0.85,
    high: 0.9,
    description: "Potassium absorbed from food (85-90%).",
    source: ODS("Potassium"),
  },
  {
    nutrient: "phosphorus",
    key: "base",
    value: 0.55,
    low: 0.4,
    high: 0.7,
    description: "Phosphorus absorbed from food (40-70%; higher from animal foods).",
    source: ODS("Phosphorus"),
  },
  {
    nutrient: "chromium",
    key: "base",
    value: 0.0145,
    low: 0.004,
    high: 0.025,
    description: "Chromium absorbed from food (0.4-2.5%).",
    source: ODS("Chromium"),
  },
  {
    nutrient: "manganese",
    key: "base",
    value: 0.03,
    low: 0.01,
    high: 0.05,
    description: "Manganese absorbed from food (1-5%).",
    source: ODS("Manganese"),
  },
  {
    nutrient: "molybdenum",
    key: "base",
    value: 0.7,
    low: 0.4,
    high: 1,
    description: "Molybdenum absorbed from food (40-100%).",
    source: ODS("Molybdenum"),
  },
  {
    nutrient: "iodine",
    key: "base",
    value: 0.96,
    low: 0.96,
    high: 1,
    description: "Iodine is absorbed almost completely (96% of potassium iodide).",
    source: ODS("Iodine"),
  },
  fixed(
    "selenium",
    "base",
    0.9,
    "Selenium absorbed from food forms such as selenomethionine (up to about 90%).",
    ODS("Selenium"),
  ),
  fixed("sodium", "base", 0.98, "Sodium absorbed (about 98%).", NASEM_NA_K),
  fixed("chloride", "base", 0.98, "Chloride absorbed (about 98%).", NASEM_NA_K),
  fixed(
    "riboflavin",
    "base",
    0.95,
    "Riboflavin absorbed from food (about 95%, up to about 27 mg per meal).",
    ODS("Riboflavin"),
  ),
  fixed(
    "vitamin_b6",
    "base",
    0.75,
    "Vitamin B6 absorbed from a mixed diet (about 75%).",
    ODS("Vitamin B6"),
  ),
  {
    nutrient: "pantothenic_acid",
    key: "base",
    value: 0.5,
    low: 0.4,
    high: 0.61,
    description: "Pantothenic acid absorbed from food (40-61%, about half).",
    source: ODS("Pantothenic Acid"),
  },
  fixed(
    "niacin",
    "grains",
    0.3,
    "Niacin naturally present in grains is mostly bound and only about 30% available.",
    ODS("Niacin"),
  ),
  fixed(
    "niacin",
    "base",
    1,
    "Niacin in other foods (and added niacin) is almost completely absorbed.",
    ODS("Niacin"),
  ),
  fixed(
    "thiamin",
    "base",
    1,
    "Thiamin is actively absorbed at food doses; no fractional figure is published, so it is counted as eaten.",
    ODS("Thiamin"),
  ),
  fixed("biotin", "base", 1, "Free biotin is absorbed completely.", ODS("Biotin")),
  fixed(
    "choline",
    "base",
    1,
    "No estimate of choline absorption exists, so it is counted as eaten.",
    ODS("Choline"),
  ),
  fixed(
    "folate",
    "dfe",
    1,
    "Folate is reported by USDA as DFE, which already accounts for the higher absorption of folic acid; no further factor is applied.",
    `${ODS("Folate")}; USDA FoodData Central nutrient 435 (DFE)`,
  ),

  // ----- Macros -------------------------------------------------------------
  fixed("protein", "egg", 0.97, "Protein digestibility: egg.", WHO_2007_PROTEIN),
  fixed("protein", "dairy", 0.95, "Protein digestibility: milk, cheese.", WHO_2007_PROTEIN),
  fixed("protein", "meat", 0.94, "Protein digestibility: meat.", WHO_2007_PROTEIN),
  fixed("protein", "fish", 0.94, "Protein digestibility: fish.", WHO_2007_PROTEIN),
  {
    nutrient: "protein",
    key: "soy",
    value: 0.9,
    low: 0.86,
    high: 0.95,
    description: "Protein digestibility: soy (soy flour 86%, soy protein isolate 95%).",
    source: WHO_2007_PROTEIN,
  },
  {
    nutrient: "protein",
    key: "legume",
    value: 0.78,
    low: 0.78,
    high: 0.88,
    description: "Protein digestibility: beans 78%, mature peas 88%.",
    source: WHO_2007_PROTEIN,
  },
  {
    nutrient: "protein",
    key: "nut_seed",
    value: 0.94,
    low: 0.9,
    high: 0.95,
    description: "Protein digestibility: peanuts 94%, peanut butter 95%, sunflower seed flour 90%.",
    source: WHO_2007_PROTEIN,
  },
  {
    nutrient: "protein",
    key: "grain",
    value: 0.86,
    low: 0.7,
    high: 0.99,
    description:
      "Protein digestibility: whole wheat and oatmeal 86%, polished rice 88%, refined wheat 96%, corn cereal 70%.",
    source: WHO_2007_PROTEIN,
  },
  {
    nutrient: "protein",
    key: "default",
    value: 0.92,
    low: 0.77,
    high: 0.96,
    description:
      "Protein digestibility for other foods: the Atwater mixed-diet coefficient (92%); measured mixed diets range 77-96%.",
    source: `${MERRILL_WATT}; ${WHO_2007_PROTEIN}`,
  },
  {
    nutrient: "fat",
    key: "base",
    value: 0.95,
    low: 0.9,
    high: 0.95,
    description: "Fat digestibility (95% for a mixed diet; 90-95% across foods).",
    source: MERRILL_WATT,
  },
  fixed(
    "carbohydrate",
    "base",
    0.97,
    "Digestibility of carbohydrate other than fiber (97% for a mixed diet).",
    MERRILL_WATT,
  ),
  fixed(
    "energy",
    "base",
    1,
    "USDA calories use Atwater factors, which already allow for digestibility; no further factor is applied.",
    MERRILL_WATT,
  ),
  {
    nutrient: "cholesterol",
    key: "base",
    value: 0.55,
    low: 0.41,
    high: 0.7,
    description: "Cholesterol absorbed (women 53%, men 58%, SD about 12%).",
    source: BOSNER_1999,
  },
];

/** Cited in docs/bioavailability.md for applying inhibitors on top of the Monsen model. */
export const IRON_MODEL_PRECEDENT = TSENG_1997;
