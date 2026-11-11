import { describe, expect, it } from "vitest";
import { checkMealLimit, mealsOverLimit } from "./meal-limits";

describe("per-meal limits", () => {
  const entries = [
    { mealSlot: "breakfast", amount: 6 },
    { mealSlot: "breakfast", amount: 5 },
    { mealSlot: "lunch", amount: 10 },
    { mealSlot: "snack", amount: 2 },
  ] as const;

  it("sums each meal and flags meals over the limit", () => {
    expect(checkMealLimit(entries, 10)).toEqual([
      { mealSlot: "breakfast", total: 11, limit: 10, over: true },
      { mealSlot: "lunch", total: 10, limit: 10, over: false },
      { mealSlot: "snack", total: 2, limit: 10, over: false },
    ]);
  });

  it("treats exactly the limit as within it", () => {
    expect(mealsOverLimit([{ mealSlot: "dinner", amount: 10 }], 10)).toEqual([]);
  });

  it("returns only meals over the limit", () => {
    expect(mealsOverLimit(entries, 10).map((m) => m.mealSlot)).toEqual(["breakfast"]);
  });

  it("returns nothing for an empty day", () => {
    expect(checkMealLimit([], 10)).toEqual([]);
  });
});
