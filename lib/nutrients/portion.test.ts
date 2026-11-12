import { describe, expect, it } from "vitest";
import sr from "@/lib/fdc/fixtures/sr.json";
import { normalizeFood } from "@/lib/fdc/normalize";
import { nutrientsForGrams, portionGrams, sumNutrients } from "./portion";

const lentils = normalizeFood(sr);

describe("portionGrams", () => {
  it("multiplies the portion weight by the count, to 0.1 g", () => {
    expect(portionGrams(198, 1)).toBe(198);
    expect(portionGrams(198, 1.5)).toBe(297);
    expect(portionGrams(12.3, 0.33)).toBe(4.1);
  });
});

describe("nutrientsForGrams", () => {
  it("scales 1 cup (198 g) of cooked lentils", () => {
    const cup = nutrientsForGrams(lentils.nutrientsPer100g, 198);
    expect(cup.energy).toBeCloseTo(229.68);
    expect(cup.protein).toBeCloseTo(17.86, 2);
    expect(cup.iron).toBeCloseTo(6.593, 3);
    expect(cup.zinc).toBeCloseTo(2.515, 3);
    expect(cup.folate).toBeCloseTo(358.38);
    expect(cup.water).toBeCloseTo(137.89, 2);
  });

  it("keeps missing nutrients missing", () => {
    const cup = nutrientsForGrams(lentils.nutrientsPer100g, 198);
    expect(cup).not.toHaveProperty("added_sugars");
    expect(cup.vitamin_b12).toBe(0);
  });

  it("returns per-100 g values for 100 g", () => {
    expect(nutrientsForGrams({ iron: 3.33 }, 100)).toEqual({ iron: 3.33 });
  });
});

describe("sumNutrients", () => {
  it("adds portions and counts portions with no data", () => {
    const totals = sumNutrients([
      { iron: 2, energy: 100 },
      { iron: 1.5, energy: 50, added_sugars: 4 },
    ]);
    expect(totals.iron).toEqual({ amount: 3.5, missingCount: 0 });
    expect(totals.added_sugars).toEqual({ amount: 4, missingCount: 1 });
    expect(totals.biotin).toEqual({ amount: null, missingCount: 2 });
  });

  it("returns no data for an empty day", () => {
    expect(sumNutrients([]).iron).toEqual({ amount: null, missingCount: 0 });
  });
});
