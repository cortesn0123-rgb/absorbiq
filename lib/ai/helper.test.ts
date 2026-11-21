import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { snapshot } from "./day";
import { evaluatePlan } from "./evaluate";
import { ALL_FOODS, CHICKEN, LENTILS, LUNCH, ORANGE_JUICE, testDay } from "./fixtures";
import {
  HelperError,
  MAX_TOOL_ROUNDS,
  runHelper,
  type HelperDeps,
  type HelperRequest,
} from "./helper";

type Message = Anthropic.Beta.BetaMessage;
type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

let nextId = 0;

function message(content: Record<string, unknown>[], stop_reason: Message["stop_reason"]): Message {
  return {
    id: `msg_${++nextId}`,
    type: "message",
    role: "assistant",
    model: "claude-test",
    content,
    stop_reason,
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 80 },
  } as unknown as Message;
}

const toolUse = (name: string, input: unknown) => ({
  type: "tool_use",
  id: `toolu_${++nextId}`,
  name,
  input,
});

const answer = (body: unknown) =>
  message([{ type: "text", text: JSON.stringify(body) }], "end_turn");

const lentilPlan = [
  { fdc_id: LENTILS.fdcId, grams: 200, meal_slot: "lunch" },
  { fdc_id: ORANGE_JUICE.fdcId, grams: 250, meal_slot: "lunch" },
];

/** A scripted Claude: returns the given responses in order and records each request. */
function scripted(responses: Message[]) {
  const calls: Params[] = [];
  const createMessage = vi.fn(async (params: Params) => {
    // Copy messages: the loop keeps appending to the same array.
    calls.push({ ...params, messages: [...params.messages] });
    const next = responses.shift();
    if (!next) throw new Error("No more scripted responses");
    return next;
  });
  return { createMessage, calls };
}

function deps(createMessage: HelperDeps["createMessage"]): HelperDeps {
  return {
    createMessage,
    searchFoods: async (query) =>
      ALL_FOODS.filter((f) => f.name.toLowerCase().includes(query.split(" ")[0])).map((f) => ({
        fdcId: f.fdcId,
        name: f.name,
        dataType: "SR Legacy" as const,
        brand: null,
      })),
    getFood: async (fdcId) => {
      const food = ALL_FOODS.find((f) => f.fdcId === fdcId);
      if (!food) throw new Error("404");
      return food;
    },
  };
}

function request(overrides: Partial<HelperRequest> = {}): HelperRequest {
  return {
    model: "claude-sonnet-5-5",
    day: testDay(),
    date: "2026-11-21",
    hour: 10,
    nextSnack: 1,
    diet: "omnivore",
    avoided: [],
    history: [],
    message: "Close my iron gap.",
    ...overrides,
  };
}

/** Every number anywhere in a value, as found by walking it. */
function numbersIn(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (Array.isArray(value)) return value.flatMap(numbersIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(numbersIn);
  return [];
}

describe("runHelper", () => {
  it("runs search and evaluate_plan, then returns plans whose numbers come only from our code", async () => {
    const { createMessage, calls } = scripted([
      message(
        [
          toolUse("search_foods", { query: "lentils cooked" }),
          toolUse("search_foods", { query: "orange juice" }),
        ],
        "tool_use",
      ),
      message([toolUse("evaluate_plan", { items: lentilPlan })], "tool_use"),
      answer({
        reply: "Lentils with orange juice at lunch. That adds 7.4 mg of iron!",
        plans: [
          {
            title: "Lentil lunch",
            tip: "The vitamin C in the juice helps your body absorb the iron in lentils.",
            items: lentilPlan,
          },
        ],
        avoid_foods: [],
      }),
    ]);

    const result = await runHelper(request(), deps(createMessage));

    // The request: tools, structured output, fallback, cached system prompt.
    expect(calls[0].tools?.map((t) => (t as { name: string }).name)).toEqual([
      "search_foods",
      "evaluate_plan",
    ]);
    expect(calls[0].output_config?.format?.type).toBe("json_schema");
    expect(calls[0].fallbacks).toBe("default");
    expect(calls[0].model).toBe("claude-sonnet-5-5");
    expect(calls[0].messages[0].content).toContain('"meals_left":["breakfast","lunch"');

    // Tool results went back to Claude with our numbers.
    const evalResult = calls[2].messages.at(-1)!
      .content as Anthropic.Beta.BetaToolResultBlockParam[];
    const toolJson = JSON.parse(evalResult[0].content as string);
    expect(toolJson.gaps.some((g: { nutrient: string }) => g.nutrient === "iron")).toBe(true);

    // The final plan: portions snapped to household units and every number recomputed.
    expect(result.plans).toHaveLength(1);
    const plan = result.plans[0];
    expect(plan.items.map((i) => [i.name, i.grams, i.portionLabel, i.portionCount])).toEqual([
      [LENTILS.name, 198, "1 cup", 1],
      [ORANGE_JUICE.name, 248, "1 cup", 1],
    ]);
    const expected = evaluatePlan(
      testDay(),
      plan.items.map((i) => ({
        food: i.name === LENTILS.name ? LENTILS : ORANGE_JUICE,
        grams: i.grams,
        occasion: LUNCH,
        portionLabel: i.portionLabel,
        portionCount: i.portionCount,
      })),
      snapshot(testDay()),
    );
    expect(plan.gaps).toEqual(expected.gaps);
    expect(plan.calories).toEqual(expected.calories);
    expect(plan.scores).toEqual(expected.scores);
    expect(plan.warnings).toEqual(expected.warnings);

    // Every number shown is one our code computed (or a food id / portion from FDC data).
    const ours = new Set([
      ...numbersIn(expected.gaps),
      ...numbersIn(expected.calories),
      ...numbersIn(expected.scores),
      ...plan.items.flatMap((i) => [i.foodId, i.fdcId, i.grams, i.portionCount ?? 0]),
      ...numbersIn(plan.items.map((i) => i.occasion)),
    ]);
    for (const n of numbersIn(plan)) expect(ours.has(n)).toBe(true);

    // Claude's own number was dropped from the reply; the tip has none.
    expect(result.reply).toBe("Lentils with orange juice at lunch.");
    expect(result.reply).not.toMatch(/\d/);
    expect(plan.tip).not.toMatch(/\d/);
    expect(result.rounds).toBe(2);
    expect(result.usage.inputTokens).toBe(300);
  });

  it("drops foods that break the diet, in tool results and in final plans", async () => {
    const chickenPlan = [
      { fdc_id: CHICKEN.fdcId, grams: 172, meal_slot: "dinner" },
      { fdc_id: LENTILS.fdcId, grams: 198, meal_slot: "dinner" },
    ];
    const { createMessage, calls } = scripted([
      message([toolUse("evaluate_plan", { items: chickenPlan })], "tool_use"),
      answer({
        reply: "Dinner idea.",
        plans: [{ title: "Dinner", tip: "", items: chickenPlan }],
        avoid_foods: [],
      }),
    ]);
    const result = await runHelper(request({ diet: "vegetarian" }), deps(createMessage));
    const toolJson = JSON.parse(
      (calls[1].messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[])[0]
        .content as string,
    );
    expect(toolJson.rejected[0].reason).toContain("not vegetarian");
    expect(result.plans[0].items.map((i) => i.name)).toEqual([LENTILS.name]);
    expect(result.plans[0].dropped[0].reason).toBe("not vegetarian");
    expect(result.plans[0].tip).toBeNull();
  });

  it("asks Claude to evaluate plans it skipped evaluating", async () => {
    const { createMessage, calls } = scripted([
      answer({
        reply: "Try this.",
        plans: [{ title: "A", tip: "", items: lentilPlan }],
        avoid_foods: [],
      }),
      message([toolUse("evaluate_plan", { items: lentilPlan })], "tool_use"),
      answer({
        reply: "Checked.",
        plans: [{ title: "A", tip: "", items: lentilPlan }],
        avoid_foods: [],
      }),
    ]);
    const result = await runHelper(request(), deps(createMessage));
    expect(JSON.stringify(calls[1].messages.at(-1))).toContain("Call evaluate_plan");
    expect(result.reply).toBe("Checked.");
  });

  it(`stops tools after ${MAX_TOOL_ROUNDS} rounds and asks for the answer`, async () => {
    const responses = Array.from({ length: MAX_TOOL_ROUNDS }, () =>
      message([toolUse("search_foods", { query: "lentils" })], "tool_use"),
    );
    responses.push(answer({ reply: "Done.", plans: [], avoid_foods: [] }));
    const { createMessage, calls } = scripted(responses);
    const result = await runHelper(request(), deps(createMessage));
    expect(calls).toHaveLength(MAX_TOOL_ROUNDS + 1);
    expect(calls.slice(0, MAX_TOOL_ROUNDS).every((c) => c.tool_choice?.type === "auto")).toBe(true);
    expect(calls[MAX_TOOL_ROUNDS].tool_choice?.type).toBe("none");
    expect(result.rounds).toBe(MAX_TOOL_ROUNDS);
  });

  it("returns tool errors to Claude instead of failing", async () => {
    const { createMessage, calls } = scripted([
      message(
        [toolUse("evaluate_plan", { items: [{ fdc_id: 999_999, grams: 50, meal_slot: "lunch" }] })],
        "tool_use",
      ),
      message([toolUse("evaluate_plan", { items: [] })], "tool_use"),
      answer({ reply: "Sorry.", plans: [], avoid_foods: [] }),
    ]);
    await runHelper(request(), deps(createMessage));
    const first = JSON.parse(
      (calls[1].messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[])[0]
        .content as string,
    );
    expect(first.rejected[0].reason).toContain("not found");
    const second = (
      calls[2].messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[]
    )[0];
    expect(second.is_error).toBe(true);
  });

  it("offers to save foods the user says they avoid, unless already saved", async () => {
    const { createMessage } = scripted([
      answer({ reply: "No dairy, got it.", plans: [], avoid_foods: ["Dairy", "eggs"] }),
    ]);
    const result = await runHelper(
      request({ avoided: ["eggs"], message: "No dairy please" }),
      deps(createMessage),
    );
    expect(result.avoidFoods).toEqual(["dairy"]);
  });

  it("sends earlier turns as alternating plain text", async () => {
    const { createMessage, calls } = scripted([
      answer({ reply: "Ok.", plans: [], avoid_foods: [] }),
    ]);
    await runHelper(
      request({
        history: [
          { role: "assistant", text: "stray" },
          { role: "user", text: "Ideas?" },
          { role: "assistant", text: "Lentil lunch" },
        ],
      }),
      deps(createMessage),
    );
    expect(calls[0].messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(calls[0].messages[0].content).toBe("Ideas?");
  });

  it("turns a refusal into a friendly error", async () => {
    const { createMessage } = scripted([message([], "refusal")]);
    await expect(runHelper(request(), deps(createMessage))).rejects.toBeInstanceOf(HelperError);
  });
});
