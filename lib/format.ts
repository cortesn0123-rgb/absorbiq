import type { Unit } from "@/lib/nutrients/registry";

/** Rounds for display: more decimals for small amounts, none for large ones. */
export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  const digits = abs === 0 || abs >= 10 ? 0 : abs >= 1 ? 1 : abs >= 0.1 ? 2 : 3;
  const rounded = Number(value.toFixed(digits));
  // Below the shown precision, say so rather than printing 0.
  if (rounded === 0 && abs > 0) return `<${(10 ** -digits).toFixed(digits)}`;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: digits });
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
