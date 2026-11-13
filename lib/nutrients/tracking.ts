/**
 * Which nutrients the user tracks. Users choose vitamins and minerals; macros are always shown.
 * Every list, chart and the AI helper should read `visibleNutrients` / `trackedMicros` so the
 * whole app respects the selection.
 */

import { NUTRIENT_LIST, type NutrientCategory, type NutrientId } from "./registry";

/** Vitamins and minerals, in registry order: the nutrients a user can switch on and off. */
export const MICRO_IDS: readonly NutrientId[] = NUTRIENT_LIST.filter(
  (d) => d.category !== "macro",
).map((d) => d.id);

const MICRO_SET = new Set<NutrientId>(MICRO_IDS);

export function isMicro(id: NutrientId): boolean {
  return MICRO_SET.has(id);
}

export interface Preset {
  id: string;
  label: string;
  nutrients: readonly NutrientId[];
}

export const PRESETS: readonly Preset[] = [
  {
    id: "essentials",
    label: "Essentials",
    nutrients: [
      "iron",
      "calcium",
      "vitamin_d",
      "vitamin_b12",
      "magnesium",
      "zinc",
      "folate",
      "potassium",
    ],
  },
  {
    id: "vegan",
    label: "Vegan focus",
    nutrients: ["vitamin_b12", "iron", "zinc", "calcium", "iodine", "vitamin_d"],
  },
  {
    id: "bone",
    label: "Bone health",
    nutrients: ["calcium", "vitamin_d", "vitamin_k", "magnesium", "phosphorus"],
  },
  {
    id: "pregnancy",
    label: "Pregnancy",
    nutrients: ["folate", "iron", "iodine", "choline", "vitamin_d"],
  },
  { id: "everything", label: "Everything", nutrients: MICRO_IDS },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Preset whose nutrients are exactly the tracked set, if any. */
export function matchingPreset(tracked: readonly NutrientId[]): Preset | undefined {
  const set = new Set(tracked);
  return PRESETS.find(
    (p) => p.nutrients.length === set.size && p.nutrients.every((id) => set.has(id)),
  );
}

export interface TrackingRow {
  nutrientId: NutrientId;
  enabled: boolean;
  customGoal: number | null;
}

/** Tracked micros in registry order. A micro with no row is tracked (the default is everything). */
export function trackedMicros(rows: readonly TrackingRow[]): NutrientId[] {
  const off = new Set(rows.filter((r) => !r.enabled).map((r) => r.nutrientId));
  return MICRO_IDS.filter((id) => !off.has(id));
}

export function customGoals(rows: readonly TrackingRow[]): Partial<Record<NutrientId, number>> {
  const goals: Partial<Record<NutrientId, number>> = {};
  for (const r of rows) if (r.customGoal !== null) goals[r.nutrientId] = r.customGoal;
  return goals;
}

/** Day-view chips that narrow the list for the moment (not saved). */
export const VIEW_FILTERS = ["all", "macro", "vitamin", "mineral"] as const;
export type ViewFilter = (typeof VIEW_FILTERS)[number];

export const VIEW_FILTER_LABELS: Record<ViewFilter, string> = {
  all: "All",
  macro: "Macros",
  vitamin: "Vitamins",
  mineral: "Minerals",
};

export function isViewFilter(value: unknown): value is ViewFilter {
  return (VIEW_FILTERS as readonly unknown[]).includes(value);
}

/** Macros plus tracked micros, narrowed to one category by `filter`, in registry order. */
export function visibleNutrients(
  tracked: readonly NutrientId[],
  filter: ViewFilter = "all",
): NutrientId[] {
  const trackedSet = new Set(tracked);
  return NUTRIENT_LIST.filter(
    (d) =>
      (d.category === "macro" || trackedSet.has(d.id)) &&
      (filter === "all" || d.category === (filter satisfies NutrientCategory)),
  ).map((d) => d.id);
}
