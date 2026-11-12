import { describe, expect, it } from "vitest";
import { NUTRIENT_IDS, type NutrientId } from "@/lib/nutrients/registry";
import { absorbDay, absorbMeal } from "./engine";
import { DEFAULT_FACTORS, FactorTable, curveAt } from "./factor-table";
import { FACTOR_ROWS } from "./factors";
import { b12AbsorbedPerMeal, phytateZincRatio } from "./rules";
import {
  blackTea,
  carrots,
  coffee,
  food,
  kale,
  lentils,
  liver,
  milk,
  oliveOil,
  orangeJuice,
  salmon,
  spinach,
  steak,
} from "./test-foods";
import type { EngineFood, MealAbsorption } from "./types";

const get = (meal: MealAbsorption, index: number, id: NutrientId) =>
  meal.foods[index].nutrients[id];
const fraction = (meal: MealAbsorption, index: number, id: NutrientId) => {
  const e = get(meal, index, id);
  return e.absorbed! / e.consumed!;
};
const hasReason = (reasons: string[], text: RegExp) => reasons.some((r) => text.test(r));

/** A food that is only non-heme iron, plus whatever else is given. */
const ironOnly = (extra: Record<string, number> = {}): EngineFood =>
  food("Iron test food", 100, { iron: 10, water: 100, ...extra });

// ---------------------------------------------------------------------------
// Iron
// ---------------------------------------------------------------------------

describe("non-heme iron: Monsen–Balintfy enhancers", () => {
  it("starts at 3% with no enhancers or inhibitors, ranging with iron status", () => {
    const e = get(absorbMeal([ironOnly()]), 0, "iron");
    expect(e.absorbed).toBeCloseTo(0.3); // 10 mg x 3%
    expect(e.low).toBeCloseTo(0.195); // x 15/23
    expect(e.high).toBeCloseTo(0.456); // x 35/23
  });

  it("follows 3 + 8.93 ln((EF + 100) / 100) percent", () => {
    // EF = 25 mg vitamin C: 3 + 8.93 x ln(1.25) = 4.99%
    expect(fraction(absorbMeal([ironOnly({ vitamin_c: 25 })]), 0, "iron")).toBeCloseTo(0.04993, 4);
  });

  it("reaches 8% at 75 enhancing units and rises no further", () => {
    const at75 = fraction(absorbMeal([ironOnly({ vitamin_c: 75 })]), 0, "iron");
    const at300 = fraction(absorbMeal([ironOnly({ vitamin_c: 300 })]), 0, "iron");
    expect(at75).toBeCloseTo(0.07997, 4);
    expect(at300).toBeCloseTo(at75, 10);
  });

  it("reproduces Hallberg's phytate dose-response points", () => {
    const at = (mgP: number) =>
      curveAt(DEFAULT_FACTORS, "iron", "phytate_p_mg", mgP, "value", "log");
    expect(at(0)).toBe(1);
    expect(at(2)).toBeCloseTo(0.82);
    expect(at(25)).toBeCloseTo(0.36);
    expect(at(250)).toBeCloseTo(0.18);
    expect(at(1000)).toBeCloseTo(0.18);
    expect(at(10)).toBeLessThan(0.82);
    expect(at(10)).toBeGreaterThan(0.36);
  });

  it("lowers absorption by 50–60% at 165 mg calcium, phased in below it", () => {
    const at = (mg: number) => curveAt(DEFAULT_FACTORS, "iron", "calcium_mg", mg, "value");
    expect(at(165)).toBeCloseTo(0.45);
    expect(at(400)).toBeCloseTo(0.45);
    expect(at(82.5)).toBeCloseTo(0.725);
  });
});

describe("lentils with and without orange juice", () => {
  const alone = absorbMeal([lentils()]);
  const withOj = absorbMeal([lentils(), orangeJuice()]);

  it("orange juice raises the iron absorbed from the lentils", () => {
    expect(get(withOj, 0, "iron").absorbed!).toBeGreaterThan(2 * get(alone, 0, "iron").absorbed!);
    expect(get(withOj, 0, "iron").consumed).toBe(get(alone, 0, "iron").consumed);
  });

  it("raises the meal's total absorbed iron and explains why", () => {
    expect(withOj.totals.iron.absorbed!).toBeGreaterThan(alone.totals.iron.absorbed!);
    expect(hasReason(get(withOj, 0, "iron").reasons, /Vitamin C in this meal \(127 mg\)/)).toBe(
      true,
    );
  });

  it("explains the lentils' phytate and their small vitamin C content when eaten alone", () => {
    const reasons = get(alone, 0, "iron").reasons;
    expect(hasReason(reasons, /Phytate in this meal .* lowers non-heme iron/)).toBe(true);
    expect(hasReason(reasons, /Vitamin C in this meal \(3 mg\)/)).toBe(true);
  });

  it("says when a meal has no enhancers at all", () => {
    expect(
      hasReason(get(absorbMeal([ironOnly()]), 0, "iron").reasons, /No vitamin C or meat/),
    ).toBe(true);
  });

  it("orange juice at another meal does not help the lentils", () => {
    const day = absorbDay([
      { key: "breakfast", label: "Breakfast", foods: [orangeJuice()] },
      { key: "lunch", label: "Lunch", foods: [lentils()] },
    ]);
    const lunchLentils = day.meals[1].absorption.foods[0].nutrients.iron;
    expect(lunchLentils.absorbed).toBeCloseTo(get(alone, 0, "iron").absorbed!, 10);
  });
});

describe("lentils with tea or coffee", () => {
  const alone = get(absorbMeal([lentils()]), 0, "iron");

  it("tea lowers non-heme iron absorption by about 62%", () => {
    const withTea = get(absorbMeal([lentils(), blackTea()]), 0, "iron");
    expect(withTea.absorbed! / alone.absorbed!).toBeCloseTo(0.38, 2);
    expect(
      hasReason(withTea.reasons, /Tea with this meal lowers non-heme iron absorption by about 62%/),
    ).toBe(true);
  });

  it("coffee lowers it less than tea", () => {
    const withCoffee = get(absorbMeal([lentils(), coffee()]), 0, "iron");
    // 37% from coffee, plus a little from its 5 mg of calcium.
    const ratio = withCoffee.absorbed! / alone.absorbed!;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(0.63);
  });

  it("half a cup has half the effect", () => {
    const halfCup = get(absorbMeal([lentils(), blackTea(100)]), 0, "iron");
    expect(halfCup.absorbed! / alone.absorbed!).toBeCloseTo(1 - 0.62 * 0.5, 2);
  });

  it("milk's calcium lowers the lentils' iron absorption", () => {
    const withMilk = get(absorbMeal([lentils(), milk()]), 0, "iron");
    expect(withMilk.absorbed!).toBeLessThan(alone.absorbed!);
    expect(hasReason(withMilk.reasons, /Calcium in this meal/)).toBe(true);
  });
});

describe("steak and spinach", () => {
  const meal = absorbMeal([steak(), spinach()]);
  const hemePart = 200 * 0.029 * 0.4 * 0.23; // 5.8 mg iron, 40% heme, 23% absorbed

  it("absorbs the steak's heme iron at 23% plus some non-heme iron", () => {
    const e = get(meal, 0, "iron");
    expect(e.absorbed!).toBeGreaterThan(hemePart);
    expect(e.absorbed!).toBeLessThan(hemePart + 0.6 * 5.8 * 0.08);
    expect(hasReason(e.reasons, /heme iron .* absorbed at about 23%/)).toBe(true);
  });

  it("meat raises the spinach's non-heme iron absorption", () => {
    const spinachAlone = get(absorbMeal([spinach()]), 0, "iron");
    expect(get(meal, 1, "iron").absorbed!).toBeGreaterThan(spinachAlone.absorbed!);
    expect(
      hasReason(get(meal, 1, "iron").reasons, /Meat, poultry or fish in this meal \(about 200 g\)/),
    ).toBe(true);
  });

  it("estimates the meat in mixed dishes from protein", () => {
    const soup = food(
      "Soup, chicken noodle",
      500,
      { iron: 1, protein: 3 },
      { isHemeSource: true, foodGroup: "meat" },
    );
    const e = get(absorbMeal([soup]), 0, "iron");
    expect(hasReason(e.reasons, /about 60 g/)).toBe(true); // 15 g protein x 4
  });

  it("tea does not reduce heme iron", () => {
    const withTea = get(absorbMeal([steak(), blackTea()]), 0, "iron");
    expect(withTea.absorbed!).toBeGreaterThan(hemePart);
    expect(withTea.absorbed!).toBeLessThan(get(absorbMeal([steak()]), 0, "iron").absorbed!);
  });

  it("absorbs only about 5% of the spinach's calcium", () => {
    expect(fraction(meal, 1, "calcium")).toBeCloseTo(0.05);
    expect(hasReason(get(meal, 1, "calcium").reasons, /high in oxalate/)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Zinc
// ---------------------------------------------------------------------------

describe("zinc and the phytate:zinc molar ratio", () => {
  it("computes the molar ratio", () => {
    expect(phytateZincRatio(660.04, 65.38)).toBeCloseTo(1);
    expect(phytateZincRatio(100, 0)).toBe(0);
  });

  it("absorbs 50% with no phytate", () => {
    const meal = absorbMeal([steak()]);
    expect(fraction(meal, 0, "zinc")).toBeCloseTo(0.5);
    expect(hasReason(get(meal, 0, "zinc").reasons, /no phytate/)).toBe(true);
  });

  it("absorbs 15% from a cup of lentils (ratio over 15)", () => {
    const meal = absorbMeal([lentils()]);
    expect(fraction(meal, 0, "zinc")).toBeCloseTo(0.15);
    expect(hasReason(get(meal, 0, "zinc").reasons, /molar ratio of this meal is about 28/)).toBe(
      true,
    );
  });

  it("absorbs 30% at a moderate ratio (5–15)", () => {
    // 100 g dry whole grain: 1000 mg phytate; 9.9 mg zinc gives a ratio of 10.
    const grain = food(
      "Whole grain test",
      100,
      { zinc: 9.9, water: 0 },
      { phytateLevel: "medium", foodGroup: "grain" },
    );
    expect(fraction(absorbMeal([grain]), 0, "zinc")).toBeCloseTo(0.3);
  });

  it("is a meal effect: steak's zinc is absorbed less when eaten with lentils", () => {
    const meal = absorbMeal([steak(), lentils()]);
    expect(fraction(meal, 0, "zinc")).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Calcium
// ---------------------------------------------------------------------------

describe("calcium by food", () => {
  it("absorbs far more calcium from kale than from spinach", () => {
    const kaleMeal = absorbMeal([kale()]);
    const spinachMeal = absorbMeal([spinach()]);
    expect(fraction(kaleMeal, 0, "calcium")).toBeCloseTo(0.53);
    expect(fraction(spinachMeal, 0, "calcium")).toBeCloseTo(0.05);
    expect(get(kaleMeal, 0, "calcium").absorbed!).toBeGreaterThan(
      10 * get(spinachMeal, 0, "calcium").absorbed!,
    );
  });

  it("uses 30% for dairy and fortified foods", () => {
    expect(fraction(absorbMeal([milk()]), 0, "calcium")).toBeCloseTo(0.3);
    const cereal = food(
      "Cereal, fortified",
      40,
      { calcium: 1000 },
      { isFortified: true, foodGroup: "grain" },
    );
    expect(fraction(absorbMeal([cereal]), 0, "calcium")).toBeCloseTo(0.3);
  });

  it("reduces calcium from high-phytate legumes to 24%", () => {
    expect(fraction(absorbMeal([lentils()]), 0, "calcium")).toBeCloseTo(0.24);
  });

  it("uses 25% for other foods and notes the decline with age", () => {
    const meal = absorbMeal([orangeJuice()], { age: 60, sex: "female", lifeStage: "none" });
    expect(fraction(meal, 0, "calcium")).toBeCloseTo(0.25);
    expect(hasReason(get(meal, 0, "calcium").reasons, /declines with age/)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fat-soluble vitamins
// ---------------------------------------------------------------------------

describe("salad with and without oil", () => {
  const plain = absorbMeal([spinach(), carrots()]);
  const dressed = absorbMeal([spinach(), carrots(), oliveOil()]);

  it("absorbs much less vitamin K without oil", () => {
    expect(fraction(dressed, 0, "vitamin_k")).toBeCloseTo(0.1);
    // 0.48 g fat: multiplier 0.31 + 0.69 x 0.48 / 5
    expect(fraction(plain, 0, "vitamin_k")).toBeCloseTo(0.1 * (0.31 + (0.69 * 0.4755) / 5), 3);
    expect(hasReason(get(plain, 0, "vitamin_k").reasons, /only 0.48 g of fat/)).toBe(true);
  });

  it("absorbs much less carotenoid vitamin A without oil", () => {
    expect(fraction(dressed, 1, "vitamin_a")).toBeCloseTo(1);
    expect(fraction(plain, 1, "vitamin_a")).toBeLessThan(0.25);
  });

  it("applies the stored multiplier at zero fat", () => {
    const zeroFat = food("Zero-fat greens", 100, { vitamin_k: 100, fat: 0 });
    expect(fraction(absorbMeal([zeroFat]), 0, "vitamin_k")).toBeCloseTo(0.1 * 0.31);
  });

  it("absorbs a third of vitamin E with fat, a tenth without", () => {
    expect(fraction(dressed, 2, "vitamin_e")).toBeCloseTo(0.33);
    const fatFree = food("Vitamin E test", 100, { vitamin_e: 10, fat: 0 });
    expect(fraction(absorbMeal([fatFree]), 0, "vitamin_e")).toBeCloseTo(0.33 * 0.3);
  });

  it("lowers vitamin D by about a quarter in a fat-free meal", () => {
    const mushrooms = food("Mushrooms, UV-exposed", 100, { vitamin_d: 10, fat: 0 });
    expect(fraction(absorbMeal([mushrooms]), 0, "vitamin_d")).toBeCloseTo(0.76);
    expect(fraction(absorbMeal([mushrooms, oliveOil()]), 0, "vitamin_d")).toBeCloseTo(1);
  });

  it("does not reduce preformed vitamin A (retinol) in a low-fat meal", () => {
    const meal = absorbMeal([liver(50)]); // 2.65 g fat
    expect(get(meal, 0, "vitamin_a").absorbed).toBeCloseTo(get(meal, 0, "vitamin_a").consumed!);
  });
});

describe("vitamin A and folate are never double converted", () => {
  it("counts vitamin A (RAE) exactly as reported when the meal has fat", () => {
    for (const meal of [absorbMeal([liver()]), absorbMeal([carrots(), oliveOil()])]) {
      const e = get(meal, 0, "vitamin_a");
      expect(e.absorbed).toBe(e.consumed);
      expect(e.low).toBe(e.consumed);
      expect(e.high).toBe(e.consumed);
      expect(hasReason(e.reasons, /RAE .* No second conversion/)).toBe(true);
    }
  });

  it("counts folate (DFE) exactly as reported in every food", () => {
    const meal = absorbMeal([lentils(), orangeJuice(), spinach(), liver()]);
    for (const f of meal.foods) {
      const e = f.nutrients.folate;
      expect(e.absorbed).toBe(e.consumed);
      expect(e.low).toBe(e.consumed);
      expect(e.high).toBe(e.consumed);
      expect(hasReason(e.reasons, /DFE .* No second conversion/)).toBe(true);
    }
  });

  it("never absorbs more vitamin A or folate than was eaten", () => {
    const meal = absorbMeal([liver(), spinach(), carrots(), lentils(), orangeJuice()]);
    for (const f of meal.foods) {
      for (const id of ["vitamin_a", "folate"] as const) {
        const e = f.nutrients[id];
        if (e.consumed !== null) expect(e.high!).toBeLessThanOrEqual(e.consumed + 1e-9);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// B12 and vitamin C
// ---------------------------------------------------------------------------

describe("vitamin B12 per meal", () => {
  it("absorbs about 50% of a 1 mcg dose", () => {
    expect(b12AbsorbedPerMeal(1, DEFAULT_FACTORS, "value")).toBeCloseTo(0.5, 2);
  });

  it("absorbs about 1.3% of a 500 mcg dose (mostly passive)", () => {
    expect(b12AbsorbedPerMeal(500, DEFAULT_FACTORS, "value") / 500).toBeCloseTo(0.013, 3);
  });

  it("absorbs more from two 2 mcg meals than from one 4 mcg meal", () => {
    const twoMeals = absorbDay([
      { key: "lunch", label: "Lunch", foods: [salmon(66.67)] },
      { key: "dinner", label: "Dinner", foods: [salmon(66.67)] },
    ]);
    const oneMeal = absorbDay([{ key: "dinner", label: "Dinner", foods: [salmon(133.33)] }]);
    expect(twoMeals.totals.vitamin_b12.consumed).toBeCloseTo(
      oneMeal.totals.vitamin_b12.consumed!,
      2,
    );
    expect(twoMeals.totals.vitamin_b12.absorbed!).toBeCloseTo(1.518, 2);
    expect(oneMeal.totals.vitamin_b12.absorbed!).toBeCloseTo(1.03, 2);
  });

  it("splits a meal's absorbed B12 between foods by their share", () => {
    const meal = absorbMeal([steak(), milk()]);
    const steakB12 = get(meal, 0, "vitamin_b12");
    const milkB12 = get(meal, 1, "vitamin_b12");
    expect(steakB12.absorbed! / steakB12.consumed!).toBeCloseTo(
      milkB12.absorbed! / milkB12.consumed!,
    );
  });

  it("notes lower absorption after 50", () => {
    const meal = absorbMeal([steak()], { age: 70, sex: "male", lifeStage: "none" });
    expect(hasReason(get(meal, 0, "vitamin_b12").reasons, /atrophic gastritis/)).toBe(true);
  });
});

describe("vitamin C", () => {
  it("absorbs about 80% at normal doses", () => {
    expect(fraction(absorbMeal([orangeJuice()]), 0, "vitamin_c")).toBeCloseTo(0.8);
  });

  it("absorbs less at very high doses per meal", () => {
    const dose = (mg: number) =>
      fraction(absorbMeal([food("C", 100, { vitamin_c: mg })]), 0, "vitamin_c");
    expect(dose(590)).toBeCloseTo(0.625);
    expect(dose(1500)).toBeCloseTo(0.45);
  });
});

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------

describe("macros", () => {
  it("uses protein digestibility by food group", () => {
    expect(fraction(absorbMeal([lentils()]), 0, "protein")).toBeCloseTo(0.78);
    expect(fraction(absorbMeal([steak()]), 0, "protein")).toBeCloseTo(0.94);
    expect(fraction(absorbMeal([milk()]), 0, "protein")).toBeCloseTo(0.95);
    expect(fraction(absorbMeal([orangeJuice()]), 0, "protein")).toBeCloseTo(0.92);
  });

  it("excludes fiber from absorbed carbohydrate", () => {
    const e = get(absorbMeal([lentils()]), 0, "carbohydrate");
    expect(e.absorbed).toBeCloseTo((20.13 - 7.9) * 1.98 * 0.97, 3);
  });

  it("absorbs 95% of fat and its fatty acids", () => {
    const meal = absorbMeal([steak()]);
    expect(fraction(meal, 0, "fat")).toBeCloseTo(0.95);
    expect(fraction(meal, 0, "saturated_fat")).toBeCloseTo(0.95);
  });

  it("counts calories, fiber and water as eaten", () => {
    const meal = absorbMeal([lentils()]);
    expect(fraction(meal, 0, "energy")).toBe(1);
    expect(get(meal, 0, "fiber").basis).toBe("as-eaten");
    expect(get(meal, 0, "water").basis).toBe("as-eaten");
    expect(get(meal, 0, "fiber").absorbed).toBe(get(meal, 0, "fiber").consumed);
  });

  it("absorbs about 55% of cholesterol", () => {
    expect(fraction(absorbMeal([steak()]), 0, "cholesterol")).toBeCloseTo(0.55);
  });
});

// ---------------------------------------------------------------------------
// Other minerals and vitamins
// ---------------------------------------------------------------------------

describe("other nutrients", () => {
  it("makes copper absorption depend on the day's copper", () => {
    const at = (mg: number) => fraction(absorbMeal([food("Cu", 100, { copper: mg })]), 0, "copper");
    expect(at(0.4)).toBeCloseTo(0.75);
    expect(at(7.5)).toBeCloseTo(0.12);
    expect(at(1.5)).toBeLessThan(0.75);
    expect(at(1.5)).toBeGreaterThan(0.12);
  });

  it("uses the whole day's copper inside absorbDay", () => {
    const day = absorbDay([
      { key: "a", label: "Breakfast", foods: [food("Cu", 100, { copper: 0.4 })] },
      { key: "b", label: "Lunch", foods: [food("Cu", 100, { copper: 7.1 })] },
    ]);
    const breakfast = day.meals[0].absorption.foods[0].nutrients.copper;
    expect(breakfast.absorbed! / breakfast.consumed!).toBeCloseTo(0.12);
  });

  it("treats niacin in unfortified grains as 30% available", () => {
    const rice = food("Rice, brown", 100, { niacin: 2 }, { foodGroup: "grain" });
    const cereal = food(
      "Cereal, fortified",
      100,
      { niacin: 2 },
      { foodGroup: "grain", isFortified: true },
    );
    expect(fraction(absorbMeal([rice]), 0, "niacin")).toBeCloseTo(0.3);
    expect(fraction(absorbMeal([cereal]), 0, "niacin")).toBeCloseTo(1);
  });

  it("uses single baseline factors from ODS", () => {
    const f = food("Mixed", 100, {
      magnesium: 100,
      potassium: 100,
      sodium: 100,
      manganese: 1,
      vitamin_b6: 1,
    });
    const meal = absorbMeal([f]);
    expect(fraction(meal, 0, "magnesium")).toBeCloseTo(0.35);
    expect(fraction(meal, 0, "potassium")).toBeCloseTo(0.875);
    expect(fraction(meal, 0, "sodium")).toBeCloseTo(0.98);
    expect(fraction(meal, 0, "manganese")).toBeCloseTo(0.03);
    expect(fraction(meal, 0, "vitamin_b6")).toBeCloseTo(0.75);
    expect(get(meal, 0, "magnesium").low).toBeCloseTo(30);
    expect(get(meal, 0, "magnesium").high).toBeCloseTo(40);
  });
});

// ---------------------------------------------------------------------------
// Engine behaviour
// ---------------------------------------------------------------------------

describe("engine", () => {
  const mixed = absorbMeal([
    steak(),
    spinach(),
    lentils(),
    orangeJuice(),
    milk(),
    oliveOil(),
    blackTea(),
  ]);

  it("keeps low <= absorbed <= high and never absorbs more than eaten", () => {
    for (const f of mixed.foods) {
      for (const id of NUTRIENT_IDS) {
        const e = f.nutrients[id];
        if (e.consumed === null) continue;
        expect(e.low!).toBeLessThanOrEqual(e.absorbed! + 1e-9);
        expect(e.absorbed!).toBeLessThanOrEqual(e.high! + 1e-9);
        expect(e.high!).toBeLessThanOrEqual(e.consumed + 1e-9);
      }
    }
  });

  it("gives every absorbed estimate at least one reason", () => {
    for (const f of mixed.foods) {
      for (const id of NUTRIENT_IDS) expect(f.nutrients[id].reasons.length).toBeGreaterThan(0);
    }
  });

  it("reports missing data as null, not zero, and counts it in totals", () => {
    const meal = absorbMeal([lentils(), orangeJuice()]);
    expect(get(meal, 0, "added_sugars")).toMatchObject({ consumed: null, absorbed: null });
    expect(meal.totals.added_sugars).toMatchObject({
      consumed: null,
      absorbed: null,
      missingCount: 2,
    });
    expect(meal.totals.vitamin_c.missingCount).toBe(0);
  });

  it("sums foods into meal totals", () => {
    const meal = absorbMeal([lentils(), orangeJuice()]);
    expect(meal.totals.iron.absorbed).toBeCloseTo(
      get(meal, 0, "iron").absorbed! + get(meal, 1, "iron").absorbed!,
    );
    expect(meal.totals.iron.low).toBeLessThan(meal.totals.iron.absorbed!);
  });

  it("returns empty totals for an empty meal", () => {
    const meal = absorbMeal([]);
    expect(meal.foods).toEqual([]);
    expect(meal.totals.iron).toMatchObject({ consumed: null, missingCount: 0 });
  });

  it("sums meals into day totals and labels meal-specific reasons", () => {
    const day = absorbDay([
      { key: "breakfast", label: "Breakfast", foods: [lentils(), orangeJuice()] },
      { key: "lunch", label: "Lunch", foods: [lentils()] },
    ]);
    expect(day.totals.iron.absorbed).toBeCloseTo(
      day.meals[0].absorption.totals.iron.absorbed! + day.meals[1].absorption.totals.iron.absorbed!,
    );
    expect(hasReason(day.totals.iron.reasons, /^Breakfast: Vitamin C/)).toBe(true);
    expect(day.totals.added_sugars.missingCount).toBe(3);
  });

  it("applies changed factors to the same logs (results are never stored)", () => {
    const base = get(absorbMeal([steak()]), 0, "iron").absorbed!;
    const heme = FACTOR_ROWS.find((r) => r.nutrient === "iron" && r.key === "heme_absorption")!;
    const table = FactorTable.withOverrides([{ ...heme, value: 0.35, low: 0.35, high: 0.35 }]);
    expect(get(absorbMeal([steak()], undefined, table), 0, "iron").absorbed!).toBeGreaterThan(base);
  });

  it("fails clearly when a factor is missing", () => {
    expect(() => new FactorTable([]).get("iron", "heme_absorption")).toThrow(
      /Missing absorption factor iron\/heme_absorption/,
    );
  });
});
