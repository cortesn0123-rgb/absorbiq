import { describe, expect, it } from "vitest";
import { absorbMeal } from "./engine";
import { dayInsights, mealInsights, rankInsights } from "./insights";
import {
  blackTea,
  carrots,
  coffee,
  food,
  lentils,
  milk,
  oliveOil,
  orangeJuice,
  spinach,
  steak,
} from "./test-foods";
import type { EngineFood } from "./types";

const meal = (label: string, foods: EngineFood[]) => ({ key: label.toLowerCase(), label, foods });
const kinds = (foods: EngineFood[]) => mealInsights(meal("Lunch", foods)).map((i) => i.kind);

describe("absorption insights", () => {
  it("flags tea with a plant-iron meal and sizes it by rerunning the meal without tea", () => {
    const foods = [lentils(), blackTea()];
    const tea = mealInsights(meal("Lunch", foods)).find((i) => i.kind === "tea")!;
    const withTea = absorbMeal(foods).totals.iron.absorbed!;
    const withoutTea = absorbMeal(foods, undefined, undefined, {
      adjustContext: (c) => ({ ...c, teaG: 0 }),
    }).totals.iron.absorbed!;
    expect(tea.losses.iron).toBeCloseTo(withoutTea - withTea);
    expect(tea.text).toMatch(/^Tea with your lunch held back iron from the lentils \(~/);
    expect(tea.text).toContain("Try tea between meals");
  });

  it("flags coffee the same way", () => {
    expect(kinds([lentils(), coffee()])).toContain("coffee");
  });

  it("flags calcium from another food held back iron", () => {
    const insight = mealInsights(meal("Dinner", [lentils(), milk()])).find(
      (i) => i.kind === "calcium-iron",
    )!;
    expect(insight.text).toContain("mostly from the milk");
    expect(insight.losses.iron).toBeGreaterThan(0);
  });

  it("suggests vitamin C only when the meal has no vitamin C or meat", () => {
    // Approximate SR Legacy oats cooked in water: no vitamin C.
    const oats = () =>
      food(
        "Cereals, oats, regular, cooked with water",
        234,
        { energy: 71, water: 84, iron: 0.9, zinc: 1, vitamin_c: 0, fat: 1.5 },
        { phytateLevel: "high", foodGroup: "grain" },
      );
    const insight = mealInsights(meal("Breakfast", [oats()])).find(
      (i) => i.kind === "no-iron-enhancer",
    )!;
    expect(insight.text).toContain("the iron in the oats");
    expect(kinds([oats(), orangeJuice()])).not.toContain("no-iron-enhancer");
    expect(kinds([oats(), steak()])).not.toContain("no-iron-enhancer");
  });

  it("does not fire iron tips without plant iron", () => {
    expect(kinds([blackTea()])).toEqual([]);
  });

  it("flags carotenoids in a low-fat meal, and not once fat is added", () => {
    const low = mealInsights(meal("Snack 1", [carrots()])).find((i) => i.kind === "low-fat")!;
    expect(low.losses.vitamin_a).toBeGreaterThan(0);
    expect(low.text).toMatch(/^Your snack 1 had only .* g of fat, so less vitamin A.* carrots/);
    expect(kinds([carrots(), oliveOil()])).not.toContain("low-fat");
  });

  it("flags calcium bound by oxalate", () => {
    const insight = mealInsights(meal("Dinner", [spinach()])).find((i) => i.kind === "oxalate")!;
    expect(insight.losses.calcium).toBeGreaterThan(0);
    expect(insight.text).toContain("The spinach in your dinner is high in oxalate");
  });

  it("ranks by loss as a share of the goal's expected absorbed amount, only for goals given", () => {
    const all = dayInsights([meal("Lunch", [lentils(), blackTea()]), meal("Snack 1", [carrots()])]);
    expect(rankInsights(all, {}).length).toBe(0);
    const ironOnly = rankInsights(all, { iron: 18 });
    expect(ironOnly.length).toBeGreaterThan(0);
    expect(ironOnly.every((i) => i.losses.iron !== undefined)).toBe(true);
    expect(rankInsights(all, { iron: 18, vitamin_a: 700 }, undefined, 1)).toHaveLength(1);
  });

  it("shows each kind of tip once, for the meal where it costs the most", () => {
    const all = dayInsights([
      meal("Breakfast", [lentils(100), blackTea()]),
      meal("Lunch", [lentils(300), blackTea()]),
    ]);
    const ranked = rankInsights(all, { iron: 18 }).filter((i) => i.kind === "tea");
    expect(ranked).toHaveLength(1);
    expect(ranked[0].mealLabel).toBe("Lunch");
  });
});
