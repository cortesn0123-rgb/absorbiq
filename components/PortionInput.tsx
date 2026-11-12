"use client";

import type { Portion } from "@/lib/fdc/portions";
import { formatNumber } from "@/lib/format";
import { parseQuantity, type PortionChoice } from "@/lib/logs/portion-choice";
import { chipClass } from "./MealPicker";

const QUICK_COUNTS = ["0.5", "1", "1.5", "2"];
const COUNT_LABELS: Record<string, string> = { "0.5": "½", "1.5": "1½" };

const inputClass =
  "h-11 w-24 rounded-lg border border-zinc-300 bg-transparent px-3 text-base tabular-nums outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 dark:border-zinc-700";

/** Pick a household portion (and how many), or enter grams. */
export function PortionInput({
  portions,
  value,
  onChange,
}: {
  portions: readonly Portion[];
  value: PortionChoice;
  onChange: (choice: PortionChoice) => void;
}) {
  const count = value.kind === "portion" ? parseQuantity(value.count) : null;
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Portion" className="flex flex-wrap gap-2">
        {portions.map((p, index) => {
          const selected = value.kind === "portion" && value.index === index;
          return (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() =>
                onChange({ kind: "portion", index, count: selected ? value.count : "1" })
              }
              className={chipClass(selected)}
            >
              {p.label}{" "}
              <span className={selected ? "text-emerald-100" : "text-zinc-500"}>
                · {formatNumber(p.grams)} g
              </span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={value.kind === "grams"}
          onClick={() => value.kind !== "grams" && onChange({ kind: "grams", grams: "100" })}
          className={chipClass(value.kind === "grams")}
        >
          Grams
        </button>
      </div>

      {value.kind === "portion" ? (
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_COUNTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...value, count: c })}
              className={chipClass(count === Number(c))}
              aria-label={`${c} portions`}
            >
              {COUNT_LABELS[c] ?? c}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="sr-only">Number of portions</span>×
            <input
              inputMode="decimal"
              value={value.count}
              onChange={(e) => onChange({ ...value, count: e.target.value })}
              onFocus={(e) => e.target.select()}
              aria-invalid={count === null}
              className={inputClass}
            />
          </label>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <input
            inputMode="decimal"
            value={value.grams}
            onChange={(e) => onChange({ kind: "grams", grams: e.target.value })}
            onFocus={(e) => e.target.select()}
            aria-invalid={parseQuantity(value.grams) === null}
            aria-label="Grams"
            className={inputClass}
          />
          g
        </label>
      )}
    </div>
  );
}
