import { describe, expect, it } from "vitest";
import { NUTRIENT_LIST, NUTRIENTS, isNutrientId } from "./registry";
import {
  MICRO_IDS,
  PRESETS,
  customGoals,
  getPreset,
  matchingPreset,
  trackedMicros,
  visibleNutrients,
} from "./tracking";

const MACRO_IDS = NUTRIENT_LIST.filter((d) => d.category === "macro").map((d) => d.id);

describe("MICRO_IDS", () => {
  it("is every vitamin and mineral in the registry, and no macros", () => {
    expect(MICRO_IDS).toHaveLength(28);
    for (const id of MICRO_IDS) expect(NUTRIENTS[id].category).not.toBe("macro");
  });
});

describe("presets", () => {
  it("only name vitamins and minerals from the registry", () => {
    for (const p of PRESETS) {
      for (const id of p.nutrients) {
        expect(isNutrientId(id)).toBe(true);
        expect(MICRO_IDS).toContain(id);
      }
    }
  });

  it("match the phase brief", () => {
    expect(getPreset("essentials")?.nutrients).toEqual([
      "iron",
      "calcium",
      "vitamin_d",
      "vitamin_b12",
      "magnesium",
      "zinc",
      "folate",
      "potassium",
    ]);
    expect(getPreset("vegan")?.nutrients).toHaveLength(6);
    expect(getPreset("bone")?.nutrients).toHaveLength(5);
    expect(getPreset("pregnancy")?.nutrients).toHaveLength(5);
    expect(getPreset("everything")?.nutrients).toEqual(MICRO_IDS);
  });

  it("recognises the active preset regardless of order", () => {
    expect(
      matchingPreset(["calcium", "vitamin_d", "vitamin_k", "magnesium", "phosphorus"])?.id,
    ).toBe("bone");
    expect(matchingPreset(["iron"])).toBeUndefined();
  });
});

describe("trackedMicros", () => {
  it("tracks everything when the user has no rows", () => {
    expect(trackedMicros([])).toEqual(MICRO_IDS);
  });

  it("drops micros switched off, keeping registry order", () => {
    const rows = MICRO_IDS.map((id) => ({
      nutrientId: id,
      enabled: id === "vitamin_d" || id === "iron" || id === "calcium",
      customGoal: null,
    }));
    expect(trackedMicros(rows)).toEqual(["vitamin_d", "calcium", "iron"]);
  });
});

describe("customGoals", () => {
  it("collects overrides only", () => {
    expect(
      customGoals([
        { nutrientId: "iron", enabled: true, customGoal: 27 },
        { nutrientId: "zinc", enabled: false, customGoal: null },
        { nutrientId: "protein", enabled: true, customGoal: 150 },
      ]),
    ).toEqual({ iron: 27, protein: 150 });
  });
});

describe("visibleNutrients", () => {
  const tracked = ["iron", "calcium", "vitamin_d"] as const;

  it("shows all macros plus the tracked micros", () => {
    const visible = visibleNutrients(tracked);
    expect(visible.filter((id) => MICRO_IDS.includes(id)).sort()).toEqual([
      "calcium",
      "iron",
      "vitamin_d",
    ]);
    expect(visible.filter((id) => !MICRO_IDS.includes(id))).toEqual(MACRO_IDS);
  });

  it("narrows to one category with a Day-view filter", () => {
    expect(visibleNutrients(tracked, "mineral")).toEqual(["calcium", "iron"]);
    expect(visibleNutrients(tracked, "vitamin")).toEqual(["vitamin_d"]);
    expect(visibleNutrients(tracked, "macro")).toEqual(MACRO_IDS);
  });
});
