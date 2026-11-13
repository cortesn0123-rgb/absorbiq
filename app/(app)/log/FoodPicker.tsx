"use client";

import { useState } from "react";
import { MacroLine } from "@/components/MacroLine";
import { NutrientList, valuesFromAmounts } from "@/components/NutrientList";
import { PortionInput } from "@/components/PortionInput";
import type { FoodRecord } from "@/lib/fdc/record";
import { formatNumber } from "@/lib/format";
import { initialChoice, resolveChoice } from "@/lib/logs/portion-choice";
import type { PortionInput as Portion } from "@/lib/logs/validate";
import { MAX_PORTION_GRAMS, nutrientsForGrams } from "@/lib/nutrients/portion";
import type { NutrientId } from "@/lib/nutrients/registry";

/** Choose how much of a food, preview it, and save. */
export function FoodPicker({
  food,
  saved,
  isFavorite,
  pending,
  onSave,
  onToggleFavorite,
  onCancel,
  visible,
}: {
  food: FoodRecord;
  saved?: Portion;
  isFavorite: boolean;
  pending: boolean;
  onSave: (portion: Portion, addAnother: boolean) => void;
  onToggleFavorite: (portion: Portion | null) => void;
  onCancel: () => void;
  visible: readonly NutrientId[];
}) {
  const [choice, setChoice] = useState(() => initialChoice(food.portions, saved));
  const resolved = resolveChoice(choice, food.portions);
  const portion = resolved && resolved.grams <= MAX_PORTION_GRAMS ? resolved : null;
  const amounts = portion ? nutrientsForGrams(food.nutrientsPer100g, portion.grams) : null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{food.name}</h2>
          {food.brand && <p className="text-sm text-zinc-500">{food.brand}</p>}
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorite(isFavorite ? null : portion)}
          disabled={pending || (!isFavorite && !portion)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites with this portion"}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-2xl text-amber-500 hover:bg-amber-50 disabled:opacity-50 dark:hover:bg-amber-950"
        >
          {isFavorite ? "★" : "☆"}
        </button>
      </div>

      <PortionInput portions={food.portions} value={choice} onChange={setChoice} />

      <div className="text-sm" aria-live="polite">
        {portion && amounts ? (
          <>
            <span className="text-zinc-500">{formatNumber(portion.grams)} g · </span>
            <MacroLine amounts={amounts} />
          </>
        ) : (
          <span className="text-red-600 dark:text-red-400">
            Enter an amount up to {MAX_PORTION_GRAMS} g.
          </span>
        )}
      </div>

      {amounts && (
        <details className="text-sm">
          <summary className="cursor-pointer py-1 text-zinc-600 dark:text-zinc-400">
            Nutrients for this portion
          </summary>
          <div className="pt-2">
            <NutrientList values={valuesFromAmounts(amounts)} visible={visible} />
          </div>
        </details>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => portion && onSave(portion, false)}
          disabled={!portion || pending}
          className="h-12 flex-1 rounded-lg bg-emerald-600 text-base font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => portion && onSave(portion, true)}
          disabled={!portion || pending}
          className="h-12 flex-1 rounded-lg border border-emerald-600 text-base font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          Save & add another
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-12 rounded-lg px-4 text-base text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          Back
        </button>
      </div>
    </section>
  );
}
