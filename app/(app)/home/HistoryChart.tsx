"use client";

import Link from "next/link";
import { useState } from "react";
import { BAND_LABELS, type Band, type HistoryRow } from "@/lib/logs/dashboard";
import { BAND_FILL, BAND_INK, OVER_BANDS } from "./bands";

const RANGES = [7, 30] as const;
type Range = (typeof RANGES)[number];

const LEGEND: readonly Band[] = ["low", "partway", "met", "near-limit", "over-limit", "over-ul"];

const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "narrow" });
const monthDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * Percent of goal per nutrient per day, as a grid: one row per nutrient, one column per day.
 * Tap a cell for the amounts; tap a day to open it in the Day view.
 */
export function HistoryChart({ dates, rows }: { dates: string[]; rows: HistoryRow[] }) {
  const [range, setRange] = useState<Range>(7);
  const [selected, setSelected] = useState<{ row: number; day: number } | null>(null);
  const start = Math.max(0, dates.length - range);
  const days = dates.slice(start);
  const pick = selected && selected.day >= start ? selected : null;
  const showText = range === 7;

  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          % of goal by day
        </h2>
        <div role="group" aria-label="Range" className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={r === range}
              className="h-9 rounded-full border border-zinc-300 px-3 text-sm font-medium aria-pressed:border-emerald-600 aria-pressed:bg-emerald-600 aria-pressed:text-white dark:border-zinc-700"
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-3 text-sm text-zinc-500">No tracked nutrients with a goal.</p>
      ) : (
        <div
          className="mt-3 grid items-center gap-x-px gap-y-0.5 text-xs"
          style={{ gridTemplateColumns: `minmax(5.5rem, 7rem) repeat(${days.length}, 1fr)` }}
        >
          <span />
          {days.map((d, i) => (
            <Link
              key={d}
              href={`/dashboard?date=${d}`}
              title={`Open ${monthDay.format(utc(d))} in the Day view`}
              className="flex h-6 items-center justify-center text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {showText
                ? weekday.format(utc(d))
                : (start + i) % 7 === (dates.length - 1) % 7
                  ? utc(d).getUTCDate()
                  : ""}
            </Link>
          ))}
          {rows.map((row, r) => (
            <Row
              key={row.id}
              row={row}
              rowIndex={r}
              start={start}
              showText={showText}
              selected={pick}
              onSelect={(day) =>
                setSelected(pick?.row === r && pick.day === day ? null : { row: r, day })
              }
            />
          ))}
        </div>
      )}

      <p className="mt-3 min-h-5 text-sm tabular-nums" aria-live="polite">
        {pick ? (
          <>
            <span className="font-medium">{rows[pick.row].name}</span>,{" "}
            {monthDay.format(utc(dates[pick.day]))}: {rows[pick.row].cells[pick.day].detail}
            {rows[pick.row].cells[pick.day].ratio !== null &&
              ` (${Math.round(rows[pick.row].cells[pick.day].ratio! * 100)}%, ${BAND_LABELS[rows[pick.row].cells[pick.day].band]})`}
          </>
        ) : (
          <span className="text-zinc-500">Tap a square for the amounts, or a day to open it.</span>
        )}
      </p>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {LEGEND.map((b) => (
          <li key={b} className="flex items-center gap-1">
            <span
              className={`flex size-3 items-center justify-center rounded-sm text-[8px] font-bold ${BAND_FILL[b]} ${BAND_INK[b]}`}
            >
              {OVER_BANDS.has(b) && "!"}
            </span>
            {BAND_LABELS[b]}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="size-3 rounded-sm border border-zinc-300 dark:border-zinc-700" />
          Nothing logged
        </li>
      </ul>
      <p className="mt-2 text-xs text-zinc-500">
        Based on what you ate (consumed), the same as the Day view. Added sugars use your highest
        meal of the day.
      </p>
    </section>
  );
}

function Row({
  row,
  rowIndex,
  start,
  showText,
  selected,
  onSelect,
}: {
  row: HistoryRow;
  rowIndex: number;
  start: number;
  showText: boolean;
  selected: { row: number; day: number } | null;
  onSelect: (day: number) => void;
}) {
  return (
    <>
      <span className="truncate pr-2 text-zinc-700 dark:text-zinc-300" title={row.name}>
        {row.name}
      </span>
      {row.cells.slice(start).map((cell, i) => {
        const day = start + i;
        const isSelected = selected?.row === rowIndex && selected.day === day;
        const empty = cell.ratio === null;
        const over = OVER_BANDS.has(cell.band);
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-label={`${row.name}: ${cell.detail}${empty ? "" : `, ${Math.round(cell.ratio! * 100)}%, ${BAND_LABELS[cell.band]}`}`}
            aria-pressed={isSelected}
            className={`flex h-6 min-w-0 items-center justify-center overflow-hidden rounded-sm text-[10px] leading-none font-medium tabular-nums ${
              empty
                ? "border border-zinc-200 dark:border-zinc-800"
                : `${BAND_FILL[cell.band]} ${BAND_INK[cell.band]}`
            } ${isSelected ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-zinc-100 dark:ring-offset-zinc-950" : ""}`}
          >
            {!empty &&
              (showText
                ? `${over ? "!" : ""}${Math.min(Math.round(cell.ratio! * 100), 999)}`
                : over && "!")}
          </button>
        );
      })}
    </>
  );
}
