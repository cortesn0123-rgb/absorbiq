import { describe, expect, it } from "vitest";
import { CHICKEN, LENTILS, MILK, foodRecord } from "./fixtures";
import { snapPortion } from "./portions";
import { normalizeAvoided, parseAvoidedWord, restrictionReason } from "./restrictions";
import { planTip, planTitle, withoutNumbers } from "./text";
import { InvalidInput, parseAnswer, parseEvaluateInput } from "./tools";

describe("restrictionReason", () => {
  const soymilk = foodRecord(10, "Soymilk, original and vanilla, unfortified", {}, [], {
    foodGroup: "soy",
  });
  const peanuts = foodRecord(11, "Peanuts, all types, dry-roasted", {}, [], {
    foodGroup: "nut_seed",
  });

  it("applies the diet type", () => {
    expect(restrictionReason(MILK, "vegan", [])).toBe("not vegan");
    expect(restrictionReason(soymilk, "vegan", [])).toBeNull();
    expect(restrictionReason(CHICKEN, "vegetarian", [])).toBe("not vegetarian");
    expect(restrictionReason(CHICKEN, "pescatarian", [])).toBe("not pescatarian");
    expect(restrictionReason(MILK, "vegetarian", [])).toBeNull();
    expect(restrictionReason(CHICKEN, "omnivore", [])).toBeNull();
  });

  it("applies avoided foods by group and by name", () => {
    expect(restrictionReason(MILK, "omnivore", ["dairy"])).toBe("you avoid dairy");
    expect(restrictionReason(peanuts, "omnivore", ["peanut"])).toBe("you avoid peanut");
    expect(restrictionReason(LENTILS, "omnivore", ["peanut", "dairy"])).toBeNull();
  });

  it("validates avoided words", () => {
    expect(parseAvoidedWord("  Dairy ")).toBe("dairy");
    expect(parseAvoidedWord("1 cup")).toBeNull();
    expect(parseAvoidedWord("x".repeat(41))).toBeNull();
    expect(normalizeAvoided(["Eggs", "eggs ", ""])).toEqual(["eggs"]);
  });
});

describe("snapPortion", () => {
  it("snaps grams to a close household portion", () => {
    expect(snapPortion(200, [{ label: "1 cup", grams: 198 }])).toEqual({
      grams: 198,
      portionLabel: "1 cup",
      portionCount: 1,
    });
    expect(snapPortion(100, [{ label: "1 cup", grams: 198 }])).toEqual({
      grams: 99,
      portionLabel: "1 cup",
      portionCount: 0.5,
    });
  });

  it("keeps grams when no portion fits", () => {
    expect(snapPortion(37, [])).toEqual({ grams: 37, portionLabel: null, portionCount: null });
    expect(snapPortion(2000, [{ label: "1 tbsp", grams: 15 }]).portionLabel).toBeNull();
  });
});

describe("Claude's text", () => {
  it("drops sentences with numbers", () => {
    expect(withoutNumbers("Great choice! This adds 6 mg of iron. Enjoy.")).toBe(
      "Great choice! Enjoy.",
    );
    expect(planTitle("Lentil lunch", 0)).toBe("Lentil lunch");
    expect(planTitle("2 snacks", 1)).toBe("Option 2");
    expect(planTip("About 50% more iron absorbed.")).toBeNull();
  });
});

describe("tool and answer validation", () => {
  it("rejects bad plan items", () => {
    expect(() => parseEvaluateInput({ items: [] })).toThrow(InvalidInput);
    expect(() =>
      parseEvaluateInput({ items: [{ fdc_id: 1, grams: -5, meal_slot: "lunch" }] }),
    ).toThrow(InvalidInput);
    expect(() =>
      parseEvaluateInput({ items: [{ fdc_id: 1, grams: 50, meal_slot: "brunch" }] }),
    ).toThrow(InvalidInput);
  });

  it("parses the final answer and trims extras", () => {
    const item = { fdc_id: 1, grams: 100, meal_slot: "lunch" };
    const answer = parseAnswer(
      JSON.stringify({
        reply: "Hi",
        plans: Array.from({ length: 5 }, () => ({ title: "t", tip: "x", items: [item] })),
        avoid_foods: ["Dairy", "dairy", "12 eggs"],
      }),
    );
    expect(answer.plans).toHaveLength(3);
    expect(answer.avoidFoods).toEqual(["dairy"]);
    expect(() => parseAnswer("not json")).toThrow(InvalidInput);
  });
});
