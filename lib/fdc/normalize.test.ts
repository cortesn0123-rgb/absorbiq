import { describe, expect, it } from "vitest";
import branded from "./fixtures/branded.json";
import sr from "./fixtures/sr.json";
import survey from "./fixtures/survey.json";
import { normalizeFood, tidyName } from "./normalize";
import { toFoodInsert, toFoodRecord } from "./record";
import { rankSearchResults } from "./search";

describe("tidyName", () => {
  it("title-cases ALL CAPS branded names and leaves others alone", () => {
    expect(tidyName("ORGANIC RED LENTILS")).toBe("Organic Red Lentils");
    expect(tidyName("  Lentils,  raw ")).toBe("Lentils, raw");
    expect(tidyName("HY-VEE (MINI) BITES")).toBe("Hy-Vee (Mini) Bites");
  });
});

describe("normalizeFood", () => {
  it("normalizes an SR Legacy food", () => {
    const food = normalizeFood(sr);
    expect(food).toMatchObject({
      fdcId: 172421,
      name: "Lentils, mature seeds, cooked, boiled, without salt",
      dataType: "SR Legacy",
      brand: null,
      category: "Legumes and Legume Products",
    });
    expect(food.fdcNutrients["303"]).toEqual({ amount: 3.33, unit: "MG" });
  });

  it("reads Survey and Branded categories and brands", () => {
    expect(normalizeFood(survey).category).toBe("Bean, pea, legume dishes");
    const food = normalizeFood(branded);
    expect(food).toMatchObject({
      name: "Lentils",
      brand: "Hannaford",
      category: "Vegetable and Lentil Mixes",
    });
  });
});

describe("food record round trip", () => {
  it("stores registry-keyed nutrients and reads them back", () => {
    const insert = toFoodInsert(normalizeFood(sr));
    expect(insert.nutrients_per_100g.iron).toBe(3.33);
    expect(insert.phytate_level).toBe("high");

    const record = toFoodRecord({
      ...insert,
      id: 7,
      nutrients_per_100g: { ...insert.nutrients_per_100g, "303": 99, bogus: "x" },
    });
    expect(record.nutrientsPer100g.iron).toBe(3.33);
    expect(record.nutrientsPer100g).not.toHaveProperty("303");
    expect(record.nutrientsPer100g).not.toHaveProperty("bogus");
    expect(record.portions[0]).toEqual({ label: "1 cup", grams: 198 });
    expect(record.tags).toEqual({
      isHemeSource: false,
      phytateLevel: "high",
      oxalateLevel: "none",
      isFortified: false,
      foodGroup: "legume",
      isLowOxalateGreen: false,
    });
    // SR lentils report retinol (FDC 319) as 0 µg: all of their (zero) vitamin A is carotenoid.
    expect(record.retinolPer100g).toBe(0);
  });

  it("reads retinol in mcg and returns null when FDC does not report it", () => {
    const insert = toFoodInsert(normalizeFood(sr));
    const withRetinol = toFoodRecord({
      ...insert,
      id: 1,
      fdc_nutrients: { "319": { amount: 0.05, unit: "MG" } },
    });
    expect(withRetinol.retinolPer100g).toBe(50);
    expect(toFoodRecord({ ...insert, id: 1, fdc_nutrients: {} }).retinolPer100g).toBeNull();
  });
});

describe("rankSearchResults", () => {
  it("puts Foundation and SR Legacy first, then Survey, then Branded, keeping relevance order", () => {
    const results = rankSearchResults([
      { fdcId: 1, description: "Lentil curry", dataType: "Survey (FNDDS)" },
      { fdcId: 2, description: "LENTILS", dataType: "Branded", brandOwner: "Hy-Vee, Inc." },
      { fdcId: 3, description: "Lentils, dry", dataType: "Foundation" },
      { fdcId: 4, description: "Lentils, raw", dataType: "SR Legacy" },
      { fdcId: 5, description: "Lentils, NFS", dataType: "Survey (FNDDS)" },
    ]);
    expect(results.map((r) => r.fdcId)).toEqual([3, 4, 1, 5, 2]);
    expect(results.at(-1)).toEqual({
      fdcId: 2,
      name: "Lentils",
      dataType: "Branded",
      brand: "Hy-Vee, Inc.",
    });
  });

  it("drops duplicates and unsupported data types", () => {
    const results = rankSearchResults([
      { fdcId: 1, description: "A", dataType: "SR Legacy" },
      { fdcId: 1, description: "A", dataType: "SR Legacy" },
      { fdcId: 2, description: "B", dataType: "Experimental" },
    ]);
    expect(results.map((r) => r.fdcId)).toEqual([1]);
  });
});
