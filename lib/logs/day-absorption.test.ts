import { describe, expect, it } from "vitest";
import { DEFAULT_FACTORS, DEFAULT_PROFILE } from "@/lib/bioavailability";
import sr from "@/lib/fdc/fixtures/sr.json";
import { normalizeFood } from "@/lib/fdc/normalize";
import { toFoodInsert, toFoodRecord, type FoodRecord } from "@/lib/fdc/record";
import type { MealOccasion } from "@/lib/meals";
import { absorbLogs } from "./day-absorption";
import type { LoggedFood } from "./queries";

const lentils = toFoodRecord({ ...toFoodInsert(normalizeFood(sr)), id: 1 });

/** Orange juice as it would come back from the foods table. */
const orangeJuice: FoodRecord = toFoodRecord({
  id: 2,
  fdc_id: 169098,
  name: "Orange juice, raw",
  brand: null,
  data_type: "SR Legacy",
  category: "Fruits and Fruit Juices",
  nutrients_per_100g: { vitamin_c: 50, iron: 0.2, calcium: 11, water: 88.3, energy: 45 },
  fdc_nutrients: {},
  portions: [{ label: "1 cup", grams: 248 }],
  is_heme_source: false,
  phytate_level: "none",
  oxalate_level: "none",
  is_fortified: false,
});

const lunch: MealOccasion = { slot: "lunch", snackNumber: null };
const breakfast: MealOccasion = { slot: "breakfast", snackNumber: null };

let nextId = 1;
const log = (food: FoodRecord, grams: number, occasion: MealOccasion): LoggedFood => ({
  id: nextId++,
  date: "2026-11-12",
  occasion,
  grams,
  portionLabel: null,
  portionCount: null,
  createdAt: "2026-11-12T12:00:00Z",
  food,
});

const run = (logs: LoggedFood[]) => absorbLogs(logs, DEFAULT_PROFILE, DEFAULT_FACTORS);

describe("absorbLogs", () => {
  it("raises lunch's absorbed iron when orange juice is added to the same lunch", () => {
    const before = run([log(lentils, 198, lunch)]);
    const after = run([log(lentils, 198, lunch), log(orangeJuice, 248, lunch)]);
    const ironBefore = before.byMeal.get("lunch")!.iron.absorbed!;
    const ironAfter = after.byMeal.get("lunch")!.iron.absorbed!;
    expect(ironAfter).toBeGreaterThan(2 * ironBefore);
    expect(after.day.totals.iron.absorbed).toBeCloseTo(ironAfter);
  });

  it("does not help lunch when the juice is at breakfast", () => {
    const alone = run([log(lentils, 198, lunch)]);
    const split = run([log(orangeJuice, 248, breakfast), log(lentils, 198, lunch)]);
    expect(split.byMeal.get("lunch")!.iron.absorbed).toBeCloseTo(
      alone.byMeal.get("lunch")!.iron.absorbed!,
    );
  });

  it("indexes every log's estimates by log id, in meal order", () => {
    const logs = [log(lentils, 100, lunch), log(orangeJuice, 200, breakfast)];
    const view = run(logs);
    expect(view.byLog.get(logs[0].id)!.iron.consumed).toBeCloseTo(3.33);
    expect(view.day.meals.map((m) => m.label)).toEqual(["Breakfast", "Lunch"]);
  });

  it("handles a day with no logs", () => {
    const view = run([]);
    expect(view.day.meals).toEqual([]);
    expect(view.day.totals.iron.consumed).toBeNull();
  });
});
