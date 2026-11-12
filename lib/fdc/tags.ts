/** Applies the rules in tag-rules.ts to a food. */

import { TAG_RULES, type LevelRule, type TagLevel, type TagRules } from "./tag-rules";

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
