# How absorption is estimated

The app shows two amounts for every nutrient: what you **ate** (consumed) and an estimate of
what your body **absorbed**. This page explains every rule, every number and where each number
comes from.

All of the calculation lives in `lib/bioavailability` (pure TypeScript, no database or network
calls). Every number is a row in `lib/bioavailability/factors.ts`, which seeds the
`absorption_factors` table. At runtime the app reads the table, so a factor can be changed
there without a code change. Results are never stored: they are recalculated from your food
logs every time you look, so a changed factor also applies to past days.

> These are **estimates**. Absorption varies a lot between people (genes, health, iron stores,
> gut function) and between meals. Every absorbed value is shown as "~X" with a low–high
> range, and tapping it lists the reasons. The app is informational, not medical advice.

## How the engine works

1. **One meal at a time.** Breakfast, lunch and dinner are one meal each; every snack is its own
   meal. Absorption of a food depends on everything else in the **same** meal (for example
   orange juice at lunch helps the iron in lunch's lentils, not dinner's).
2. For each meal the engine adds up what the whole meal contains: vitamin C, meat/fish/poultry,
   phytate, calcium, fat, tea, coffee, zinc and B12.
3. Each nutrient in each food goes through its rule (below). Each rule is computed three times:
   with central values, and with the values that give the lowest and highest plausible
   absorption. Those give "~X" and the range.
4. Meals are summed into the day.

Missing data stays missing. If FoodData Central has no value for a nutrient in a food, it shows
"no data", not zero, and totals note that some foods had no data.

### Inputs the engine uses

| Input                                                           | Where it comes from                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Nutrients per 100 g                                             | USDA FoodData Central (FDC), cached in `foods`                                              |
| Heme source, phytate level, oxalate level, fortified            | Tags set when a food is first cached (`lib/fdc/tag-rules.ts`)                               |
| Food group (meat, fish, dairy, legume, grain, tea, coffee, ...) | Worked out from the name and FDC category each time a food is read (`lib/fdc/tag-rules.ts`) |
| Retinol (preformed vitamin A)                                   | FDC nutrient 319                                                                            |
| Your age                                                        | Profile (optional). Adds age notes for calcium and B12                                      |

## Iron

Iron comes in two forms that are absorbed very differently.

**Heme iron** (in meat, poultry and fish). Following Monsen (1978), **40%** of the iron in meat,
poultry and fish is heme iron. It is absorbed at about **23%**, ranging from **15%** (large iron
stores) to **35%** (no iron stores). Other foods in the meal barely affect it.

**Non-heme iron** (all other iron, including the other 60% in meat) depends on the whole meal.
We use the **Hallberg & Hulthén (2000)** algorithm. It starts from the absorption of an
inhibitor-free meal and multiplies in one factor per component, so **each effect is counted
once**:

absorption = 22.1% × phytate × vitamin C × meat × calcium × egg × soy × tea × coffee × iron status

- **Starting point: 22.1%**, the absorption from a wheat roll with nothing that helps or hinders.
- **Phytate**: (1 + P)^−0.3, where P = mg phytate phosphorus (28.16% of phytic acid by weight).
  This gives 28% lower absorption at 2 mg, 62% at 25 mg and 81% at 250 mg. Hallberg et al. (1989)
  measured 18%, 64% and 82%.
- **Vitamin C**: 1 + 0.01 × C + 0.01 × log10(P + 1) × (C + 1)^0.8875, where C = mg vitamin C.
  Vitamin C raises absorption and, through the second term, offsets part of the phytate effect.
  50 mg raises absorption 1.5× with no phytate, or about 2× with 25 mg phytate phosphorus.
- **Meat, poultry, fish**: 1 + 0.00628 × M × (1 + 0.006 × P), where M = grams. 200 g of steak
  raises absorption about 2.3×. The grams of meat in a mixed dish (e.g. chicken soup) are
  estimated from its protein (4 g of food per g of protein, since cooked lean meat is 20–30%
  protein), capped at the dish's weight.
- **Calcium**: 0.4081 + 0.5919 / (1 + 10^(−2.919 × (2.022 − log10(Ca + 1)))), Ca in mg. This
  gives about 47% lower at 165 mg and 57% at 300 mg, levelling off at 59%. Hallberg et al. (1991)
  measured 50–60%.
- **Egg**: 1 − 0.27 per egg (50 g). It is held at one egg so the factor cannot go below zero
  (our assumption).
- **Soy protein**: 1 − 0.022 × g soy protein. It is held at 30 g so the factor cannot go below
  zero (our assumption).
- **Tea and coffee**: the algorithm has a polyphenol factor, but FoodData Central has no
  polyphenol data. Instead we use measured effects of a cup with a meal, each applied once: tea
  **62–64%** lower, coffee **35–39%** lower (Hallberg & Rossander 1982; Morck et al. 1983).
  Smaller amounts have a proportionally smaller effect (our assumption, with a cup taken as
  200 g).
- **Iron status**: the algorithm scales absorption by (23 / serum ferritin)^0.94. Your ferritin
  is not known, so the central estimate uses the algorithm's reference (23 µg/L, modest iron
  stores). The range uses the same ratios as heme iron (15/23 to 35/23), which corresponds to
  ferritin of about 36 down to 15 µg/L. With larger iron stores, absorption is lower.

The equations are as transcribed from the original (which has several errata) in Br J Nutr 2009
(PMID 19709447). We apply phytate and vitamin C as two factors whose product is the paper's
combined phytate–vitamin C term, so that with no vitamin C the term reduces to the phytate
factor.

**Check against measured meals.** A cup of cooked lentils alone comes out at about 5% non-heme
absorption (range roughly 2–10%). Measured legume meals are a few percent: 2.5% from a whole-bean
meal (Petry et al. 2010) and low absorption from lentil dal (DellaValle et al. 2015). The
estimate sits toward the upper end because legume polyphenols are not modelled. Adding a glass
of orange juice raises the lentils' iron absorption about 3×.

**Known limitations.** Polyphenols in foods other than tea and coffee (legumes, red wine, some
vegetables) are not modelled, so meals rich in them are estimated somewhat high. Alcohol (in
the algorithm) is not modelled because the nutrient registry does not track it. The algorithm's
calcium effect also applies to heme iron, which we do not model. Studies over weeks suggest the
body adapts and the calcium effect is smaller over time.

## Zinc

Zinc absorption depends on the meal's **phytate:zinc molar ratio** = (mg phytic acid ÷ 660.04)
÷ (mg zinc ÷ 65.38). FAO/WHO (2004) bands:

| Ratio   | Bioavailability | Absorbed (central) | Range  |
| ------- | --------------- | ------------------ | ------ |
| under 5 | high            | 50%                | 30–50% |
| 5–15    | moderate        | 30%                | 15–50% |
| over 15 | low             | 15%                | 5–30%  |

The ranges reach into the neighbouring bands, within the 5% to more than 50% that NIH ODS
reports for zinc from food. A cup of cooked lentils has a ratio of about 28, so about 15% of
its zinc is absorbed. A steak with no plant foods has no phytate, so about 50%.

## Phytate content

FoodData Central does not report phytate. Each food gets a phytate level when it is cached
(legumes, nuts, seeds and bran = high; whole grains = medium; refined grains = low; everything
else = none). The level maps to typical phytic acid per 100 g of **dry matter** (DTU Food 2011;
Schlemmer et al. 2009):

| Level  | mg per 100 g dry matter | Range    | Basis                                                         |
| ------ | ----------------------- | -------- | ------------------------------------------------------------- |
| high   | 1200                    | 500–2900 | legumes 0.2–2.9%                                              |
| medium | 1000                    | 500–2200 | cereals typically ~1% (0.06–2.2%)                             |
| low    | 150                     | 60–400   | low end of the cereal range (our estimate for refined grains) |
| none   | 0                       |          |                                                               |

The food's water content (from FDC) converts this to the food as eaten. Cooked lentils are 70%
water, so 1 cup (198 g) is estimated at about 720 mg phytic acid (range 300–1740 mg).

## Calcium

Calcium is absorbed differently from different foods. The first matching rule applies:

| Food                                                       | Absorbed | Range  | Source                                                          |
| ---------------------------------------------------------- | -------- | ------ | --------------------------------------------------------------- |
| High-oxalate greens (spinach, chard, beet greens, rhubarb) | 5%       |        | NIH ODS; Weaver 1999 (spinach 5.1%)                             |
| Low-oxalate greens (kale, bok choy, broccoli)              | 53%      | 49–61% | Weaver 1999 (kale 49%, bok choy 54%, broccoli 61%)              |
| Dairy                                                      | 30%      | 27–32% | NIH ODS (~30%; milk 27%); Weaver 1999 (milk 32%)                |
| Fortified foods                                            | 30%      | 27–32% | NIH ODS                                                         |
| High-phytate legumes and soy                               | 24%      | 22–27% | Weaver 1999 (beans 22–27%)                                      |
| Everything else                                            | 25%      | 15–45% | NIH ODS (~25% in adults; 45% at low intakes, 15% above 2 g/day) |

From age 51 the app notes that absorption declines with age (NIH ODS).

## Fat-soluble vitamins (A from carotenoids, D, E, K)

These need fat in the same meal. Below **5 g of fat** per meal the low-fat effect is phased in
linearly. At 0 g of fat the full multiplier below applies. The 5 g threshold is our assumption
based on salad studies (Brown 2004); the range uses 3–5 g.

| Vitamin                    | Absorbed with fat                                                        | Multiplier with no fat | Source                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Vitamin A from carotenoids | counted as reported (RAE)                                                | 0.10 (range 0–0.30)    | Brown 2004: negligible carotenoid absorption with fat-free dressing. The exact value is our assumption.    |
| Vitamin D                  | counted as eaten (no reliable fractional figure; NIH ODS: well absorbed) | 0.76 (0.66–0.90)       | Dawson-Hughes 2015: blood levels peaked 32% (11–52%) higher with a fat-containing meal                     |
| Vitamin E                  | 33% (28–38%)                                                             | 0.30 (0.18–0.42)       | Bruno 2006: 33% absorbed with fat, 10% without                                                             |
| Vitamin K                  | 10% (3–14%)                                                              | 0.31                   | NIH ODS (free phylloquinone ~80%, food 4–17% as much); Gijsbers 1996 (spinach alone 4% vs 13% with butter) |

Preformed vitamin A (retinol, from animal foods) is not reduced by low fat.

## Vitamin A and folate: no double conversion

USDA reports **vitamin A as RAE** (retinol activity equivalents) and **folate as DFE** (dietary
folate equivalents). Both units already include an absorption adjustment: RAE for converting
carotenoids, DFE for folic acid being absorbed better than food folate. The engine applies a
factor of **1.0** to both and says so in the reasons. The only extra adjustment is the low-fat
rule for the carotenoid part of vitamin A. Tests check that neither is ever converted twice.

RAE is split into retinol (FDC 319) and carotenoids (the rest). When FDC has no retinol value,
animal foods are treated as all retinol and plant foods as all carotenoids.

## Vitamin B12 (per meal)

B12 is absorbed through intrinsic factor, which is saturated at about **1–2 mcg per meal**
(NIH ODS). The model is:

absorbed = 1.5 × dose ÷ (2.06 + dose) + 1% × dose

- 1.5 mcg (range 1–2) is the most intrinsic factor can absorb per meal.
- 2.06 is set so that about 50% of a 1 mcg dose is absorbed (NIH ODS: about 50% at doses under
  1–2 mcg).
- 1% (range 1–2%) is passive diffusion. NIH ODS reports 2% absorbed at 500 mcg and 1.3% at
  1000 mcg; the model gives 1.3% at 500 mcg.

Because it is per meal, two meals with 2 mcg each give about 1.5 mcg absorbed, while one meal
with 4 mcg gives about 1.0 mcg. From age 51 the app notes that atrophic gastritis (8–9% of
adults 65 and older) lowers B12 absorption from food.

## Vitamin C (per meal)

NIH ODS: **70–90%** is absorbed at moderate intakes (30–180 mg), and **less than 50%** above
1 g. Up to 180 mg per meal we use 80% (70–90%); from 180 mg to 1000 mg it falls linearly to
45% (30–50%); above 1000 mg it stays at 45%. The 30% low end at 1 g is our assumption.

## Copper (per day)

NIH ODS: copper absorption depends on intake, from **75%** at 0.4 mg/day to **12%** at
7.5 mg/day. We interpolate on a log scale using the whole day's copper.

## Other vitamins and minerals

| Nutrient                                | Absorbed         | Range    | Source                                                       |
| --------------------------------------- | ---------------- | -------- | ------------------------------------------------------------ |
| Magnesium                               | 35%              | 30–40%   | NIH ODS                                                      |
| Potassium                               | 87.5%            | 85–90%   | NIH ODS                                                      |
| Phosphorus                              | 55%              | 40–70%   | NIH ODS                                                      |
| Chromium                                | 1.45%            | 0.4–2.5% | NIH ODS                                                      |
| Manganese                               | 3%               | 1–5%     | NIH ODS                                                      |
| Molybdenum                              | 70%              | 40–100%  | NIH ODS                                                      |
| Iodine                                  | 96%              | 96–100%  | NIH ODS ("almost completely"; 96.4% of potassium iodide)     |
| Selenium                                | 90%              |          | NIH ODS ("up to about 90%")                                  |
| Sodium, chloride                        | 98%              |          | NASEM 2019                                                   |
| Riboflavin                              | 95%              |          | NIH ODS (up to ~27 mg per meal)                              |
| Vitamin B6                              | 75%              |          | NIH ODS (mixed diet)                                         |
| Pantothenic acid                        | 50%              | 40–61%   | NIH ODS                                                      |
| Niacin in unfortified grains            | 30%              |          | NIH ODS (bound niacin)                                       |
| Niacin in other foods, and added niacin | 100%             |          | NIH ODS ("almost completely absorbed")                       |
| Thiamin, biotin, choline                | counted as eaten |          | NIH ODS (no published fraction, or complete for free biotin) |

Where a source gives a range, the central value is its midpoint. Where it gives one figure, the
range is that figure.

## Macros

- **Protein** = protein × true digestibility by food group, from WHO/FAO/UNU 2007 (TRS 935),
  Table 5. This is the digestibility part of PDCAAS. The amino-acid score is not applied,
  because the app tracks grams of protein, not protein quality.

  | Group          | Digestibility | Range  | WHO values                                                                     |
  | -------------- | ------------- | ------ | ------------------------------------------------------------------------------ |
  | Egg            | 97%           |        | egg 97                                                                         |
  | Dairy          | 95%           |        | milk, cheese 95                                                                |
  | Meat, fish     | 94%           |        | meat, fish 94                                                                  |
  | Soy            | 90%           | 86–95% | soy flour 86, isolate 95                                                       |
  | Legumes        | 78%           | 78–88% | beans 78, peas 88                                                              |
  | Nuts and seeds | 94%           | 90–95% | peanuts 94, peanut butter 95, sunflower 90                                     |
  | Grains         | 86%           | 70–99% | whole wheat and oatmeal 86, polished rice 88, refined wheat 96, corn cereal 70 |
  | Other          | 92%           | 77–96% | Atwater mixed diet 92 (Merrill & Watt); mixed diets 77–96                      |

- **Fat** and all fatty acids: **95%** (90–95%), the Atwater mixed-diet coefficient
  (Merrill & Watt).
- **Carbohydrate**: fiber is subtracted, then **97%** of the rest is absorbed (Atwater
  coefficient). Sugars and added sugars: 97%.
- **Calories** are counted as eaten. USDA calories use Atwater factors, which already allow for
  digestion, so applying digestibility again would double count.
- **Cholesterol**: **55%** (41–70%), from Bosner 1999 (women 53%, men 58%, SD about 12%).
- **Fiber** is not absorbed. It counts toward the fiber goal as eaten and is shown "as eaten".
- **Water** is counted as eaten.

## Sources

- Monsen ER et al. Estimation of available dietary iron. Am J Clin Nutr 1978;31:134-41.
- Hallberg L, Hulthén L. Prediction of dietary iron absorption: an algorithm for calculating
  absorption and bioavailability of dietary iron. Am J Clin Nutr 2000;71:1147-60. Equations as
  transcribed in: An algorithm to assess intestinal iron availability for use in dietary
  surveys. Br J Nutr 2009 (PMID 19709447).
- Petry N et al. Polyphenols and phytic acid contribute to the low iron bioavailability from
  common beans in young women. J Nutr 2010;140:1977-82.
- DellaValle DM et al. Iron absorption from an intrinsically labeled lentil meal is low but
  upregulated in women with poor iron status. J Nutr 2015.
- Hallberg L, Brune M, Rossander L. Iron absorption in man: ascorbic acid and dose-dependent
  inhibition by phytate. Am J Clin Nutr 1989;49:140-4.
- Siegenberg D et al. Ascorbic acid prevents the dose-dependent inhibitory effects of
  polyphenols and phytates on nonheme-iron absorption. Am J Clin Nutr 1991;53:537-41.
- Hallberg L et al. Calcium: effect of different amounts on nonheme- and heme-iron absorption
  in humans. Am J Clin Nutr 1991;53:112-9.
- Hallberg L, Rossander L. Effect of different drinks on the absorption of non-heme iron from
  composite meals. Hum Nutr Appl Nutr 1982;36:116-23.
- Morck TA, Lynch SR, Cook JD. Inhibition of food iron absorption by coffee. Am J Clin Nutr
  1983;37:416-20.
- FAO/WHO. Vitamin and mineral requirements in human nutrition, 2nd ed. 2004, ch. 12 (Zinc).
- DTU Food. Phytate – a natural component in plant food. 2011. Schlemmer U et al. Phytate in
  foods and significance for humans. Mol Nutr Food Res 2009;53:S330-75.
- Weaver CM, Proulx WR, Heaney R. Choices for achieving adequate dietary calcium with a
  vegetarian diet. Am J Clin Nutr 1999;70(suppl):543S-8S.
- Brown MJ et al. Carotenoid bioavailability is higher from salads ingested with full-fat than
  with fat-reduced salad dressings. Am J Clin Nutr 2004;80:396-403.
- Dawson-Hughes B et al. Dietary fat increases vitamin D-3 absorption. J Acad Nutr Diet
  2015;115:225-30.
- Bruno RS et al. Human vitamin E requirements assessed with the use of apples fortified with
  deuterium-labeled alpha-tocopheryl acetate. Am J Clin Nutr 2006;83:299-304.
- Gijsbers BL, Jie KS, Vermeer C. Effect of food composition on vitamin K absorption in human
  volunteers. Br J Nutr 1996;76:223-9.
- WHO/FAO/UNU. Protein and amino acid requirements in human nutrition. WHO Technical Report
  Series 935, 2007.
- Merrill AL, Watt BK. Energy value of foods: basis and derivation. USDA Agriculture Handbook
  No. 74, 1955 (rev. 1973).
- Bosner MS et al. Percent cholesterol absorption in normal women and men quantified with dual
  stable isotopic tracers. J Lipid Res 1999;40:302-8.
- NASEM. Dietary Reference Intakes for Sodium and Potassium. 2019.
- NIH Office of Dietary Supplements, Fact Sheets for Health Professionals: Biotin, Calcium,
  Choline, Chromium, Copper, Folate, Iodine, Iron, Magnesium, Manganese, Molybdenum, Niacin,
  Pantothenic Acid, Phosphorus, Potassium, Riboflavin, Selenium, Thiamin, Vitamin A,
  Vitamin B6, Vitamin B12, Vitamin C, Vitamin D, Vitamin K, Zinc.

## Goals and the absorption score

Goals (FDA Daily Values, DRIs, Dietary Guidelines limits) are kept exactly as published. They
are **intake** amounts and already assume typical absorption, so progress toward a goal always
compares what you **ate** with the goal. Absorbed amounts are never compared with a goal
directly: about 1–2 mg of absorbed iron is normal on a diet that meets an 18 mg goal.

To show whether your food pairings help, the app computes an **absorption score**:

- expected absorbed = goal × the nutrient's typical absorption from a mixed diet
- absorption score = absorbed ÷ expected absorbed

A score of 1 means you absorbed what a typical diet meeting the goal would. **Pairing**
(= score ÷ progress, or absorbed ÷ (eaten × typical absorption)) isolates the effect of what you
ate together: above 1, your combinations were absorbed better than a typical diet; below 1,
worse.

Typical absorption comes from the factor table. It is each nutrient's baseline (for example
zinc 30%, the moderate WHO band; calcium 25%; protein 92%; vitamin A and folate 1.0), plus two
rows of its own:

- **Iron 16%** (14–18%), NIH ODS for mixed diets with meat, seafood and vitamin C.
- **B12 50%**, NIH ODS for normal food doses.

Copper's typical absorption is read off its intake curve at the goal amount.

Limits, nutrients counted as eaten (calories, fiber, water) and carbohydrate (whose goal
includes fiber, which is not absorbed) have no score. The AI helper closes eaten-versus-goal
gaps and, among foods that do, prefers pairings that raise the absorption score.

## Changing a factor

1. Edit the row in `lib/bioavailability/factors.ts` (value, low, high, description, source).
2. Generate a new seed migration:
   `npm run db:absorption-seed > supabase/migrations/<timestamp>_absorption_factors.sql`
3. Run `npm run check`. A test fails if the latest seed migration does not match `factors.ts`.
4. Apply the migration. All past and future days use the new value from then on.

## Absorption insights (dashboard tips)

`lib/bioavailability/insights.ts` turns the rules above into up to three plain-English tips per
day. Each tip fires exactly when the matching reason does: tea or coffee with a plant-iron meal,
calcium from another food held back non-heme iron, no vitamin C or meat with plant iron, a meal
under the adequate-fat threshold with fat-soluble vitamins, calcium bound by oxalate, and zinc in
the WHO "low" phytate:zinc band. Each is sized by rerunning the meal without the inhibitor (what
if: no tea, no calcium, enough fat) or, when there is nothing to remove, against the typical
absorption used by the absorption score. Tips are ranked by the loss as a share of the goal's
expected absorbed amount (goal × typical absorption), only for tracked nutrients with a goal; each
kind of tip is shown once, for the meal where it costs the most.
