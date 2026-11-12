"use client";

import { useState, useTransition } from "react";
import { MacroLine } from "@/components/MacroLine";
import { MealPicker } from "@/components/MealPicker";
import { NutrientList, valuesFromAmounts } from "@/components/NutrientList";
import { PortionInput } from "@/components/PortionInput";
import { formatNumber, formatPortion } from "@/lib/format";
import { initialChoice, resolveChoice } from "@/lib/logs/portion-choice";
import type { LoggedFood } from "@/lib/logs/queries";
import { MAX_PORTION_GRAMS, nutrientsForGrams } from "@/lib/nutrients/portion";
import { deleteLog, setFavorite, updateLog } from "../actions";

const actionClass =
  "h-10 rounded-lg px-3 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-zinc-900";

/** One logged food: summary row that expands to every nutrient, with edit and delete. */
export function FoodRow({
  log,
  isFavorite,
  snackNumbers,
}: {
  log: LoggedFood;
  isFavorite: boolean;
  snackNumbers: number[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const amounts = nutrientsForGrams(log.food.nutrientsPer100g, log.grams);
  const saved = {
    grams: log.grams,
    portionLabel: log.portionLabel,
    portionCount: log.portionCount,
  };

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li className="py-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left"
      >
        <span className="flex flex-col">
          <span>
            {log.food.name}
            {isFavorite && (
              <span className="ml-1 text-amber-500" aria-label="Favorite">
                ★
              </span>
            )}
          </span>
          <span className="text-xs text-zinc-500">
            {formatPortion(log.grams, log.portionLabel, log.portionCount)}
            {log.portionLabel && ` · ${formatNumber(log.grams)} g`}
            {log.food.brand && ` · ${log.food.brand}`}
          </span>
          <span className="text-xs">
            <MacroLine amounts={amounts} />
          </span>
        </span>
        <span aria-hidden className="text-zinc-400">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 pb-3">
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {editing ? (
            <EditForm
              log={log}
              snackNumbers={snackNumbers}
              pending={pending}
              onCancel={() => setEditing(false)}
              onSave={(changes) =>
                run(async () => {
                  const result = await updateLog(log.id, changes);
                  if (result.ok) setEditing(false);
                  return result;
                })
              }
            />
          ) : (
            <>
              <NutrientList values={valuesFromAmounts(amounts)} />
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => setEditing(true)} className={actionClass}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => run(() => setFavorite(log.food.id, isFavorite ? null : saved))}
                  disabled={pending}
                  aria-pressed={isFavorite}
                  className={actionClass}
                >
                  {isFavorite ? "★ Unfavorite" : "☆ Favorite"}
                </button>
                {confirmDelete ? (
                  <>
                    <button
                      type="button"
                      onClick={() => run(() => deleteLog(log.id))}
                      disabled={pending}
                      className={`${actionClass} text-red-600 dark:text-red-400`}
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className={actionClass}
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className={`${actionClass} text-red-600 dark:text-red-400`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function EditForm({
  log,
  snackNumbers,
  pending,
  onSave,
  onCancel,
}: {
  log: LoggedFood;
  snackNumbers: number[];
  pending: boolean;
  onSave: (changes: { occasion: LoggedFood["occasion"]; portion: unknown }) => void;
  onCancel: () => void;
}) {
  const [occasion, setOccasion] = useState(log.occasion);
  const [choice, setChoice] = useState(() =>
    initialChoice(log.food.portions, {
      grams: log.grams,
      portionLabel: log.portionLabel,
      portionCount: log.portionCount,
    }),
  );
  const resolved = resolveChoice(choice, log.food.portions);
  const portion = resolved && resolved.grams <= MAX_PORTION_GRAMS ? resolved : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
      <MealPicker
        value={occasion}
        onChange={setOccasion}
        snackNumbers={snackNumbers}
        defaultSnack={log.occasion.snackNumber ?? snackNumbers.at(-1) ?? 1}
      />
      <PortionInput portions={log.food.portions} value={choice} onChange={setChoice} />
      <p className="text-sm">
        {portion ? (
          <>
            <span className="text-zinc-500">{formatNumber(portion.grams)} g · </span>
            <MacroLine amounts={nutrientsForGrams(log.food.nutrientsPer100g, portion.grams)} />
          </>
        ) : (
          <span className="text-red-600 dark:text-red-400">
            Enter an amount up to {MAX_PORTION_GRAMS} g.
          </span>
        )}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => portion && onSave({ occasion, portion })}
          disabled={!portion || pending}
          className="h-11 flex-1 rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-lg px-4 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
