"use client";

import { useId, useState } from "react";
import { formatAmount, formatNumber } from "@/lib/format";
import type { NutrientDefinition } from "@/lib/nutrients/registry";
import type { NutrientValue } from "./NutrientList";

const ESTIMATE_NOTE =
  "Absorption is an estimate: it varies between people and depends on the whole meal. Figures come from published studies; the range shows how uncertain they are.";

function Consumed({ value, unit }: { value: NutrientValue; unit: NutrientDefinition["unit"] }) {
  if (value.amount === null) {
    return (
      <span className="text-muted italic" title="FoodData Central has no data for this">
        no data
      </span>
    );
  }
  return (
    <>
      {formatAmount(value.amount, unit)}
      {value.partial && (
        <span className="text-amber-600" title="Some foods have no data for this nutrient">
          *
        </span>
      )}
    </>
  );
}

/** "~X unit" with "range Y–Z" underneath; equal ends mean a single fixed factor. */
function AbsorbedText({ value, unit }: { value: NutrientValue; unit: NutrientDefinition["unit"] }) {
  const e = value.estimate!;
  if (e.basis === "as-eaten") return <span className="text-muted">as eaten</span>;
  const showRange =
    e.low !== null && e.high !== null && formatNumber(e.low) !== formatNumber(e.high);
  return (
    <span className="flex flex-col items-end leading-tight">
      <span>~{formatAmount(e.absorbed!, unit)}</span>
      {showRange && (
        <span className="text-xs text-muted">
          range {formatNumber(e.low!)}–{formatNumber(e.high!)}
        </span>
      )}
    </span>
  );
}

/** One nutrient: eaten amount, and (when given) the absorbed estimate with tap-to-explain. */
export function NutrientRow({
  def,
  value,
  indented,
  showAbsorbed,
}: {
  def: NutrientDefinition;
  value: NutrientValue;
  indented: boolean;
  showAbsorbed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const e = value.estimate;
  const explainable = showAbsorbed && e && e.absorbed !== null;

  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between gap-3">
        <dt className={`min-w-0 flex-1 ${indented ? "pl-3 text-muted" : ""}`}>{def.name}</dt>
        <dd className="w-20 shrink-0 text-right tabular-nums">
          <Consumed value={value} unit={def.unit} />
        </dd>
        {showAbsorbed && (
          <dd className="w-28 shrink-0 text-right tabular-nums">
            {explainable ? (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={panelId}
                title={[ESTIMATE_NOTE, ...e.reasons].join("\n• ")}
                className="-my-1 inline-flex min-h-9 items-center rounded-md px-1 text-right text-emerald-800 underline decoration-dotted underline-offset-4 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950"
              >
                <AbsorbedText value={value} unit={def.unit} />
              </button>
            ) : (
              <span className="text-muted">–</span>
            )}
          </dd>
        )}
      </div>
      {explainable && open && (
        <div
          id={panelId}
          className="mt-1 mb-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <p className="font-medium">Why this estimate</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {e.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted">{ESTIMATE_NOTE}</p>
        </div>
      )}
    </div>
  );
}
