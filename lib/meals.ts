/**
 * Meal occasions. Breakfast, lunch and dinner are one occasion each per day; snacks are
 * numbered (Snack 1, Snack 2, ...) and each one is its own occasion, so per-meal limits are
 * checked per snack and snacks are never summed together.
 */

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MAX_SNACKS_PER_DAY = 20;

export interface MealOccasion {
  slot: MealSlot;
  /** 1-based; set only when slot is "snack". */
  snackNumber: number | null;
}

export function isMealSlot(value: unknown): value is MealSlot {
  return typeof value === "string" && (MEAL_SLOTS as readonly string[]).includes(value);
}

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function slotLabel(slot: MealSlot): string {
  return SLOT_LABELS[slot];
}

export function occasionKey({ slot, snackNumber }: MealOccasion): string {
  return slot === "snack" ? `snack-${snackNumber ?? 1}` : slot;
}

export function occasionLabel({ slot, snackNumber }: MealOccasion): string {
  return slot === "snack" ? `Snack ${snackNumber ?? 1}` : SLOT_LABELS[slot];
}

/** Breakfast, lunch, dinner, then snacks in number order. */
export function compareOccasions(a: MealOccasion, b: MealOccasion): number {
  const slot = MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot);
  return slot !== 0 ? slot : (a.snackNumber ?? 0) - (b.snackNumber ?? 0);
}

/** A sensible slot for "now", by local hour (0–23). */
export function defaultMealSlot(hour: number): MealSlot {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

/** Foods logged to a snack within this many minutes of each other default to the same snack. */
export const SNACK_GROUP_MINUTES = 60;

export interface SnackSummary {
  snackNumber: number;
  /** ISO timestamp of the most recent food logged to this snack. */
  lastLoggedAt: string;
}

/**
 * Snack number to preselect: the latest snack if something was logged to it in the last
 * SNACK_GROUP_MINUTES (e.g. adding peanut butter to the apple just logged), else a new snack.
 */
export function defaultSnackNumber(snacks: readonly SnackSummary[], now: Date): number {
  if (snacks.length === 0) return 1;
  const latest = snacks.reduce((a, b) => (b.lastLoggedAt > a.lastLoggedAt ? b : a));
  const minutesAgo = (now.getTime() - new Date(latest.lastLoggedAt).getTime()) / 60_000;
  if (minutesAgo >= 0 && minutesAgo < SNACK_GROUP_MINUTES) return latest.snackNumber;
  return nextSnackNumber(snacks);
}

export function nextSnackNumber(snacks: readonly { snackNumber: number }[]): number {
  const next = Math.max(0, ...snacks.map((s) => s.snackNumber)) + 1;
  return Math.min(next, MAX_SNACKS_PER_DAY);
}

/** Snacks already logged on a day, for choosing which snack a new food belongs to. */
export function snackSummaries(
  logs: readonly { occasion: MealOccasion; createdAt: string }[],
): SnackSummary[] {
  const byNumber = new Map<number, string>();
  for (const { occasion, createdAt } of logs) {
    if (occasion.slot !== "snack" || occasion.snackNumber === null) continue;
    const last = byNumber.get(occasion.snackNumber);
    if (!last || createdAt > last) byNumber.set(occasion.snackNumber, createdAt);
  }
  return [...byNumber]
    .map(([snackNumber, lastLoggedAt]) => ({ snackNumber, lastLoggedAt }))
    .sort((a, b) => a.snackNumber - b.snackNumber);
}
