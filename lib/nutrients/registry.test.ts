import { describe, expect, it } from "vitest";
import {
  AGE_BANDS,
  NUTRIENTS,
  NUTRIENT_IDS,
  NUTRIENT_LIST,
  REPRO_BANDS,
  TIERS,
  ageBand,
  lookupDri,
  type DriTable,
  type NutrientId,
} from "./registry";

/** Every number in a DRI table. */
function allValues(table: DriTable): number[] {
  return [
    ...AGE_BANDS.map((b) => table.male[b]),
    ...AGE_BANDS.map((b) => table.female[b]),
    ...REPRO_BANDS.map((b) => table.pregnant[b]),
    ...REPRO_BANDS.map((b) => table.lactating[b]),
  ];
}

/** Nutrients for which no authority publishes a number in at least one tier. */
const NO_TARGET_ALLOWED: NutrientId[] = [
  "sugars_total",
  "trans_fat",
  "mufa",
  "pufa",
  "cholesterol",
];

const FDC_UNIT_TO_UNIT = { KCAL: "kcal", G: "g", MG: "mg", UG: "mcg" } as const;

describe("nutrient registry", () => {
  it("covers exactly the nutrients in NUTRIENT_IDS, keyed by id", () => {
    expect(Object.keys(NUTRIENTS).sort()).toEqual([...NUTRIENT_IDS].sort());
    for (const id of NUTRIENT_IDS) expect(NUTRIENTS[id].id).toBe(id);
    expect(NUTRIENT_LIST).toHaveLength(NUTRIENT_IDS.length);
  });

  it("includes every micro and macro named in CLAUDE.md", () => {
    expect(NUTRIENT_LIST.filter((n) => n.category === "vitamin")).toHaveLength(14);
    expect(NUTRIENT_LIST.filter((n) => n.category === "mineral")).toHaveLength(14);
    expect(NUTRIENT_LIST.filter((n) => n.category === "macro")).toHaveLength(15);
  });

  describe.each(NUTRIENT_LIST.map((n) => [n.id, n] as const))("%s", (_id, n) => {
    it("has a name, unit and citation", () => {
      expect(n.name.length).toBeGreaterThan(0);
      expect(["kcal", "g", "mg", "mcg", "mL"]).toContain(n.unit);
      expect(n.citation.length).toBeGreaterThan(0);
    });

    it("has at least one numeric FDC nutrient number", () => {
      expect(n.fdcNumbers.length).toBeGreaterThan(0);
      for (const num of n.fdcNumbers) expect(num).toMatch(/^\d{3}$/);
    });

    it("has a unit consistent with the FDC unit", () => {
      const expected = n.id === "water" ? "mL" : FDC_UNIT_TO_UNIT[n.fdcUnit];
      expect(n.unit).toBe(expected);
    });

    it.each(TIERS)("has a value for the %s tier", (tier) => {
      const v = n.tiers[tier];
      expect(v).toBeDefined();
      switch (v.type) {
        case "fixed":
          expect(v.value).toBeGreaterThan(0);
          // Only added sugars uses a per-meal limit.
          if (v.per === "meal") expect(n.id).toBe("added_sugars");
          break;
        case "dri":
          for (const x of allValues(v.table)) {
            expect(Number.isFinite(x)).toBe(true);
            expect(x).toBeGreaterThan(0);
          }
          break;
        case "computed":
          expect(v.rule.length).toBeGreaterThan(0);
          break;
        case "none":
          expect(NO_TARGET_ALLOWED).toContain(n.id);
          expect(v.reason.length).toBeGreaterThan(20);
          break;
      }
    });

    it("has a well-formed upper limit, at or above the target for every life stage", () => {
      if (!n.ul) return;
      const ulValues = allValues(n.ul.table);
      for (const x of ulValues) expect(x).toBeGreaterThan(0);
      if (n.ul.scope === "form") expect(n.ul.fdcNumbers?.length).toBeGreaterThan(0);

      const avg = n.tiers.average;
      if (n.ul.scope === "total" && avg.type === "dri") {
        const targets = allValues(avg.table);
        ulValues.forEach((ul, i) => expect(ul).toBeGreaterThanOrEqual(targets[i]));
      }
    });
  });

  it("uses each primary FDC number for only one nutrient", () => {
    const primaries = NUTRIENT_LIST.map((n) => n.fdcNumbers[0]);
    expect(new Set(primaries).size).toBe(primaries.length);
  });

  it("maps vitamin A to RAE (320) and folate to DFE (435) so no second conversion is needed", () => {
    expect(NUTRIENTS.vitamin_a.fdcNumbers).toEqual(["320"]);
    expect(NUTRIENTS.folate.fdcNumbers).toEqual(["435"]);
  });

  it("marks the FDA limit nutrients as limits", () => {
    for (const id of ["sodium", "saturated_fat", "added_sugars", "cholesterol"] as const) {
      expect(NUTRIENTS[id].kind).toBe("limit");
      expect(NUTRIENTS[id].tiers.fda.type).toBe("fixed");
    }
    expect(NUTRIENTS.trans_fat.kind).toBe("limit");
  });

  it("matches the FDA Daily Values for adults and children 4+", () => {
    const expected: Partial<Record<NutrientId, number>> = {
      vitamin_a: 900,
      vitamin_c: 90,
      vitamin_d: 20,
      vitamin_e: 15,
      vitamin_k: 120,
      thiamin: 1.2,
      riboflavin: 1.3,
      niacin: 16,
      pantothenic_acid: 5,
      vitamin_b6: 1.7,
      biotin: 30,
      folate: 400,
      vitamin_b12: 2.4,
      choline: 550,
      calcium: 1300,
      iron: 18,
      magnesium: 420,
      zinc: 11,
      potassium: 4700,
      sodium: 2300,
      chloride: 2300,
      selenium: 55,
      copper: 0.9,
      manganese: 2.3,
      phosphorus: 1250,
      iodine: 150,
      chromium: 35,
      molybdenum: 45,
      energy: 2000,
      protein: 50,
      carbohydrate: 275,
      fiber: 28,
      added_sugars: 50,
      fat: 78,
      saturated_fat: 20,
      cholesterol: 300,
    };
    for (const [id, value] of Object.entries(expected)) {
      const tier = NUTRIENTS[id as NutrientId].tiers.fda;
      expect(tier, id).toMatchObject({ type: "fixed", value });
    }
  });

  it("matches spot-checked NASEM DRI values", () => {
    const avg = (id: NutrientId) => {
      const t = NUTRIENTS[id].tiers.average;
      if (t.type !== "dri") throw new Error(`${id} is not a DRI`);
      return t.table;
    };
    expect(lookupDri(avg("iron"), "female", 30)).toBe(18);
    expect(lookupDri(avg("iron"), "female", 55)).toBe(8);
    expect(lookupDri(avg("iron"), "female", 30, "pregnant")).toBe(27);
    expect(lookupDri(avg("iron"), "female", 17, "lactating")).toBe(10);
    expect(lookupDri(avg("calcium"), "male", 75)).toBe(1200);
    expect(lookupDri(avg("calcium"), "female", 55)).toBe(1200);
    expect(lookupDri(avg("magnesium"), "male", 25)).toBe(400);
    expect(lookupDri(avg("magnesium"), "male", 35)).toBe(420);
    expect(lookupDri(avg("vitamin_d"), "female", 72)).toBe(20);
    expect(lookupDri(avg("vitamin_b6"), "male", 60)).toBe(1.7);
    expect(lookupDri(avg("potassium"), "male", 40)).toBe(3400);
    expect(lookupDri(avg("chromium"), "female", 60)).toBe(20);
    expect(lookupDri(avg("folate"), "female", 28, "pregnant")).toBe(600);
    expect(lookupDri(avg("fiber"), "male", 60)).toBe(30);
    expect(lookupDri(avg("water"), "female", 30)).toBe(2700);
    expect(lookupDri(avg("linoleic_acid"), "female", 30)).toBe(12);
  });

  it("ignores pregnancy/lactation for males", () => {
    const iron = NUTRIENTS.iron.tiers.average;
    if (iron.type !== "dri") throw new Error();
    expect(lookupDri(iron.table, "male", 30, "pregnant")).toBe(8);
  });
});

describe("ageBand", () => {
  it.each([
    [14, "14-18"],
    [18.9, "14-18"],
    [19, "19-30"],
    [30, "19-30"],
    [31, "31-50"],
    [50, "31-50"],
    [51, "51-70"],
    [70, "51-70"],
    [71, "71+"],
    [99, "71+"],
  ] as const)("age %s -> %s", (age, band) => {
    expect(ageBand(age)).toBe(band);
  });

  it("rejects ages under 14", () => {
    expect(() => ageBand(13)).toThrow(RangeError);
    expect(() => ageBand(Number.NaN)).toThrow(RangeError);
  });
});
