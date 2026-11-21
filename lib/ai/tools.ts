/**
 * The tools Claude may call, the shape of its final answer, and validation of both. Tool inputs
 * and the final answer are untrusted: everything is checked before use.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { MEAL_SLOTS, type MealSlot } from "@/lib/meals";
import { MAX_PORTION_GRAMS } from "@/lib/nutrients/portion";
import { parseAvoidedWord } from "./restrictions";

export const MAX_PLANS = 3;
export const MAX_ITEMS_PER_PLAN = 6;
export const MAX_AVOID_WORDS = 5;

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_foods",
    description:
      'Search USDA FoodData Central for a food. Returns up to 10 matches with their fdc_id. Use plain, generic food names ("lentils cooked", "orange juice", "greek yogurt plain"); generic USDA foods come first.',
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A short food name, 2–100 characters." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "evaluate_plan",
    description:
      "Adds proposed foods to today's log (in their meals, so foods eaten together affect each other's absorption) and returns consumed-vs-goal gaps before and after, absorption score changes, calories and warnings (upper limits, daily limits, the per-meal added-sugar limit). Foods that break the user's diet or avoided foods come back under `rejected`. Call it for every plan before you answer; only its numbers are real.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "The foods in one plan.",
          items: {
            type: "object",
            properties: {
              fdc_id: { type: "integer", description: "From search_foods." },
              grams: { type: "number", description: "Portion in grams." },
              meal_slot: { type: "string", enum: [...MEAL_SLOTS] },
            },
            required: ["fdc_id", "grams", "meal_slot"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
];

const PLAN_ITEM_SCHEMA = {
  type: "object",
  properties: {
    fdc_id: { type: "integer" },
    grams: { type: "number" },
    meal_slot: { type: "string", enum: [...MEAL_SLOTS] },
  },
  required: ["fdc_id", "grams", "meal_slot"],
  additionalProperties: false,
};

/** The final answer (structured output). */
export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "One or two short, friendly sentences. No numbers.",
    },
    plans: {
      type: "array",
      description: "Two or three alternative plans (none if the request is not for food).",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "A few words, no numbers." },
          tip: { type: "string", description: "One short pairing tip, no numbers." },
          items: { type: "array", items: PLAN_ITEM_SCHEMA },
        },
        required: ["title", "tip", "items"],
        additionalProperties: false,
      },
    },
    avoid_foods: {
      type: "array",
      description:
        'Foods or food groups the user said in this message they avoid (e.g. "dairy"), to offer saving. Empty otherwise.',
      items: { type: "string" },
    },
  },
  required: ["reply", "plans", "avoid_foods"],
  additionalProperties: false,
} as const;

export class InvalidInput extends Error {}

export interface PlanItemInput {
  fdcId: number;
  grams: number;
  slot: MealSlot;
}

export interface AnswerInput {
  reply: string;
  plans: { title: string; tip: string; items: PlanItemInput[] }[];
  avoidFoods: string[];
}

function obj(raw: unknown, what: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new InvalidInput(`${what} must be an object.`);
  }
  return raw as Record<string, unknown>;
}

function str(raw: unknown, what: string): string {
  if (typeof raw !== "string") throw new InvalidInput(`${what} must be a string.`);
  return raw;
}

function arr(raw: unknown, what: string): unknown[] {
  if (!Array.isArray(raw)) throw new InvalidInput(`${what} must be an array.`);
  return raw;
}

export function parseSearchInput(raw: unknown): string {
  return str(obj(raw, "input").query, "query");
}

export function parseItem(raw: unknown): PlanItemInput {
  const item = obj(raw, "item");
  const fdcId = item.fdc_id;
  const grams = item.grams;
  const slot = item.meal_slot;
  if (typeof fdcId !== "number" || !Number.isSafeInteger(fdcId) || fdcId <= 0) {
    throw new InvalidInput("fdc_id must be a positive integer.");
  }
  if (
    typeof grams !== "number" ||
    !Number.isFinite(grams) ||
    grams <= 0 ||
    grams > MAX_PORTION_GRAMS
  ) {
    throw new InvalidInput(`grams must be between 0 and ${MAX_PORTION_GRAMS}.`);
  }
  if (typeof slot !== "string" || !(MEAL_SLOTS as readonly string[]).includes(slot)) {
    throw new InvalidInput(`meal_slot must be one of ${MEAL_SLOTS.join(", ")}.`);
  }
  return { fdcId, grams, slot: slot as MealSlot };
}

export function parseEvaluateInput(raw: unknown): PlanItemInput[] {
  const items = arr(obj(raw, "input").items, "items");
  if (items.length === 0) throw new InvalidInput("items is empty.");
  if (items.length > MAX_ITEMS_PER_PLAN) {
    throw new InvalidInput(`A plan can have at most ${MAX_ITEMS_PER_PLAN} foods.`);
  }
  return items.map(parseItem);
}

/** The final answer; extra plans, items and words are dropped. */
export function parseAnswer(text: string): AnswerInput {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new InvalidInput("The answer is not JSON.");
  }
  const answer = obj(raw, "answer");
  return {
    reply: str(answer.reply, "reply"),
    plans: arr(answer.plans, "plans")
      .slice(0, MAX_PLANS)
      .map((p, i) => {
        const plan = obj(p, `plan ${i + 1}`);
        return {
          title: str(plan.title, "title"),
          tip: str(plan.tip, "tip"),
          items: arr(plan.items, "items").slice(0, MAX_ITEMS_PER_PLAN).map(parseItem),
        };
      }),
    avoidFoods: [
      ...new Set(arr(answer.avoid_foods, "avoid_foods").flatMap((w) => parseAvoidedWord(w) ?? [])),
    ].slice(0, MAX_AVOID_WORDS),
  };
}
