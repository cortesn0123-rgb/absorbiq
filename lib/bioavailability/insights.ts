/**
 * Absorption insights: plain-English tips from the same rules that produce the engine's reasons.
 * Each insight fires exactly when the matching reason does (tea with an iron-rich meal, a low-fat
 * meal with fat-soluble vitamins, ...) and is sized by rerunning the engine without the
 * inhibitor ("what if"), or against a typical diet when there is nothing to remove.
 */

import { formatNumber, joinWords, shortFoodName } from "@/lib/format";
import type { NutrientId } from "@/lib/nutrients/registry";
import { absorbMeal } from "./engine";
import { DEFAULT_FACTORS, type FactorTable } from "./factor-table";
import { buildMealContext, type MealContext, type MealFood } from "./meal-context";
import { nonhemeFactors, phytateZincRatio } from "./rules";
import { typicalAbsorption } from "./score";
import {
  DEFAULT_PROFILE,
  type DayMealInput,
  type EngineProfile,
  type MealAbsorption,
} from "./types";

export type InsightKind =
  "tea" | "coffee" | "calcium-iron" | "no-iron-enhancer" | "low-fat" | "oxalate" | "phytate-zinc";

export interface Insight {
  kind: InsightKind;
  mealKey: string;
  /** e.g. "Lunch". */
  mealLabel: string;
  /**
   * Estimated absorbed amount lost to this pairing, per nutrient (in the nutrient's unit):
   * compared with the meal without the inhibitor, or with a typical diet.
   */
  losses: Partial<Record<NutrientId, number>>;
  /** What happened and what to try. */
  text: string;
}

const VITAMIN_LETTERS: Partial<Record<NutrientId, string>> = {
  vitamin_a: "A",
  vitamin_d: "D",
  vitamin_e: "E",
  vitamin_k: "K",
};
const FAT_SOLUBLE = Object.keys(VITAMIN_LETTERS) as NutrientId[];

const isDrink = (f: MealFood) =>
  f.food.tags.foodGroup === "tea" || f.food.tags.foodGroup === "coffee";

const name = (f: MealFood) => shortFoodName(f.food.name);

function largest(foods: readonly MealFood[], fn: (f: MealFood) => number): MealFood | null {
  let best: MealFood | null = null;
  for (const f of foods) if (fn(f) > 0 && (best === null || fn(f) > fn(best))) best = f;
  return best;
}

function absorbedTotal(meal: MealAbsorption, id: NutrientId): number {
  return meal.foods.reduce((t, f) => t + (f.nutrients[id].absorbed ?? 0), 0);
}

function positive(losses: Partial<Record<NutrientId, number>>) {
  return Object.fromEntries(Object.entries(losses).filter(([, v]) => v !== undefined && v > 0));
}

/** Insights for one meal. Every amount comes from the engine. */
export function mealInsights(
  meal: DayMealInput,
  profile: EngineProfile = DEFAULT_PROFILE,
  table: FactorTable = DEFAULT_FACTORS,
  dayCopperMg?: number,
): Insight[] {
  const ctx = buildMealContext(meal.foods, table, dayCopperMg);
  const only = ["iron", "calcium", "zinc", ...FAT_SOLUBLE] as const;
  const base = absorbMeal(meal.foods, profile, table, { dayCopperMg, only });
  const whatIf = (adjust: (c: MealContext) => MealContext) =>
    absorbMeal(meal.foods, profile, table, { dayCopperMg, adjustContext: adjust, only });
  const where = meal.label.toLowerCase();
  const insights: Insight[] = [];
  const add = (kind: InsightKind, losses: Partial<Record<NutrientId, number>>, text: string) => {
    const kept = positive(losses);
    if (Object.keys(kept).length > 0) {
      insights.push({ kind, mealKey: meal.key, mealLabel: meal.label, losses: kept, text });
    }
  };

  // ----- Iron (Hallberg & Hulthén factors, as in rules.ts) ------------------
  const heme = table.get("iron", "heme_share").value;
  const nonhemeIron = (f: MealFood) =>
    (f.amounts.iron ?? 0) * (f.food.tags.isHemeSource ? 1 - heme : 1);
  const ironFood = largest(
    ctx.foods.filter((f) => !isDrink(f)),
    nonhemeIron,
  );
  if (ironFood) {
    const x = nonhemeFactors(ctx, table, "value");
    const ironLost = (adjust: (c: MealContext) => MealContext) =>
      absorbedTotal(whatIf(adjust), "iron") - absorbedTotal(base, "iron");
    const mg = (lost: number) => `~${formatNumber(lost)} mg less absorbed`;

    if (x.tea < 1) {
      const lost = ironLost((c) => ({ ...c, teaG: 0 }));
      add(
        "tea",
        { iron: lost },
        `Tea with your ${where} held back iron from the ${name(ironFood)} (${mg(lost)}). Try tea between meals instead.`,
      );
    }
    if (x.coffee < 1) {
      const lost = ironLost((c) => ({ ...c, coffeeG: 0 }));
      add(
        "coffee",
        { iron: lost },
        `Coffee with your ${where} held back iron from the ${name(ironFood)} (${mg(lost)}). Try coffee between meals instead.`,
      );
    }
    const calciumFood = largest(ctx.foods, (f) => f.amounts.calcium ?? 0);
    if (x.calcium < 0.99 && calciumFood && calciumFood !== ironFood) {
      const lost = ironLost((c) => ({ ...c, calciumMg: 0 }));
      add(
        "calcium-iron",
        { iron: lost },
        `Calcium in your ${where} (mostly from the ${name(calciumFood)}) held back iron from the ${name(ironFood)} (${mg(lost)}). Try calcium-rich foods at a different meal from iron-rich ones.`,
      );
    }
    if (x.vitaminC <= 1.01 && x.meat <= 1.01) {
      // Nothing to remove, so compare with what a typical diet absorbs from the same iron.
      const consumed = ctx.foods.reduce((t, f) => t + (f.amounts.iron ?? 0), 0);
      const typical = table.get("iron", "typical").value;
      add(
        "no-iron-enhancer",
        { iron: consumed * typical - absorbedTotal(base, "iron") },
        `Nothing in your ${where} helped absorb the iron in the ${name(ironFood)}. Add a vitamin C food such as citrus, berries, peppers or tomatoes to the meal.`,
      );
    }
  }

  // ----- Fat-soluble vitamins in a low-fat meal ------------------------------
  const adequateFat = table.get("fat_soluble", "adequate_fat_g").value;
  if (ctx.fatG < adequateFat) {
    const withFat = whatIf((c) => ({ ...c, fatG: adequateFat }));
    const losses: Partial<Record<NutrientId, number>> = {};
    for (const id of FAT_SOLUBLE) losses[id] = absorbedTotal(withFat, id) - absorbedTotal(base, id);
    const lostIds = FAT_SOLUBLE.filter((id) => (losses[id] ?? 0) > 0);
    if (lostIds.length > 0) {
      // Name the food that lost the largest share of any one vitamin.
      const shareLost = (i: number) =>
        Math.max(
          ...lostIds.map(
            (id) =>
              ((withFat.foods[i].nutrients[id].absorbed ?? 0) -
                (base.foods[i].nutrients[id].absorbed ?? 0)) /
              losses[id]!,
          ),
        );
      const top = ctx.foods.reduce((best, _, i) => (shareLost(i) > shareLost(best) ? i : best), 0);
      const vitamins = joinWords(lostIds.map((id) => VITAMIN_LETTERS[id]!));
      add(
        "low-fat",
        losses,
        `Your ${where} had only ${formatNumber(ctx.fatG)} g of fat, so less vitamin ${vitamins} from the ${name(ctx.foods[top])} was absorbed. Add a little fat, such as olive oil, nuts or avocado.`,
      );
    }
  }

  // ----- Calcium bound by oxalate --------------------------------------------
  const typicalCalcium = table.get("calcium", "default").value;
  ctx.foods.forEach((f, i) => {
    const consumed = f.amounts.calcium ?? 0;
    if (f.food.tags.oxalateLevel !== "high" || consumed <= 0) return;
    const absorbed = base.foods[i].nutrients.calcium.absorbed ?? 0;
    add(
      "oxalate",
      { calcium: consumed * typicalCalcium - absorbed },
      `The ${name(f)} in your ${where} is high in oxalate, which binds its calcium (~${formatNumber(absorbed)} of ${formatNumber(consumed)} mg absorbed). For calcium, lean on dairy, fortified foods, kale or bok choy.`,
    );
  });

  // ----- Zinc held back by phytate (WHO "low" band) --------------------------
  const lowBandCutoff = table.get("zinc", "ratio_cutoff_low").value;
  if (
    ctx.zincMg > 0 &&
    phytateZincRatio(ctx.phytateMg.value, ctx.zincMg) > lowBandCutoff &&
    ctx.phytateSources.length > 0
  ) {
    const typical = table.get("zinc", "absorption_moderate").value;
    const sources = joinWords(ctx.phytateSources.slice(0, 2).map(shortFoodName));
    add(
      "phytate-zinc",
      { zinc: ctx.zincMg * typical - absorbedTotal(base, "zinc") },
      `Phytate in your ${where} (from the ${sources}) held back its zinc. Soaked, sprouted or fermented grains and legumes, such as sourdough bread, have less phytate.`,
    );
  }

  return insights;
}

/** Insights for every meal of a day (copper absorption uses the day's copper, as in absorbDay). */
export function dayInsights(
  meals: readonly DayMealInput[],
  profile: EngineProfile = DEFAULT_PROFILE,
  table: FactorTable = DEFAULT_FACTORS,
): Insight[] {
  const dayCopperMg = meals
    .flatMap((m) => m.foods)
    .reduce((t, f) => t + ((f.per100g.copper ?? 0) * f.grams) / 100, 0);
  return meals.flatMap((m) => mealInsights(m, profile, table, dayCopperMg));
}

/** Insights that cost less than this share of goal × typical absorption are not shown. */
export const MIN_INSIGHT_SHARE = 0.02;

/**
 * The insights that matter most for the user's goals: each loss as a share of what a typical
 * diet absorbs from the goal (goal x typical absorption), summed. Nutrients without a goal in
 * `goals` (untracked or no goal) do not count. Each kind of tip is shown once, for the meal where
 * it costs the most.
 */
export function rankInsights(
  insights: readonly Insight[],
  goals: Partial<Record<NutrientId, number>>,
  table: FactorTable = DEFAULT_FACTORS,
  limit = 3,
): Insight[] {
  const weight = (insight: Insight) => {
    let total = 0;
    for (const [id, lost] of Object.entries(insight.losses) as [NutrientId, number][]) {
      const goal = goals[id];
      if (goal === undefined || goal <= 0) continue;
      const typical = typicalAbsorption(id, goal, table);
      if (typical && typical.value > 0) total += lost / (goal * typical.value);
    }
    return total;
  };
  return insights
    .map((insight) => ({ insight, weight: weight(insight) }))
    .filter((w) => w.weight >= MIN_INSIGHT_SHARE)
    .sort((a, b) => b.weight - a.weight)
    .filter((w, i, all) => all.findIndex((x) => x.insight.kind === w.insight.kind) === i)
    .slice(0, limit)
    .map((w) => w.insight);
}
