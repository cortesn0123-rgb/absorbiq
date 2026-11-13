import { formatAmount, formatNumber } from "@/lib/format";
import { BAND_LABELS, bandOf } from "@/lib/logs/dashboard";
import type { GoalRowData } from "@/lib/logs/day-goals";
import { BAND_FILL, BAND_TEXT, OVER_BANDS } from "./bands";

export const MARKER_NOTE =
  "The bar is what you ate compared with your goal. The thin marker is your absorption score: estimated absorbed ÷ what a typical diet absorbs from your goal amount. The marker at the end of the bar means you absorbed about as much as a typical diet that meets the goal. Absorbed amounts are estimates that depend on what you ate together.";

/**
 * Consumed vs goal, coloured and labelled by band, with an optional faint marker at the
 * absorption score (never absorbed vs goal; see CLAUDE.md).
 */
export function NutrientBar({
  row,
  showMarker,
  showScore,
  compact = false,
}: {
  row: GoalRowData;
  /** Faint marker at the absorption score, with "~X absorbed" (scored nutrients only). */
  showMarker: boolean;
  /** Also print the score's value (the profile's goal view setting). */
  showScore: boolean;
  compact?: boolean;
}) {
  const band = bandOf(row);
  const pct = row.ratio === null ? 0 : Math.min(row.ratio, 1) * 100;
  const score = showMarker ? row.score : null;
  const markerPct = score ? Math.min(score.value, 1) * 100 : null;

  return (
    <div className={compact ? "py-1.5" : "py-2"}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 flex-1">{row.name}</span>
        <span className="text-right tabular-nums">
          {row.consumed === null ? (
            <span className="text-zinc-400 italic">no data</span>
          ) : (
            formatAmount(row.consumed, row.unit)
          )}
          {row.partial && (
            <span className="text-amber-600" title="Some foods have no data for this nutrient">
              *
            </span>
          )}
          <span className="text-zinc-500"> / {row.goalLabel}</span>
        </span>
      </div>
      <div className="relative mt-1">
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          role="progressbar"
          aria-label={`${row.name}: eaten vs ${row.status.includes("limit") ? "limit" : "goal"}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={`${row.ratio === null ? "no data" : `${Math.round(row.ratio * 100)}%`}, ${BAND_LABELS[band]}`}
        >
          <div className={`h-full rounded-full ${BAND_FILL[band]}`} style={{ width: `${pct}%` }} />
        </div>
        {markerPct !== null && (
          <div
            className="absolute -top-0.5 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-zinc-900/45 dark:bg-white/55"
            style={{ left: `${Math.max(markerPct, 1)}%` }}
            title={MARKER_NOTE}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-0.5 flex flex-wrap justify-between gap-x-3 text-xs text-zinc-500">
        <span>
          <span className={`font-medium ${BAND_TEXT[band]}`}>
            {OVER_BANDS.has(band) && "⚠ "}
            {BAND_LABELS[band]}
          </span>
          {row.ratio !== null && ` · ${Math.round(row.ratio * 100)}%`}
          {row.detail && ` · ${row.detail}`}
        </span>
        {score && row.absorbed && (
          <span title={MARKER_NOTE} className="tabular-nums">
            ~{formatAmount(row.absorbed.value, row.unit)} absorbed
            {showScore && ` · score ~${formatNumber(score.value)}`}
          </span>
        )}
      </div>
    </div>
  );
}
