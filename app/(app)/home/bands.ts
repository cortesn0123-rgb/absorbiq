import type { Band } from "@/lib/logs/dashboard";

/** Fill colour per band. Never used alone: every bar and cell also has a text label. */
export const BAND_FILL: Record<Band, string> = {
  none: "bg-zinc-300 dark:bg-zinc-700",
  low: "bg-status-serious",
  partway: "bg-status-warning",
  met: "bg-status-good",
  "under-limit": "bg-sky-500",
  "near-limit": "bg-status-warning",
  "over-limit": "bg-status-critical",
  "over-ul": "bg-status-critical",
};

/** Text that stays readable on the band's fill (chart cells). */
export const BAND_INK: Record<Band, string> = {
  none: "text-zinc-500",
  low: "text-zinc-950",
  partway: "text-zinc-950",
  met: "text-white",
  "under-limit": "text-white",
  "near-limit": "text-zinc-950",
  "over-limit": "text-white",
  "over-ul": "text-white",
};

/** Text colour for the band's label next to a bar. */
export const BAND_TEXT: Record<Band, string> = {
  none: "text-zinc-500",
  low: "text-orange-700 dark:text-orange-400",
  partway: "text-amber-700 dark:text-amber-400",
  met: "text-green-700 dark:text-green-400",
  "under-limit": "text-zinc-500",
  "near-limit": "text-amber-700 dark:text-amber-400",
  "over-limit": "text-red-700 dark:text-red-400",
  "over-ul": "text-red-700 dark:text-red-400",
};

export const OVER_BANDS = new Set<Band>(["over-limit", "over-ul"]);
