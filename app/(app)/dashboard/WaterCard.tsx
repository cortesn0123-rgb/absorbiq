"use client";

import { useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import type { WaterEntry } from "@/lib/logs/queries";
import { MAX_WATER_ML } from "@/lib/logs/validate";
import { addWater, deleteWater } from "../actions";

const QUICK_ML = [250, 500];

const buttonClass =
  "h-11 rounded-lg border border-sky-600 px-4 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-60 dark:text-sky-400 dark:hover:bg-sky-950";

/** One-tap water logging. Water from food is counted separately, from FDC data. */
export function WaterCard({
  date,
  entries,
  foodWaterMl,
  foodWaterPartial,
}: {
  date: string;
  entries: WaterEntry[];
  /** Water in logged foods; null when no logged food has data. */
  foodWaterMl: number | null;
  foodWaterPartial: boolean;
}) {
  const [custom, setCustom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const drinksMl = entries.reduce((sum, e) => sum + e.ml, 0);
  const customMl = custom === null ? NaN : Number(custom);
  const customValid = Number.isInteger(customMl) && customMl > 0 && customMl <= MAX_WATER_ML;

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Water</h2>
        <p className="text-sm text-muted tabular-nums">
          {foodWaterMl === null
            ? "No food water data"
            : `+ ${formatNumber(foodWaterMl)} mL from food${foodWaterPartial ? "*" : ""}`}
        </p>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {formatNumber(drinksMl)} <span className="text-base font-normal text-muted">mL drunk</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_ML.map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={() => run(() => addWater(date, ml))}
            disabled={pending}
            className={buttonClass}
          >
            +{ml} mL
          </button>
        ))}
        {custom === null ? (
          <button type="button" onClick={() => setCustom("")} className={buttonClass}>
            Custom
          </button>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!customValid) return;
              run(async () => {
                const result = await addWater(date, customMl);
                if (result.ok) setCustom(null);
                return result;
              });
            }}
          >
            <input
              inputMode="numeric"
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
              aria-label="Millilitres"
              placeholder="mL"
              className="h-11 w-24 rounded-lg border border-zinc-300 bg-transparent px-3 text-base tabular-nums outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-700"
            />
            <button type="submit" disabled={!customValid || pending} className={buttonClass}>
              Add
            </button>
            <button
              type="button"
              onClick={() => setCustom(null)}
              className="h-11 px-2 text-sm text-muted"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {entries.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Water logged">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex h-9 items-center gap-1 rounded-full bg-sky-50 pl-3 text-sm text-sky-900 tabular-nums dark:bg-sky-950 dark:text-sky-100"
            >
              {e.ml} mL
              <button
                type="button"
                onClick={() => run(() => deleteWater(e.id))}
                disabled={pending}
                aria-label={`Remove ${e.ml} mL`}
                className="flex size-9 items-center justify-center rounded-full text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
