import { describe, expect, it } from "vitest";
import {
  MAX_SNACKS_PER_DAY,
  compareOccasions,
  defaultMealSlot,
  defaultSnackNumber,
  nextSnackNumber,
  occasionKey,
  occasionLabel,
  snackSummaries,
  type MealOccasion,
} from "./meals";

const snack = (n: number): MealOccasion => ({ slot: "snack", snackNumber: n });

describe("occasions", () => {
  it("keys and labels each snack separately", () => {
    expect(occasionKey({ slot: "lunch", snackNumber: null })).toBe("lunch");
    expect(occasionKey(snack(2))).toBe("snack-2");
    expect(occasionLabel(snack(2))).toBe("Snack 2");
    expect(occasionLabel({ slot: "dinner", snackNumber: null })).toBe("Dinner");
  });

  it("orders breakfast, lunch, dinner, then snacks by number", () => {
    const sorted = [
      snack(2),
      { slot: "dinner", snackNumber: null },
      snack(1),
      {
        slot: "breakfast",
        snackNumber: null,
      },
    ] as MealOccasion[];
    expect(sorted.sort(compareOccasions).map(occasionKey)).toEqual([
      "breakfast",
      "dinner",
      "snack-1",
      "snack-2",
    ]);
  });
});

describe("defaultMealSlot", () => {
  it.each([
    [7, "breakfast"],
    [12, "lunch"],
    [16, "snack"],
    [19, "dinner"],
    [23, "snack"],
    [2, "snack"],
  ])("hour %i → %s", (hour, slot) => {
    expect(defaultMealSlot(hour)).toBe(slot);
  });
});

describe("snack numbers", () => {
  const now = new Date("2026-11-11T15:00:00Z");

  it("starts at snack 1", () => {
    expect(defaultSnackNumber([], now)).toBe(1);
  });

  it("adds to the latest snack when it was logged within the hour", () => {
    const snacks = [
      { snackNumber: 1, lastLoggedAt: "2026-11-11T10:00:00Z" },
      { snackNumber: 2, lastLoggedAt: "2026-11-11T14:30:00Z" },
    ];
    expect(defaultSnackNumber(snacks, now)).toBe(2);
  });

  it("starts a new snack when the latest one is older", () => {
    const snacks = [{ snackNumber: 1, lastLoggedAt: "2026-11-11T13:00:00Z" }];
    expect(defaultSnackNumber(snacks, now)).toBe(2);
  });

  it("never goes past the daily maximum", () => {
    expect(nextSnackNumber([{ snackNumber: MAX_SNACKS_PER_DAY }])).toBe(MAX_SNACKS_PER_DAY);
  });

  it("summarizes snacks from logs", () => {
    const logs = [
      { occasion: snack(1), createdAt: "2026-11-11T10:00:00Z" },
      {
        occasion: { slot: "lunch", snackNumber: null } as MealOccasion,
        createdAt: "2026-11-11T12:00:00Z",
      },
      { occasion: snack(1), createdAt: "2026-11-11T10:05:00Z" },
      { occasion: snack(3), createdAt: "2026-11-11T16:00:00Z" },
    ];
    expect(snackSummaries(logs)).toEqual([
      { snackNumber: 1, lastLoggedAt: "2026-11-11T10:05:00Z" },
      { snackNumber: 3, lastLoggedAt: "2026-11-11T16:00:00Z" },
    ]);
  });
});
