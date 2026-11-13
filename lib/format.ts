import type { Unit } from "@/lib/nutrients/registry";

const NUMBER_FORMATS = [0, 1, 2, 3].map(
  (digits) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }),
);

/** Rounds for display: more decimals for small amounts, none for large ones. */
export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  const digits = abs === 0 || abs >= 10 ? 0 : abs >= 1 ? 1 : abs >= 0.1 ? 2 : 3;
  const rounded = Number(value.toFixed(digits));
  // Below the shown precision, say so rather than printing 0.
  if (rounded === 0 && abs > 0) return `<${(10 ** -digits).toFixed(digits)}`;
  return NUMBER_FORMATS[digits].format(rounded);
}

export function formatAmount(value: number, unit: Unit): string {
  return `${formatNumber(value)} ${unit}`;
}

/** "1 cup", "1.5 × 1 cup", or "150 g" when logged in grams. */
export function formatPortion(
  grams: number,
  portionLabel: string | null,
  portionCount: number | null,
): string {
  if (!portionLabel || !portionCount) return `${formatNumber(grams)} g`;
  return portionCount === 1 ? portionLabel : `${formatNumber(portionCount)} × ${portionLabel}`;
}

/** FDC name prefixes that name a category rather than the food ("Beverages, tea, black"). */
const CATEGORY_HEADS = new Set([
  "beverages",
  "cereals",
  "cereals ready-to-eat",
  "fast foods",
  "restaurant",
  "snacks",
  "soup",
  "spices",
]);

/** "Lentils, mature seeds, cooked" → "lentils"; "Cereals, oats, cooked" → "oats". */
export function shortFoodName(name: string): string {
  const parts = name
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return name.trim().toLowerCase();
  return CATEGORY_HEADS.has(parts[0]) && parts.length > 1 ? parts[1] : parts[0];
}

/** "A", "A and K", "A, D and K". */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
