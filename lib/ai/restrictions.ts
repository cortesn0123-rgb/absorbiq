/**
 * Checks a proposed food against the user's diet type and avoided foods. The helper is told
 * about both, but our code checks every food it proposes, so a slip never reaches the user.
 */

import type { FoodRecord } from "@/lib/fdc/record";
import type { FoodGroup } from "@/lib/fdc/tag-rules";
import type { DietType } from "@/lib/profile";

/** Food groups each diet excludes. */
const DIET_EXCLUDES: Record<DietType, readonly FoodGroup[]> = {
  omnivore: [],
  pescatarian: ["meat"],
  vegetarian: ["meat", "fish"],
  vegan: ["meat", "fish", "egg", "dairy"],
};

/** Extra name patterns per diet, for foods the group rules miss (e.g. mixed dishes). */
const DIET_NAME_PATTERNS: Record<DietType, readonly RegExp[]> = {
  omnivore: [],
  pescatarian: [/\b(beef|pork|chicken|turkey|lamb|veal|bacon|ham|sausage|duck|venison)\b/i],
  vegetarian: [
    /\b(beef|pork|chicken|turkey|lamb|veal|bacon|ham|sausage|duck|venison|fish|salmon|tuna|shrimp|crab|lobster|anchov(y|ies)|sardines?|cod|tilapia|clams?|oysters?|mussels?|gelatin)\b/i,
  ],
  vegan: [
    /\b(beef|pork|chicken|turkey|lamb|veal|bacon|ham|sausage|duck|venison|fish|salmon|tuna|shrimp|crab|lobster|anchov(y|ies)|sardines?|cod|tilapia|clams?|oysters?|mussels?|gelatin|milk|cheese|yogh?urt|butter|cream|whey|casein|eggs?|honey)\b/i,
  ],
};

/** Whole-word milk alternatives that the vegan name check must not reject. */
const PLANT_MILK =
  /\b(soy|soya|almond|oat|rice|coconut|cashew|hemp|pea)\s*(milk|beverage|yogh?urt|cheese|butter|cream)\b|\b(peanut|nut|seed|almond|cashew|sunflower|apple|cocoa) butter\b|\bbutternut\b|\bcream of tartar\b/i;

/** Avoided words that mean a whole food group. */
const GROUP_WORDS: Record<string, FoodGroup> = {
  dairy: "dairy",
  meat: "meat",
  fish: "fish",
  seafood: "fish",
  egg: "egg",
  eggs: "egg",
  soy: "soy",
  nuts: "nut_seed",
  legumes: "legume",
  beans: "legume",
  coffee: "coffee",
  tea: "tea",
};

const DIET_LABELS: Record<DietType, string> = {
  omnivore: "omnivore",
  pescatarian: "pescatarian",
  vegetarian: "vegetarian",
  vegan: "vegan",
};

export const MAX_AVOIDED = 50;
export const MAX_AVOIDED_LENGTH = 40;
const AVOIDED_PATTERN = /^[\p{L}][\p{L}\p{M} '’-]*$/u;

/** Lower-cased, trimmed, single-spaced, without duplicates; empty strings dropped. */
export function normalizeAvoided(words: readonly string[]): string[] {
  const out = new Set<string>();
  for (const w of words) {
    const t = w.trim().replace(/\s+/g, " ").toLowerCase();
    if (t) out.add(t);
  }
  return [...out];
}

/** Validates one avoided food as typed by the user or proposed in the chat; null if invalid. */
export function parseAvoidedWord(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const [word] = normalizeAvoided([raw]);
  if (!word || word.length > MAX_AVOIDED_LENGTH || !AVOIDED_PATTERN.test(word)) return null;
  return word;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "peanut" also matches "peanuts"; "berries" also matches "berry". */
function wordPattern(word: string): RegExp {
  const stem = word.replace(/(ies|es|s)$/, "");
  return new RegExp(`\\b${escape(stem)}(s|es|y|ies)?\\b`, "i");
}

function avoidedMatch(food: FoodRecord, avoided: readonly string[]): string | null {
  for (const word of avoided) {
    const group = GROUP_WORDS[word];
    if (group && food.tags.foodGroup === group) return word;
    if (wordPattern(word).test(food.name)) return word;
  }
  return null;
}

/** Why the food is not allowed, or null when it is. */
export function restrictionReason(
  food: FoodRecord,
  diet: DietType,
  avoided: readonly string[],
): string | null {
  const name = food.name;
  const excluded =
    DIET_EXCLUDES[diet].includes(food.tags.foodGroup) ||
    (diet !== "omnivore" && diet !== "pescatarian" && food.tags.isHemeSource) ||
    DIET_NAME_PATTERNS[diet].some((p) => p.test(name.replace(PLANT_MILK, "")));
  if (excluded) return `not ${DIET_LABELS[diet]}`;
  const word = avoidedMatch(food, avoided);
  if (word) return `you avoid ${word}`;
  return null;
}
