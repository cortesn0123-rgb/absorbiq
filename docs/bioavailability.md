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

- **Starting point and boosters.** We use the Monsen & Balintfy (1982) equation:
  absorption = 3% + 8.93% × ln((EF + 100) / 100), where EF ("enhancing factors") = mg of
  vitamin C + grams of cooked meat, poultry or fish in the meal. EF is capped at 75, where
  absorption reaches 8%. With no boosters, absorption is 3%. These figures assume average iron
  stores (500 mg). Because your iron status is unknown, the range scales non-heme absorption
  by the same ratios as heme (15/23 to 35/23). That is our assumption.
  - The grams of meat in a mixed dish (e.g. chicken soup) are estimated from its protein
    (4 g of food per g of protein, since cooked lean meat is 20–30% protein), capped at the
    dish's weight.
- **Reducers**, multiplied on top. Applying reducers on top of the Monsen model follows
  published population studies (Tseng et al. 1997).
  - **Phytate** (beans, lentils, whole grains, nuts, seeds). Hallberg et al. (1989): 2 mg of
    phytate phosphorus lowered iron absorption by **18%**, 25 mg by **64%** and 250 mg by
    **82%**. We interpolate between these points (on a log scale) and hold the 82% beyond 250 mg.
    Phytate phosphorus is 28.16% of phytic acid by weight. How phytate is estimated is
    described under "Phytate content" below.
  - **Tea**: **62–64%** lower (Hallberg & Rossander 1982; Morck et al. 1983).
  - **Coffee**: **35–39%** lower (same studies).
    The full effect is for a cup (200 g); smaller amounts have a proportionally smaller effect
    (our assumption).
  - **Calcium**: Hallberg et al. (1991) found 165 mg of calcium in a meal lowered non-heme iron
    absorption by **50–60%**, dose-related up to about 300 mg, and 50–60% at 300–600 mg. We
    phase the effect in linearly from 0 to 165 mg, then hold it at 55% (range 50–60%).

**Known limitations.** Monsen's 3% baseline comes from ordinary meals, which already contain
some phytate and polyphenols, so adding the phytate reduction may partly count phytate twice.
That would make the estimates for high-phytate meals somewhat low. Vitamin C also partly
cancels phytate's effect (Hallberg 1989; Siegenberg 1991). We model the two separately, which
is more cautious. Calcium also lowers heme iron (Hallberg 1991), which is not modelled.
Studies over weeks suggest the body adapts and the calcium effect is smaller over time.

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
- Monsen ER, Balintfy JL. Calculating dietary iron bioavailability: refinement and
  computerization. J Am Diet Assoc 1982;80:307-11.
- Tseng M et al. Adjustment of iron intake for dietary enhancers and inhibitors in population
  studies. J Nutr 1997;127:1456-68.
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

## Changing a factor

1. Edit the row in `lib/bioavailability/factors.ts` (value, low, high, description, source).
2. Generate a new seed migration:
   `npm run db:absorption-seed > supabase/migrations/<timestamp>_absorption_factors.sql`
3. Run `npm run check`. A test fails if the latest seed migration does not match `factors.ts`.
4. Apply the migration. All past and future days use the new value from then on.
