import { describe, expect, it } from "vitest";
import branded from "./fixtures/branded.json";
import foundation from "./fixtures/foundation.json";
import sr from "./fixtures/sr.json";
import survey from "./fixtures/survey.json";
import { portionsFromFdc } from "./portions";
import type { FdcFoodDetail } from "./types";

const base: FdcFoodDetail = { fdcId: 1, description: "Test", dataType: "SR Legacy" };

describe("portionsFromFdc", () => {
  it("builds SR Legacy portions from amount + modifier", () => {
    expect(portionsFromFdc(sr)).toEqual([
      { label: "1 cup", grams: 198 },
      { label: "1 tbsp", grams: 12.3 },
    ]);
  });

  it("uses Survey portion descriptions and skips 'Quantity not specified'", () => {
    expect(portionsFromFdc(survey)).toEqual([{ label: "1 cup", grams: 240 }]);
  });

  it("names Foundation RACC portions as a serving", () => {
    expect(portionsFromFdc(foundation)).toEqual([{ label: "1 serving", grams: 35 }]);
  });

  it("uses the branded household serving", () => {
    expect(portionsFromFdc(branded)).toEqual([{ label: "1/4 cup", grams: 48 }]);
  });

  it("uses Foundation measure units with modifiers", () => {
    const food: FdcFoodDetail = {
      ...base,
      dataType: "Foundation",
      foodPortions: [
        { amount: 1, gramWeight: 150, measureUnit: { name: "cup" }, modifier: "chopped" },
        { amount: 0.5, gramWeight: 75, measureUnit: { name: "cup" } },
      ],
    };
    expect(portionsFromFdc(food)).toEqual([
      { label: "1 cup chopped", grams: 150 },
      { label: "0.5 cup", grams: 75 },
    ]);
  });

  it("treats branded millilitre servings as grams and falls back to '1 serving'", () => {
    const food: FdcFoodDetail = {
      ...base,
      dataType: "Branded",
      servingSize: 240,
      servingSizeUnit: "MLT",
    };
    expect(portionsFromFdc(food)).toEqual([{ label: "1 serving", grams: 240 }]);
  });

  it("drops portions without a gram weight, unknown units and duplicate labels", () => {
    const food: FdcFoodDetail = {
      ...base,
      foodPortions: [
        { amount: 1, modifier: "cup", sequenceNumber: 1 },
        { amount: 1, gramWeight: 50, measureUnit: { name: "undetermined" }, sequenceNumber: 2 },
        { amount: 1, gramWeight: 120, modifier: "medium", sequenceNumber: 3 },
        { amount: 1, gramWeight: 125, modifier: "Medium", sequenceNumber: 4 },
      ],
    };
    expect(portionsFromFdc(food)).toEqual([{ label: "1 medium", grams: 120 }]);
  });

  it("orders portions by FDC sequence number", () => {
    const food: FdcFoodDetail = {
      ...base,
      foodPortions: [
        { amount: 1, gramWeight: 5, modifier: "tsp", sequenceNumber: 2 },
        { amount: 1, gramWeight: 200, modifier: "cup", sequenceNumber: 1 },
      ],
    };
    expect(portionsFromFdc(food).map((p) => p.label)).toEqual(["1 cup", "1 tsp"]);
  });
});
