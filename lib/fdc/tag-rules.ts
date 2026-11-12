/**
 * Food tag rules, applied once when a food is first cached (see tags.ts). Edit this file to
 * change how foods are tagged; foods already cached keep their tags.
 *
 * Patterns are matched case-insensitively against the food's FDC category and description.
 * Category names differ by data type: Foundation/SR Legacy ("Beef Products"), Survey/WWEIA
 * ("Chicken, whole pieces") and Branded ("Frozen Fish & Seafood").
 */

/** Same values as the foods.phytate_level / oxalate_level columns. */
export type TagLevel = "none" | "low" | "medium" | "high";

export interface LevelRule {
  level: TagLevel;
  /** Any match assigns `level`... */
  include: RegExp[];
  /** ...unless one of these also matches; later rules are then tried. */
  exclude?: RegExp[];
}

export interface TagRules {
  /** Meat, poultry, fish and seafood: sources of heme iron. */
  heme: { include: RegExp[]; exclude: RegExp[] };
  /** Phytate (inhibits iron, zinc and calcium absorption). First matching rule wins. */
  phytate: LevelRule[];
  /** Oxalate (inhibits calcium absorption). First matching rule wins. */
  oxalate: LevelRule[];
  /** Foods with added vitamins or minerals. */
  fortified: {
    /** Matched against a branded food's ingredient list. */
    brandedIngredients: RegExp[];
    /** Matched against any food's description, e.g. SR Legacy "..., fortified". */
    description: RegExp[];
    exclude: RegExp[];
  };
}

export const TAG_RULES: TagRules = {
  heme: {
    include: [
      /\b(beef|veal|pork|ham|lamb|mutton|goat|venison|bison|game|meats?)\b/i,
      /\b(poultry|chicken|turkey|duck|goose|quail)\b/i,
      /\b(fish|finfish|seafood|shellfish|salmon|tuna|cod|tilapia|sardines?|anchov(y|ies)|mackerel|trout|halibut|herring|pollock|catfish|haddock)\b/i,
      /\b(shrimp|prawns?|crab|lobster|clams?|mussels?|oysters?|scallops?|squid|octopus|crayfish)\b/i,
      /\b(liver|organ meats?|sausages?|bacon|frankfurters?|hot dogs?|salami|pepperoni|cold cuts|jerky)\b/i,
      /\b(hamburgers?|cheeseburgers?|meatballs?|meatloaf)\b/i,
    ],
    exclude: [
      /\b(vegetarian|vegan|meatless|plant[- ]based|meat substitutes?|imitation|analog)\b/i,
      /\b(flavou?r(ed)?|broth|bouillon|stock|gravy|sauce|fish oil)\b/i,
      /\b(veggie|nut meats?|coconut meat)\b/i,
    ],
  },
  phytate: [
    {
      // Oils and fermented soy sauce carry essentially no phytate, whatever plant they come from.
      level: "none",
      include: [/\boils?\b/i, /\bsoy sauce\b/i],
    },
    {
      level: "high",
      include: [
        /\blegumes?\b/i,
        /\b(beans?|lentils?|chickpeas?|garbanzo|split peas?|black[- ]eyed peas?|soy(beans?)?|tofu|tempeh|edamame|hummus)\b/i,
        /\b(nuts?|almonds?|walnuts?|cashews?|pecans?|pistachios?|peanuts?|hazelnuts?|macadamia|brazil nuts?)\b/i,
        /\b(seeds?|sesame|tahini|flaxseed|flax|chia|hemp|sunflower|pumpkin seeds?)\b/i,
        /\bbran\b/i,
      ],
      // Fresh pods and sweets named after beans are low in phytate.
      // SR Legacy puts the noun first ("Beans, snap, green"), so match both orders.
      exclude: [
        /\b(green|snap|string|wax|jelly|coffee|vanilla) beans?\b/i,
        /\bbeans?, (snap|green|string|wax)\b/i,
        /\bbean sprouts\b/i,
      ],
    },
    {
      level: "medium",
      include: [
        /\bwhole[- ]?(wheat|grains?)\b/i,
        /\b(brown|wild) rice\b|\brice, (brown|wild)\b/i,
        /\b(oats?|oatmeal|quinoa|barley|buckwheat|millet|rye|bulgur|sorghum|amaranth|teff|spelt|farro|granola|muesli|popcorn)\b/i,
      ],
    },
    {
      level: "low",
      include: [
        /\b(cereal grains|baked products|breakfast cereals?|yeast breads|pasta|noodles?)\b/i,
        /\b(bread|bagels?|rolls?|tortillas?|crackers?|rice|flour|corn|cornmeal|grits|couscous)\b/i,
      ],
    },
  ],
  oxalate: [
    {
      level: "high",
      include: [/\b(spinach|chard|beet greens|rhubarb)\b/i],
    },
  ],
  fortified: {
    brandedIngredients: [
      /\b(fortified|enriched)\b/i,
      /\bvitamins? (a|b\d{1,2}|c|d\d?|e|k\d?)\b/i,
      /\b(folic acid|thiamin(e)? (mononitrate|hydrochloride)|riboflavin|niacin(amide)?|pyridoxine|cyanocobalamin|biotin|pantothen(ic acid|ate))\b/i,
      /\b(retinyl palmitate|beta[- ]carotene|cholecalciferol|ergocalciferol|tocopheryl acetate|phylloquinone)\b/i,
      /\b(reduced iron|electrolytic iron|ferrous \w+|ferric \w+|zinc (oxide|sulfate|gluconate|citrate))\b/i,
      /\b(calcium carbonate|tricalcium phosphate|calcium citrate|potassium iodide|magnesium oxide|sodium selenite|chromium (chloride|picolinate)|copper gluconate|cupric \w+|manganese sulfate)\b/i,
    ],
    description: [/\b(fortified|enriched)\b/i],
    exclude: [/\b(not|un)[- ]?(fortified|enriched)\b/i],
  },
};

// ---------------------------------------------------------------------------
// Food groups. Unlike the tags above, these are worked out whenever a food is read (from its
// name and category), so edits here apply to foods already in the cache.
// ---------------------------------------------------------------------------

/** Used for protein digestibility, calcium absorption and tea/coffee effects on iron. */
export const FOOD_GROUPS = [
  "tea",
  "coffee",
  "egg",
  "dairy",
  "fish",
  "meat",
  "soy",
  "nut_seed",
  "legume",
  "grain",
  "vegetable",
  "fruit",
  "other",
] as const;
export type FoodGroup = (typeof FOOD_GROUPS)[number];

export interface GroupRule {
  group: FoodGroup;
  include: RegExp[];
  exclude?: RegExp[];
}

/** First matching rule wins, so order matters (e.g. tea before dairy for "tea with milk"). */
export const FOOD_GROUP_RULES: GroupRule[] = [
  {
    group: "tea",
    include: [/\btea\b/i],
    exclude: [/\btea (cakes?|biscuits?|sandwich(es)?|breads?)\b/i, /\bteaspoons?\b/i],
  },
  {
    group: "coffee",
    include: [/\b(coffee|espresso|cappuccino|latte)\b/i],
    exclude: [/\bcoffee (cakes?|creamers?|whiteners?)\b/i, /\bcoffee[- ]flavou?r(ed)?\b/i],
  },
  {
    group: "egg",
    include: [
      /^eggs?\b/i,
      /\b(egg|eggs), (whole|white|yolk)\b/i,
      /\b(omelets?|omelettes?|scrambled eggs?)\b/i,
    ],
    exclude: [/\begg (noodles?|rolls?|nog)\b/i],
  },
  {
    group: "dairy",
    include: [
      /\b(dairy|milk|cheeses?|yogh?urts?|kefir|cream|buttermilk|cottage|ricotta|mozzarella|cheddar|parmesan)\b/i,
      /^butter\b/i,
    ],
    exclude: [
      /\b(soy|soya|almond|oat|rice|coconut|cashew|hemp|plant[- ]based|nut)\s*(milk|beverage|drink|yogh?urt|cheese)\b/i,
      /\b(peanut|nut|cocoa|apple) butter\b/i,
      /\bmilk chocolate\b/i,
      /\bcream of\b/i,
    ],
  },
  {
    group: "fish",
    include: [
      /\b(fish|finfish|seafood|shellfish|salmon|tuna|cod|tilapia|sardines?|anchov(y|ies)|mackerel|trout|halibut|herring|pollock|catfish|haddock)\b/i,
      /\b(shrimp|prawns?|crab|lobster|clams?|mussels?|oysters?|scallops?|squid|octopus|crayfish|crustaceans|mollusks)\b/i,
    ],
    exclude: [/\bfish (oil|sauce)\b/i, /\bimitation\b/i],
  },
  {
    group: "meat",
    include: [
      /\b(beef|veal|pork|ham|lamb|mutton|goat|venison|bison|game|meats?|poultry|chicken|turkey|duck|goose|quail)\b/i,
      /\b(liver|sausages?|bacon|frankfurters?|hot dogs?|salami|pepperoni|cold cuts|jerky|hamburgers?|meatballs?)\b/i,
    ],
    exclude: [
      /\b(vegetarian|vegan|meatless|plant[- ]based|meat substitutes?|veggie|imitation)\b/i,
      /\b(nut meats?|coconut meat)\b/i,
    ],
  },
  {
    group: "soy",
    include: [/\b(soy|soya|soybeans?|tofu|tempeh|edamame|natto|miso)\b/i],
    exclude: [/\bsoy sauce\b/i],
  },
  {
    group: "legume",
    include: [
      /\blegumes?\b/i,
      /\b(beans?|lentils?|chickpeas?|garbanzo|split peas?|black[- ]eyed peas?|peas, mature|hummus|dal|dhal)\b/i,
    ],
    // Peanuts are botanically legumes but digest like nuts (WHO 2007).
    exclude: [
      /\bpeanuts?\b/i,
      /\b(green|snap|string|wax|jelly|coffee|vanilla) beans?\b/i,
      /\bbeans?, (snap|green|string|wax)\b/i,
    ],
  },
  {
    group: "nut_seed",
    include: [
      /\bnut and seed\b/i,
      /\b(nuts?|almonds?|walnuts?|cashews?|pecans?|pistachios?|peanuts?|hazelnuts?|macadamia|brazil nuts?)\b/i,
      /\b(seeds?|sesame|tahini|flaxseed|chia|sunflower|pumpkin seeds?)\b/i,
    ],
    exclude: [/\b(nutmeg|coconut|butternut|doughnut)\b/i],
  },
  {
    group: "grain",
    include: [
      /\b(cereal grains|baked products|breakfast cereals?|yeast breads|pasta|noodles?)\b/i,
      /\b(bread|bagels?|rolls?|tortillas?|crackers?|rice|flour|corn ?meal|grits|couscous|oats?|oatmeal|quinoa|barley|buckwheat|millet|rye|bulgur|wheat|cereals?|granola|muesli)\b/i,
    ],
  },
  {
    group: "vegetable",
    include: [
      /\bvegetables?\b/i,
      /\b(greens|spinach|kale|chard|lettuce|broccoli|cabbage|carrots?|tomato(es)?|potato(es)?|peppers?|onions?|squash)\b/i,
    ],
  },
  {
    group: "fruit",
    include: [
      /\bfruits?\b/i,
      /\b(juice|apples?|bananas?|oranges?|berries|grapes?|melons?|pears?|peaches?|citrus)\b/i,
    ],
  },
];

/**
 * Low-oxalate leafy greens and brassicas whose calcium is well absorbed (measured: kale,
 * bok choy, broccoli; Weaver et al. 1999).
 */
export const LOW_OXALATE_GREENS: RegExp[] = [/\b(kale|bok choy|pak choi|pak-choi|broccoli)\b/i];
