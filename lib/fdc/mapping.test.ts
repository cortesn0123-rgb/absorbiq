import { describe, expect, it } from "vitest";
import { NUTRIENT_IDS } from "@/lib/nutrients/registry";
import branded from "./fixtures/branded.json";
import foundation from "./fixtures/foundation.json";
import sr from "./fixtures/sr.json";
import survey from "./fixtures/survey.json";
import {
  convertFdcAmount,
  mapToRegistry,
  parseFdcUnit,
  readFdcNutrients,
  type FdcNutrientMap,
} from "./mapping";

// Fixtures are trimmed real FDC responses (fetched 2026-11-11):
// SR Legacy 172421 "Lentils, mature seeds, cooked, boiled, without salt", Foundation 2644283
// "Lentils, dry", Survey 2707431 "Lentil curry", Branded 2431290 "LENTILS".

const map = (food: { foodNutrients: unknown[] }) =>
  mapToRegistry(readFdcNutrients(food.foodNutrients as never));

describe("parseFdcUnit", () => {
  it("reads FDC unit names, including both micro signs", () => {
    expect(parseFdcUnit("g")).toBe("G");
    expect(parseFdcUnit("mg")).toBe("MG");
    expect(parseFdcUnit("µg")).toBe("UG"); // micro sign
    expect(parseFdcUnit("μg")).toBe("UG"); // Greek mu
    expect(parseFdcUnit("UG")).toBe("UG");
    expect(parseFdcUnit("kcal")).toBe("KCAL");
  });

  it("ignores units the registry never uses", () => {
    expect(parseFdcUnit("IU")).toBeNull();
    expect(parseFdcUnit("kJ")).toBeNull();
    expect(parseFdcUnit(undefined)).toBeNull();
  });
});

describe("convertFdcAmount", () => {
  it("converts between mass units", () => {
    expect(convertFdcAmount(1.5, "MG", "UG")).toBe(1500);
    expect(convertFdcAmount(250, "UG", "MG")).toBe(0.25);
    expect(convertFdcAmount(0.2, "G", "MG")).toBe(200);
  });

  it("refuses to convert energy to mass", () => {
    expect(convertFdcAmount(100, "KCAL", "G")).toBeNull();
    expect(convertFdcAmount(100, "KCAL", "KCAL")).toBe(100);
  });
});

describe("readFdcNutrients", () => {
  it("skips header rows without an amount, unknown units and negative values", () => {
    const result = readFdcNutrients([
      { nutrient: { number: "951", name: "Proximates", unitName: "g" } },
      { nutrient: { number: "318", unitName: "IU" }, amount: 8 },
      { nutrient: { number: "303", unitName: "mg" }, amount: -1 },
      { nutrient: { number: "309", unitName: "mg" }, amount: 1.27 },
    ]);
    expect(result).toEqual({ "309": { amount: 1.27, unit: "MG" } });
  });

  it("keeps the first value when a number repeats", () => {
    const result = readFdcNutrients([
      { nutrient: { number: "303", unitName: "mg" }, amount: 3 },
      { nutrient: { number: "303", unitName: "mg" }, amount: 9 },
    ]);
    expect(result["303"].amount).toBe(3);
  });
});

describe("mapToRegistry", () => {
  it("maps SR Legacy cooked lentils per 100 g", () => {
    const { per100g } = map(sr);
    expect(per100g).toMatchObject({
      energy: 116,
      protein: 9.02,
      carbohydrate: 20.13,
      fiber: 7.9,
      sugars_total: 1.8,
      fat: 0.38,
      saturated_fat: 0.053,
      trans_fat: 0,
      mufa: 0.064,
      pufa: 0.175,
      cholesterol: 0,
      water: 69.64,
      iron: 3.33,
      zinc: 1.27,
      folate: 181,
      magnesium: 36,
      potassium: 369,
      selenium: 2.8,
      vitamin_k: 1.7,
      choline: 32.7,
    });
  });

  it("falls back to total 18:3 and 18:2 when ALA and linoleic acid are not reported separately", () => {
    const { per100g } = map(sr);
    expect(per100g.ala).toBe(0.037); // FDC 619
    expect(per100g.linoleic_acid).toBe(0.137); // FDC 618
  });

  it("copies vitamin A (RAE) and folate (DFE) as reported, without a second conversion", () => {
    const { per100g } = map(survey);
    expect(per100g.vitamin_a).toBe(37); // FDC 320, already RAE
    expect(per100g.folate).toBe(63); // FDC 435, already DFE
  });

  it("treats missing nutrients as missing, not zero", () => {
    const { per100g, missing } = map(sr);
    expect(missing).toContain("added_sugars");
    expect(missing).toContain("biotin");
    expect(per100g.added_sugars).toBeUndefined();
    // Reported zeros stay zeros.
    expect(per100g.vitamin_b12).toBe(0);
    expect(missing).not.toContain("vitamin_b12");
  });

  it("lists every registry nutrient exactly once as present or missing", () => {
    for (const food of [sr, foundation, survey, branded]) {
      const { per100g, missing } = map(food);
      const present = Object.keys(per100g);
      expect([...present, ...missing].sort()).toEqual([...NUTRIENT_IDS].sort());
    }
  });

  it("uses Atwater specific energy (958) for Foundation foods that do not report 208", () => {
    const { per100g, missing } = map(foundation);
    expect(per100g.energy).toBe(350.9328);
    expect(per100g.iron).toBe(7.158);
    expect(per100g.zinc).toBe(3.863);
    expect(missing).toContain("folate");
  });

  it("reads branded foods, which FDC already reports per 100 g", () => {
    const { per100g } = map(branded);
    // Label: 140 kcal per 48 g serving = 292 kcal per 100 g.
    expect(per100g.energy).toBe(292);
    expect(per100g.iron).toBe(5.62);
  });

  it("converts units to the registry unit", () => {
    const fdc: FdcNutrientMap = {
      "303": { amount: 3300, unit: "UG" }, // iron reported in µg; registry uses mg
      "317": { amount: 0.0028, unit: "MG" }, // selenium reported in mg; registry uses µg
    };
    const { per100g } = mapToRegistry(fdc);
    expect(per100g.iron).toBeCloseTo(3.3);
    expect(per100g.selenium).toBeCloseTo(2.8);
  });

  it("skips a preferred number in an incompatible unit and uses the fallback", () => {
    const fdc: FdcNutrientMap = {
      "208": { amount: 10, unit: "G" },
      "957": { amount: 120, unit: "KCAL" },
    };
    expect(mapToRegistry(fdc).per100g.energy).toBe(120);
  });
});
