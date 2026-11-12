"use client";

import {
  MEAL_SLOTS,
  nextSnackNumber,
  slotLabel,
  type MealOccasion,
  type MealSlot,
} from "@/lib/meals";

export function chipClass(selected: boolean): string {
  return `h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
    selected
      ? "border-emerald-600 bg-emerald-600 text-white"
      : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
  }`;
}

/**
 * Breakfast / Lunch / Dinner / Snack, and which snack. Each snack is its own meal for per-meal
 * limits, so the user picks an existing snack or starts a new one.
 */
export function MealPicker({
  value,
  onChange,
  snackNumbers,
  defaultSnack,
}: {
  value: MealOccasion;
  onChange: (occasion: MealOccasion) => void;
  /** Snacks already logged that day. */
  snackNumbers: readonly number[];
  /** Snack to select when the user taps "Snack". */
  defaultSnack: number;
}) {
  const newSnack = nextSnackNumber(snackNumbers.map((snackNumber) => ({ snackNumber })));
  const snackChoices = [...new Set([...snackNumbers, value.snackNumber ?? newSnack])]
    .filter((n) => n !== newSnack)
    .sort((a, b) => a - b);

  const pickSlot = (slot: MealSlot) =>
    onChange({ slot, snackNumber: slot === "snack" ? defaultSnack : null });

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Meal" className="flex gap-2 overflow-x-auto pb-1">
        {MEAL_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            role="radio"
            aria-checked={value.slot === slot}
            onClick={() => pickSlot(slot)}
            className={chipClass(value.slot === slot)}
          >
            {slotLabel(slot)}
          </button>
        ))}
      </div>
      {value.slot === "snack" && (
        <div role="radiogroup" aria-label="Which snack" className="flex gap-2 overflow-x-auto pb-1">
          {snackChoices.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value.snackNumber === n}
              onClick={() => onChange({ slot: "snack", snackNumber: n })}
              className={chipClass(value.snackNumber === n)}
            >
              Snack {n}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={value.snackNumber === newSnack}
            onClick={() => onChange({ slot: "snack", snackNumber: newSnack })}
            className={chipClass(value.snackNumber === newSnack)}
          >
            {snackNumbers.length === 0 ? `Snack ${newSnack}` : `New snack (${newSnack})`}
          </button>
        </div>
      )}
    </div>
  );
}
