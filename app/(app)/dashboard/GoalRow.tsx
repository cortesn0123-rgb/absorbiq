"use client";

import { useId, useState } from "react";
import { formatAmount, formatNumber } from "@/lib/format";
import type { GoalRowData } from "@/lib/logs/day-goals";
import type { GoalStatus } from "@/lib/nutrients/goals";

const BAR_COLORS: Record<GoalStatus, string> = {
  none: "bg-zinc-300 dark:bg-zinc-700",
  under: "bg-emerald-400 dark:bg-emerald-600",
  met: "bg-emerald-600 dark:bg-emerald-500",
  "under-limit": "bg-sky-500",
  "over-limit": "bg-red-500",
};

const SCORE_NOTE =
  "Absorption score = estimated absorbed ÷ what a typical diet absorbs from your goal amount. 1.0 means typical; above 1, your pairings help absorption; below 1, they hold it back or you ate less. It is an estimate for spotting relative weak spots, not a target.";

/** One goal on the Day view: consumed vs goal bar, and optionally the absorption score. */
export function GoalRow({ row }: { row: GoalRowData }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pct = row.ratio === null ? 0 : Math.min(row.ratio, 1) * 100;

  return (
    <li className="py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        title={row.source}
        className="flex w-full flex-col gap-1 text-left"
      >
        <span className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 flex-1">{row.name}</span>
          <span className="text-right tabular-nums">
            {row.consumed === null ? (
              <span className="text-zinc-400 italic">no data</span>
            ) : (
              formatAmount(row.consumed, row.unit)
            )}
            {row.partial && <span className="text-amber-600">*</span>}
            <span className="text-zinc-500"> / {row.goalLabel}</span>
          </span>
        </span>
        <span
          className="block h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          role="progressbar"
          aria-label={`${row.name} consumed vs goal`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <span
            className={`block h-full rounded-full ${BAR_COLORS[row.status]}`}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="flex flex-wrap justify-between gap-x-3 text-xs text-zinc-500">
          <span>
            {row.ratio !== null && `${Math.round(row.ratio * 100)}%`}
            {row.status === "over-limit" && (
              <span className="text-red-600 dark:text-red-400"> · over the limit</span>
            )}
            {row.detail && ` · ${row.detail}`}
          </span>
          {row.score && (
            <span title={SCORE_NOTE}>
              Absorption score ~{formatNumber(row.score.value)}
              <span className="text-zinc-400">
                {" "}
                ({formatNumber(row.score.low)}–{formatNumber(row.score.high)})
              </span>
            </span>
          )}
        </span>
      </button>
      {row.overUl && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          ⚠ Above the {formatAmount(row.overUl.ul, row.unit)} tolerable upper limit from food.
        </p>
      )}
      {open && (
        <div
          id={panelId}
          className="mt-1 mb-1 rounded-lg bg-zinc-50 p-3 text-xs whitespace-pre-line text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <p className="font-medium">About this goal</p>
          <p className="mt-1">{row.source}</p>
          {row.score && (
            <p className="mt-2">
              {SCORE_NOTE} A typical diet meeting your goal absorbs ~
              {formatAmount(row.score.expected, row.unit)}.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
