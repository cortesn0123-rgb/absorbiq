/** Applies the rules in tag-rules.ts to a food. */

import {
  FOOD_GROUP_RULES,
  LOW_OXALATE_GREENS,
  TAG_RULES,
  type FoodGroup,
  type GroupRule,
  type LevelRule,
  type TagLevel,
  type TagRules,
} from "./tag-rules";

export interface FoodTags {
  isHemeSource: boolean;
  phytateLevel: TagLevel;
  oxalateLevel: TagLevel;
  isFortified: boolean;
  /** Fat per 100 g; null when FDC has no data. */
  fatG: number | null;
}

export interface TagInput {
  description: string;
  category: string | null;
  dataType: string;
  ingredients: string | null;
  fatPer100g: number | undefined;
}

const anyMatch = (patterns: readonly RegExp[], texts: readonly string[]) =>
  patterns.some((p) => texts.some((t) => p.test(t)));

function level(rules: readonly LevelRule[], texts: readonly string[]): TagLevel {
  for (const rule of rules) {
    if (anyMatch(rule.include, texts) && !anyMatch(rule.exclude ?? [], texts)) return rule.level;
  }
  return "none";
}

export function tagFood(input: TagInput, rules: TagRules = TAG_RULES): FoodTags {
  const texts = [input.description, input.category ?? ""].filter(Boolean);
  const { fortified } = rules;
  const fortifiedByIngredients =
    input.dataType === "Branded" &&
    !!input.ingredients &&
    anyMatch(fortified.brandedIngredients, [input.ingredients]);
  const fortifiedByName = anyMatch(fortified.description, [input.description]);

  return {
    isHemeSource: anyMatch(rules.heme.include, texts) && !anyMatch(rules.heme.exclude, texts),
    phytateLevel: level(rules.phytate, texts),
    oxalateLevel: level(rules.oxalate, [input.description]),
    isFortified:
      (fortifiedByIngredients || fortifiedByName) &&
      !anyMatch(fortified.exclude, [input.description]),
    fatG: input.fatPer100g ?? null,
  };
}

/**
 * The food's group, from its name first (the more specific text) and then its FDC category.
 * Worked out on read, so rule changes apply to foods already cached.
 */
export function classifyFoodGroup(
  name: string,
  category: string | null,
  rules: readonly GroupRule[] = FOOD_GROUP_RULES,
): FoodGroup {
  for (const text of [name, category]) {
    if (!text) continue;
    const rule = rules.find(
      (r) => anyMatch(r.include, [text]) && !anyMatch(r.exclude ?? [], [text]),
    );
    if (rule) return rule.group;
  }
  return "other";
}

export function isLowOxalateGreen(name: string): boolean {
  return anyMatch(LOW_OXALATE_GREENS, [name]);
}
