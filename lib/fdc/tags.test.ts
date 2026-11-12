import { describe, expect, it } from "vitest";
import { normalizeFood } from "./normalize";
import branded from "./fixtures/branded.json";
import sr from "./fixtures/sr.json";
import survey from "./fixtures/survey.json";
import { classifyFoodGroup, isLowOxalateGreen, tagFood, type TagInput } from "./tags";

function tags(description: string, extra: Partial<TagInput> = {}) {
  return tagFood({
    description,
    category: null,
    dataType: "SR Legacy",
    ingredients: null,
    fatPer100g: undefined,
    ...extra,
  });
}

describe("tagFood on real FDC foods", () => {
  it("tags cooked lentils as a high-phytate, non-heme legume", () => {
    expect(normalizeFood(sr).tags).toEqual({
      isHemeSource: false,
      phytateLevel: "high",
      oxalateLevel: "none",
      isFortified: false,
      fatG: 0.38,
    });
  });

  it("tags a survey lentil dish and plain branded lentils", () => {
    expect(normalizeFood(survey).tags.phytateLevel).toBe("high");
    expect(normalizeFood(branded).tags).toMatchObject({ phytateLevel: "high", isFortified: false });
  });
});

describe("heme sources", () => {
  it.each([
    ["Beef, ground, 80% lean meat / 20% fat, raw", "Beef Products"],
    ["Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Poultry Products"],
    ["Fish, salmon, Atlantic, farmed, cooked, dry heat", "Finfish and Shellfish Products"],
    ["Crustaceans, shrimp, cooked", "Finfish and Shellfish Products"],
    ["Ham, sliced, regular", "Sausages and Luncheon Meats"],
    ["Turkey sandwich", "Turkey, duck, other poultry"],
    ["Hamburger on bun", null],
  ])("%s", (description, category) => {
    expect(tags(description, { category }).isHemeSource).toBe(true);
  });

  it.each([
    ["Eggs, whole, raw", "Dairy and Egg Products"],
    ["Veggie burger", null],
    ["Soup, chicken broth, ready-to-serve", "Soups, Sauces, and Gravies"],
    ["Nuts, coconut meat, raw", "Nut and Seed Products"],
    ["Ramen noodles, chicken flavor, dry", null],
    ["Spinach, raw", "Vegetables and Vegetable Products"],
  ])("not %s", (description, category) => {
    expect(tags(description, { category }).isHemeSource).toBe(false);
  });
});

describe("phytate", () => {
  it.each([
    ["Chickpeas (garbanzo beans), mature seeds, cooked", "Legumes and Legume Products", "high"],
    ["Nuts, almonds", "Nut and Seed Products", "high"],
    ["Seeds, chia seeds, dried", "Nut and Seed Products", "high"],
    ["Peanut butter, smooth style", "Legumes and Legume Products", "high"],
    ["Cereals, oats, regular and quick, not fortified, dry", "Breakfast Cereals", "medium"],
    ["Bread, whole-wheat, commercially prepared", "Baked Products", "medium"],
    ["Rice, brown, long-grain, cooked", "Cereal Grains and Pasta", "medium"],
    ["Rice, white, long-grain, regular, cooked", "Cereal Grains and Pasta", "low"],
    ["Bread, white, commercially prepared", "Baked Products", "low"],
    ["Beans, snap, green, raw", "Vegetables and Vegetable Products", "none"],
    ["Oil, sunflower, linoleic", "Fats and Oils", "none"],
    ["Soy sauce made from soy and wheat (shoyu)", "Soups, Sauces, and Gravies", "none"],
    ["Apples, raw, with skin", "Fruits and Fruit Juices", "none"],
  ])("%s → %s", (description, category, level) => {
    expect(tags(description, { category }).phytateLevel).toBe(level);
  });
});

describe("oxalate", () => {
  it.each(["Spinach, raw", "Chard, swiss, cooked", "Beet greens, raw", "Rhubarb, raw"])(
    "%s is high",
    (description) => {
      expect(tags(description).oxalateLevel).toBe("high");
    },
  );

  it("leaves other foods untagged", () => {
    expect(tags("Kale, raw").oxalateLevel).toBe("none");
  });
});

describe("fortification", () => {
  it("tags branded foods whose ingredients list added vitamins or minerals", () => {
    const input = {
      dataType: "Branded",
      ingredients: "WHOLE GRAIN OATS, SUGAR, SALT, REDUCED IRON, FOLIC ACID, VITAMIN D3.",
    };
    expect(tags("TOASTED OAT CEREAL", input).isFortified).toBe(true);
  });

  it("does not tag branded foods without added nutrients", () => {
    expect(tags("LENTILS", { dataType: "Branded", ingredients: "LENTILS." }).isFortified).toBe(
      false,
    );
  });

  it("only reads ingredient lists of branded foods", () => {
    expect(tags("Something", { ingredients: "folic acid" }).isFortified).toBe(false);
  });

  it("tags generic foods described as fortified or enriched, but not 'not fortified'", () => {
    expect(tags("Cereals ready-to-eat, corn flakes, fortified").isFortified).toBe(true);
    expect(tags("Bread, white, commercially prepared, enriched").isFortified).toBe(true);
    expect(tags("Soymilk, original, unfortified").isFortified).toBe(false);
    expect(tags("Cereals, oats, not fortified, dry").isFortified).toBe(false);
  });
});

describe("fat", () => {
  it("records fat per 100 g, or null when FDC has no data", () => {
    expect(tags("Oil", { fatPer100g: 100 }).fatG).toBe(100);
    expect(tags("Water").fatG).toBeNull();
  });
});

describe("food groups", () => {
  it.each([
    [
      "Lentils, mature seeds, cooked, boiled, without salt",
      "Legumes and Legume Products",
      "legume",
    ],
    ["Peanut butter, smooth style", "Legumes and Legume Products", "nut_seed"],
    ["Soybeans, mature seeds, cooked", "Legumes and Legume Products", "soy"],
    ["Tofu, raw, firm", null, "soy"],
    ["Beverages, tea, black, brewed", "Beverages", "tea"],
    ["Tea, hot, leaf, green", "Tea", "tea"],
    ["Coffee, brewed from grounds", "Beverages", "coffee"],
    ["Milk, whole, 3.25% milkfat", "Dairy and Egg Products", "dairy"],
    ["Almond milk, unsweetened", null, "nut_seed"],
    ["Egg, whole, cooked, hard-boiled", "Dairy and Egg Products", "egg"],
    ["Beef, ground, 85% lean meat / 15% fat, cooked", "Beef Products", "meat"],
    ["Fish, salmon, Atlantic, farmed, cooked", "Finfish and Shellfish Products", "fish"],
    ["Veggie burger", null, "other"],
    ["Rice, brown, long-grain, cooked", "Cereal Grains and Pasta", "grain"],
    ["Spinach, raw", "Vegetables and Vegetable Products", "vegetable"],
    ["Beans, snap, green, raw", "Vegetables and Vegetable Products", "vegetable"],
    ["Orange juice, raw", "Fruits and Fruit Juices", "fruit"],
    ["Seeds, chia seeds, dried", "Nut and Seed Products", "nut_seed"],
  ])("%s → %s", (name, category, group) => {
    expect(classifyFoodGroup(name, category)).toBe(group);
  });

  it("does not treat coffee cake as coffee", () => {
    expect(classifyFoodGroup("Coffee cake, crumb-topped", "Baked Products")).toBe("grain");
  });

  it("falls back to the category when the name does not match", () => {
    expect(classifyFoodGroup("Babaganoush", "Vegetables and Vegetable Products")).toBe("vegetable");
    expect(classifyFoodGroup("Mystery food", null)).toBe("other");
  });

  it("recognizes low-oxalate greens", () => {
    expect(isLowOxalateGreen("Kale, raw")).toBe(true);
    expect(isLowOxalateGreen("Broccoli, cooked")).toBe(true);
    expect(isLowOxalateGreen("Spinach, raw")).toBe(false);
  });
});
