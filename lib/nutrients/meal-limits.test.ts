import { describe, expect, it } from "vitest";
import type { MealOccasion } from "@/lib/meals";
import { checkMealLimit, mealsOverLimit } from "./meal-limits";

const breakfast: MealOccasion = { slot: "breakfast", snackNumber: null };
const lunch: MealOccasion = { slot: "lunch", snackNumber: null };
const dinner: MealOccasion = { slot: "dinner", snackNumber: null };
const snack = (n: number): MealOccasion => ({ slot: "snack", snackNumber: n });

describe("per-meal limits", () => {
  const entries = [
    { occasion: snack(1), amount: 2 },
    { occasion: breakfast, amount: 6 },
    { occasion: breakfast, amount: 5 },
    { occasion: lunch, amount: 10 },
  ];

  it("sums each meal and flags meals over the limit", () => {
    expect(checkMealLimit(entries, 10)).toEqual([
      { occasion: breakfast, total: 11, limit: 10, over: true },
      { occasion: lunch, total: 10, limit: 10, over: false },
      { occasion: snack(1), total: 2, limit: 10, over: false },
    ]);
  });

  it("treats exactly the limit as within it", () => {
    expect(mealsOverLimit([{ occasion: dinner, amount: 10 }], 10)).toEqual([]);
  });

  it("returns only meals over the limit", () => {
    expect(mealsOverLimit(entries, 10).map((m) => m.occasion)).toEqual([breakfast]);
  });

  it("returns nothing for an empty day", () => {
    expect(checkMealLimit([], 10)).toEqual([]);
  });

  it("checks each snack on its own and never sums snacks together", () => {
    const snacks = [
      { occasion: snack(2), amount: 8 },
      { occasion: snack(1), amount: 6 },
      { occasion: snack(1), amount: 3 },
    ];
    expect(checkMealLimit(snacks, 10)).toEqual([
      { occasion: snack(1), total: 9, limit: 10, over: false },
      { occasion: snack(2), total: 8, limit: 10, over: false },
    ]);
    expect(mealsOverLimit([...snacks, { occasion: snack(2), amount: 3 }], 10)).toEqual([
      { occasion: snack(2), total: 11, limit: 10, over: true },
    ]);
  });
});
