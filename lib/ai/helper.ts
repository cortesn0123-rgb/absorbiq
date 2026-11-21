/**
 * The AI helper's tool loop. Claude proposes foods; our code looks them up in FoodData Central
 * (through our cache), checks them against the diet and avoided foods, and computes every number
 * with the bioavailability engine. The final plans are re-evaluated here from scratch, so the
 * numbers shown never come from Claude.
 *
 * Pure apart from the injected dependencies, so tests can mock the Claude API and FDC.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { FoodRecord } from "@/lib/fdc/record";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  normalizeQuery,
  type FoodSearchResult,
} from "@/lib/fdc/search";
import { occasionLabel, type MealOccasion, type MealSlot } from "@/lib/meals";
import type { DietType } from "@/lib/profile";
import { mealsLeft, snapshot, type DayInput, type DaySnapshot, type ProposedFood } from "./day";
import {
  evaluatePlan,
  evaluationForClaude,
  type GapChange,
  type PlanWarning,
  type ScoreChange,
} from "./evaluate";
import { snapPortion } from "./portions";
import { SYSTEM_PROMPT, dayContext } from "./prompt";
import { restrictionReason } from "./restrictions";
import { planTip, planTitle, withoutNumbers } from "./text";
import {
  ANSWER_SCHEMA,
  InvalidInput,
  TOOLS,
  parseAnswer,
  parseEvaluateInput,
  parseSearchInput,
  type AnswerInput,
  type PlanItemInput,
} from "./tools";

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Message = Anthropic.Beta.BetaMessage;
type MessageParam = Anthropic.Beta.BetaMessageParam;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

/** Rounds in which Claude may call tools (the user's choice for Phase 6). */
export const MAX_TOOL_ROUNDS = 6;
/** Tool calls per request across all rounds; later calls get an error result. */
export const MAX_TOOL_CALLS = 24;
const SEARCH_RESULTS = 10;
const MAX_TOKENS = 16_000;
/** Server-side retry on another model if the request is declined (see the Claude API docs). */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export interface HelperDeps {
  createMessage: (params: CreateParams) => Promise<Message>;
  searchFoods: (query: string) => Promise<FoodSearchResult[]>;
  getFood: (fdcId: number) => Promise<FoodRecord>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface HelperRequest {
  model: string;
  day: DayInput;
  date: string;
  hour: number;
  /** Snack number a suggested snack gets (the next free one today). */
  nextSnack: number;
  diet: DietType;
  avoided: readonly string[];
  /** Earlier turns of this chat, oldest first, as plain text. */
  history: readonly ChatTurn[];
  message: string;
}

export interface PlanItem {
  /** Our foods.id, for logging. */
  foodId: number;
  fdcId: number;
  name: string;
  grams: number;
  portionLabel: string | null;
  portionCount: number | null;
  occasion: MealOccasion;
}

export interface PlanResult {
  title: string;
  tip: string | null;
  items: PlanItem[];
  /** Foods Claude proposed that our checks removed. */
  dropped: { name: string; reason: string }[];
  gaps: GapChange[];
  calories: { added: number; after: number; goal: number | null };
  scores: ScoreChange[];
  warnings: PlanWarning[];
}

export interface HelperResult {
  reply: string;
  plans: PlanResult[];
  /** Foods the user said they avoid, to confirm before saving. */
  avoidFoods: string[];
  /** Short plain-text record of this answer, for the next turn's history. */
  summary: string;
  toolCalls: { name: string; input: unknown }[];
  rounds: number;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

export class HelperError extends Error {
  constructor(
    message: string,
    readonly userMessage: string,
  ) {
    super(message);
    this.name = "HelperError";
  }
}

function occasionFor(slot: MealSlot, nextSnack: number): MealOccasion {
  return { slot, snackNumber: slot === "snack" ? nextSnack : null };
}

/** Resolves, checks and snaps proposed items. */
async function resolveItems(
  items: readonly PlanItemInput[],
  req: HelperRequest,
  foods: (fdcId: number) => Promise<FoodRecord | null>,
): Promise<{
  proposed: ProposedFood[];
  dropped: { fdcId: number; name: string; reason: string }[];
}> {
  const proposed: ProposedFood[] = [];
  const dropped: { fdcId: number; name: string; reason: string }[] = [];
  for (const item of items) {
    const food = await foods(item.fdcId);
    if (!food) {
      dropped.push({
        fdcId: item.fdcId,
        name: `FDC ${item.fdcId}`,
        reason: "not found in FoodData Central",
      });
      continue;
    }
    const reason = restrictionReason(food, req.diet, req.avoided);
    if (reason) {
      dropped.push({ fdcId: item.fdcId, name: food.name, reason });
      continue;
    }
    const portion = snapPortion(item.grams, food.portions);
    proposed.push({ food, ...portion, occasion: occasionFor(item.slot, req.nextSnack) });
  }
  return { proposed, dropped };
}

function userTurn(text: string): MessageParam {
  return { role: "user", content: text };
}

/** Earlier turns, merged so roles alternate and the first turn is the user's. */
function historyMessages(history: readonly ChatTurn[]): MessageParam[] {
  const out: MessageParam[] = [];
  for (const turn of history) {
    const last = out[out.length - 1];
    if (!last && turn.role === "assistant") continue;
    if (last && last.role === turn.role) {
      last.content = `${last.content as string}\n\n${turn.text}`;
    } else {
      out.push({ role: turn.role, content: turn.text });
    }
  }
  if (out.length > 0 && out[out.length - 1].role === "user") out.pop();
  return out;
}

export async function runHelper(req: HelperRequest, deps: HelperDeps): Promise<HelperResult> {
  const before = snapshot(req.day);
  const foodCache = new Map<number, FoodRecord | null>();
  const foods = async (fdcId: number) => {
    if (!foodCache.has(fdcId)) {
      try {
        foodCache.set(fdcId, await deps.getFood(fdcId));
      } catch (error) {
        console.warn(`[helper] food ${fdcId} unavailable:`, error);
        foodCache.set(fdcId, null);
      }
    }
    return foodCache.get(fdcId)!;
  };

  const context = dayContext(req.day, before, {
    date: req.date,
    hour: req.hour,
    mealsLeft: mealsLeft(req.hour),
    diet: req.diet,
    avoided: req.avoided,
  });
  const messages: MessageParam[] = [
    ...historyMessages(req.history),
    userTurn(`<today>\n${context}\n</today>\n\n<request>\n${req.message}\n</request>`),
  ];

  const env: ToolEnv = { req, before, foods, searchFoods: deps.searchFoods };
  const toolCalls: { name: string; input: unknown }[] = [];
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  let toolRounds = 0;
  let evaluated = false;
  let nudged = false;

  for (let call = 0; call < MAX_TOOL_ROUNDS + 3; call++) {
    const toolsLeft = toolRounds < MAX_TOOL_ROUNDS;
    const response = await deps.createMessage({
      model: req.model,
      max_tokens: MAX_TOKENS,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: [{ type: "text", text: SYSTEM_PROMPT }],
      tools: TOOLS,
      tool_choice: { type: toolsLeft ? "auto" : "none" },
      output_config: { format: { type: "json_schema", schema: ANSWER_SCHEMA } },
      messages,
    });
    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;

    if (response.stop_reason === "refusal") {
      throw new HelperError(
        "Claude declined the request.",
        "The helper can't help with that request.",
      );
    }
    if (response.stop_reason === "max_tokens") {
      throw new HelperError(
        "Claude ran out of tokens.",
        "The helper's answer was too long. Please try again.",
      );
    }
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (response.stop_reason === "tool_use" && toolUses.length > 0) {
      toolRounds++;
      const results: ToolResult[] = [];
      for (const use of toolUses) {
        toolCalls.push({ name: use.name, input: use.input });
        const content =
          toolCalls.length > MAX_TOOL_CALLS
            ? { error: "Tool call limit reached. Give your final answer." }
            : await runTool(use.name, use.input, env);
        if (use.name === "evaluate_plan" && !("error" in content)) evaluated = true;
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify(content),
          ...("error" in content ? { is_error: true } : {}),
        });
      }
      const last: (ToolResult | Anthropic.Beta.BetaTextBlockParam)[] = [...results];
      if (toolRounds >= MAX_TOOL_ROUNDS) {
        last.push({
          type: "text",
          text: "You have used all your tool rounds. Give your final answer now.",
        });
      }
      messages.push({ role: "user", content: last });
      continue;
    }
    if (response.stop_reason === "pause_turn") continue;

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let answer;
    try {
      answer = parseAnswer(text);
    } catch (error) {
      throw new HelperError(
        `Unreadable answer: ${String(error)}`,
        "The helper's answer could not be read. Please try again.",
      );
    }

    // Plans must be checked with evaluate_plan first; ask once if Claude skipped it.
    if (answer.plans.length > 0 && !evaluated && !nudged && toolsLeft) {
      nudged = true;
      messages.push(userTurn("Call evaluate_plan on each plan before giving your final answer."));
      continue;
    }

    const plans = await buildPlans(answer.plans, req, before, foods);
    const reply = withoutNumbers(answer.reply) || "Here are some ideas for the rest of today.";
    return {
      reply,
      plans,
      avoidFoods: answer.avoidFoods.filter((w) => !req.avoided.includes(w)),
      summary: summarize(reply, plans),
      toolCalls,
      rounds: toolRounds,
      usage,
    };
  }
  throw new HelperError("Tool loop did not finish.", "The helper took too long. Please try again.");
}

type ToolOutput = Record<string, unknown>;

interface ToolEnv {
  req: HelperRequest;
  before: DaySnapshot;
  foods: (fdcId: number) => Promise<FoodRecord | null>;
  searchFoods: HelperDeps["searchFoods"];
}

async function runTool(name: string, input: unknown, env: ToolEnv): Promise<ToolOutput> {
  try {
    if (name === "search_foods") {
      const query = normalizeQuery(parseSearchInput(input));
      if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
        throw new InvalidInput(`query must be ${MIN_QUERY_LENGTH}–${MAX_QUERY_LENGTH} characters.`);
      }
      const results = (await env.searchFoods(query)).slice(0, SEARCH_RESULTS);
      return {
        results: results.map((r) => ({
          fdc_id: r.fdcId,
          name: r.name,
          source: r.dataType === "Branded" ? (r.brand ?? "branded") : "USDA",
        })),
      };
    }
    if (name === "evaluate_plan") {
      const items = parseEvaluateInput(input);
      const { proposed, dropped } = await resolveItems(items, env.req, env.foods);
      const evaluation = evaluatePlan(env.req.day, proposed, env.before);
      return evaluationForClaude(
        proposed,
        evaluation,
        dropped.map((d) => ({ fdc_id: d.fdcId, reason: `${d.name}: ${d.reason}` })),
      );
    }
    return { error: `Unknown tool ${name}.` };
  } catch (error) {
    if (error instanceof InvalidInput) return { error: error.message };
    console.error(`[helper] ${name} failed:`, error);
    return { error: `${name} failed. Try again or change the input.` };
  }
}

/** Final plans: resolved, checked and evaluated again by our code. Empty plans are dropped. */
async function buildPlans(
  plans: AnswerInput["plans"],
  req: HelperRequest,
  before: DaySnapshot,
  foods: (fdcId: number) => Promise<FoodRecord | null>,
): Promise<PlanResult[]> {
  const out: PlanResult[] = [];
  for (const plan of plans) {
    const { proposed, dropped } = await resolveItems(plan.items, req, foods);
    if (proposed.length === 0) continue;
    const evaluation = evaluatePlan(req.day, proposed, before);
    out.push({
      title: planTitle(plan.title, out.length),
      tip: planTip(plan.tip),
      items: proposed.map((p) => ({
        foodId: p.food.id,
        fdcId: p.food.fdcId,
        name: p.food.name,
        grams: p.grams,
        portionLabel: p.portionLabel,
        portionCount: p.portionCount,
        occasion: p.occasion,
      })),
      dropped: dropped.map(({ name, reason }) => ({ name, reason })),
      gaps: evaluation.gaps,
      calories: evaluation.calories,
      scores: evaluation.scores,
      warnings: evaluation.warnings,
    });
  }
  return out;
}

/** What the next turn sees of this answer (plain text, no numbers needed). */
function summarize(reply: string, plans: readonly PlanResult[]): string {
  const lines = [reply];
  for (const p of plans) {
    lines.push(
      `${p.title}: ${p.items.map((i) => `${i.name} (${i.grams} g, ${occasionLabel(i.occasion)})`).join("; ")}`,
    );
  }
  return lines.join("\n");
}
