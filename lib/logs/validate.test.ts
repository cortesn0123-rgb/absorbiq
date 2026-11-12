import { describe, expect, it } from "vitest";
import { initialChoice, parseQuantity, resolveChoice } from "./portion-choice";
import {
  ValidationError,
  parseLogEntry,
  parseOccasion,
  parsePortion,
  parseWaterMl,
} from "./validate";

const portions = [
  { label: "1 cup", grams: 198 },
  { label: "1 tbsp", grams: 12.3 },
];

describe("parseLogEntry", () => {
  const valid = {
    foodId: 5,
    date: "2026-11-11",
    occasion: { slot: "lunch", snackNumber: null },
    portion: { grams: 198, portionLabel: "1 cup", portionCount: 1 },
  };

  it("accepts a valid entry", () => {
    expect(parseLogEntry(valid)).toEqual(valid);
  });

  it.each([
    ["food id", { ...valid, foodId: "5" }],
    ["date", { ...valid, date: "2026-02-30" }],
    ["meal", { ...valid, occasion: { slot: "brunch" } }],
    ["grams", { ...valid, portion: { grams: 0, portionLabel: null } }],
    ["grams", { ...valid, portion: { grams: 99999, portionLabel: null } }],
    ["count", { ...valid, portion: { grams: 198, portionLabel: "1 cup", portionCount: 0 } }],
  ])("rejects a bad %s", (_, input) => {
    expect(() => parseLogEntry(input)).toThrow(ValidationError);
  });

  it("rejects non-objects", () => {
    expect(() => parseLogEntry(null)).toThrow(ValidationError);
  });
});

describe("parseOccasion", () => {
  it("requires a snack number for snacks only", () => {
    expect(parseOccasion({ slot: "snack", snackNumber: 2 })).toEqual({
      slot: "snack",
      snackNumber: 2,
    });
    expect(parseOccasion({ slot: "dinner", snackNumber: 2 })).toEqual({
      slot: "dinner",
      snackNumber: null,
    });
    expect(() => parseOccasion({ slot: "snack", snackNumber: null })).toThrow(ValidationError);
    expect(() => parseOccasion({ slot: "snack", snackNumber: 21 })).toThrow(ValidationError);
  });
});

describe("parsePortion", () => {
  it("rounds grams to 0.1 and drops the count for gram entries", () => {
    expect(parsePortion({ grams: 150.04, portionLabel: null, portionCount: 3 })).toEqual({
      grams: 150,
      portionLabel: null,
      portionCount: null,
    });
  });
});

describe("parseWaterMl", () => {
  it("accepts whole millilitres up to the maximum", () => {
    expect(parseWaterMl(250)).toBe(250);
    expect(() => parseWaterMl(0)).toThrow(ValidationError);
    expect(() => parseWaterMl(12.5)).toThrow(ValidationError);
    expect(() => parseWaterMl(5001)).toThrow(ValidationError);
  });
});

describe("parseQuantity", () => {
  it.each([
    ["1", 1],
    ["1.5", 1.5],
    ["1,5", 1.5],
    [".5", 0.5],
    ["1/2", 0.5],
    ["1 1/2", 1.5],
  ])("%s → %d", (text, value) => {
    expect(parseQuantity(text)).toBe(value);
  });

  it.each(["", "0", "abc", "1/0", "-1"])("rejects %j", (text) => {
    expect(parseQuantity(text)).toBeNull();
  });
});

describe("portion choice", () => {
  it("resolves a household portion times a count into grams", () => {
    expect(resolveChoice({ kind: "portion", index: 0, count: "1.5" }, portions)).toEqual({
      grams: 297,
      portionLabel: "1 cup",
      portionCount: 1.5,
    });
  });

  it("resolves grams", () => {
    expect(resolveChoice({ kind: "grams", grams: "150" }, portions)).toEqual({
      grams: 150,
      portionLabel: null,
      portionCount: null,
    });
    expect(resolveChoice({ kind: "grams", grams: "" }, portions)).toBeNull();
  });

  it("defaults to the first portion, or 100 g when there are none", () => {
    expect(initialChoice(portions)).toEqual({ kind: "portion", index: 0, count: "1" });
    expect(initialChoice([])).toEqual({ kind: "grams", grams: "100" });
  });

  it("restores a saved portion, falling back to grams when its label is gone", () => {
    expect(
      initialChoice(portions, { grams: 24.6, portionLabel: "1 tbsp", portionCount: 2 }),
    ).toEqual({ kind: "portion", index: 1, count: "2" });
    expect(
      initialChoice(portions, { grams: 50, portionLabel: "1 slice", portionCount: 1 }),
    ).toEqual({
      kind: "grams",
      grams: "50",
    });
  });
});
