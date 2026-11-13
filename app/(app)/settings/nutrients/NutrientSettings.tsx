"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { TIER_OPTIONS } from "@/components/ProfileForm";
import { formatAmount } from "@/lib/format";
import { goalLabel, goalRange, type Goal } from "@/lib/nutrients/goals";
import type { NutrientCategory, NutrientId, Tier } from "@/lib/nutrients/registry";
import { MICRO_IDS, PRESETS, matchingPreset } from "@/lib/nutrients/tracking";
import type { GoalView } from "@/lib/profile";
import { applyPreset, setCustomGoal, setGoalView, setTier, setTracked } from "../actions";

export interface GoalItem {
  id: NutrientId;
  name: string;
  category: NutrientCategory;
  goal: Goal;
  /** Basis, citation and notes, shown on hover / tap. */
  source: string;
}

type Result = { ok: true } | { ok: false; error: string };

const SECTIONS: { category: NutrientCategory; title: string; note?: string }[] = [
  { category: "vitamin", title: "Vitamins" },
  { category: "mineral", title: "Minerals" },
  { category: "macro", title: "Macros", note: "Always shown. You can still change their goals." },
];

export const GOAL_VIEW_OPTIONS: { value: GoalView; label: string }[] = [
  { value: "absorption", label: "Consumed + absorption score" },
  { value: "consumed", label: "Consumed only" },
];

export function NutrientSettings({
  tier,
  goalView,
  tracked,
  items,
}: {
  tier: Tier;
  goalView: GoalView;
  tracked: NutrientId[];
  items: GoalItem[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [optimisticTier, setOptimisticTier] = useOptimistic(tier);
  const [optimisticView, setOptimisticView] = useOptimistic(goalView);
  const [optimisticTracked, setOptimisticTracked] = useOptimistic(tracked);
  const trackedSet = new Set(optimisticTracked);
  const activePreset = matchingPreset(optimisticTracked);

  function run(optimistic: () => void, action: () => Promise<Result>) {
    setError(null);
    startTransition(async () => {
      optimistic();
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Target tier</h2>
        <div role="radiogroup" aria-label="Target tier" className="grid grid-cols-3 gap-2">
          {TIER_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={optimisticTier === o.value}
              onClick={() =>
                run(
                  () => setOptimisticTier(o.value),
                  () => setTier(o.value),
                )
              }
              className="h-11 rounded-lg border border-zinc-200 text-sm font-medium aria-checked:border-emerald-600 aria-checked:bg-emerald-50 aria-checked:text-emerald-800 dark:border-zinc-800 dark:aria-checked:bg-emerald-950 dark:aria-checked:text-emerald-300"
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {TIER_OPTIONS.find((o) => o.value === optimisticTier)?.description}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Compare goals against</h2>
        <div role="radiogroup" aria-label="Goal view" className="grid grid-cols-2 gap-2">
          {GOAL_VIEW_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={optimisticView === o.value}
              onClick={() =>
                run(
                  () => setOptimisticView(o.value),
                  () => setGoalView(o.value),
                )
              }
              className="min-h-11 rounded-lg border border-zinc-200 px-2 py-1 text-sm font-medium aria-checked:border-emerald-600 aria-checked:bg-emerald-50 aria-checked:text-emerald-800 dark:border-zinc-800 dark:aria-checked:bg-emerald-950 dark:aria-checked:text-emerald-300"
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Progress bars always compare what you ate with your goal, because goals (RDAs) already
          assume typical absorption from a mixed diet; the absorption score next to each bar (1.0 =
          a typical diet) shows where your food pairings help or hurt absorption, so use it to spot
          relative weak spots rather than as an exact target.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Quick presets</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={activePreset?.id === p.id}
              title={p.nutrients.map((id) => items.find((i) => i.id === id)?.name ?? id).join(", ")}
              onClick={() =>
                run(
                  () => setOptimisticTracked([...p.nutrients]),
                  () => applyPreset(p.id),
                )
              }
              className="h-10 rounded-full border border-zinc-300 px-4 text-sm font-medium aria-pressed:border-emerald-600 aria-pressed:bg-emerald-600 aria-pressed:text-white dark:border-zinc-700"
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Tracking {optimisticTracked.length} of {MICRO_IDS.length} vitamins and minerals.
        </p>
      </section>

      {SECTIONS.map(({ category, title, note }) => (
        <section key={category}>
          <h2 className="border-b border-zinc-200 pb-1 font-semibold dark:border-zinc-800">
            {title}
          </h2>
          {note && <p className="pt-1 text-xs text-zinc-500">{note}</p>}
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {items
              .filter((i) => i.category === category)
              .map((item) => (
                <NutrientGoalRow
                  key={item.id}
                  item={item}
                  tracked={category === "macro" ? null : trackedSet.has(item.id)}
                  onToggle={(enabled) =>
                    run(
                      () =>
                        setOptimisticTracked(
                          enabled
                            ? MICRO_IDS.filter((id) => id === item.id || trackedSet.has(id))
                            : optimisticTracked.filter((id) => id !== item.id),
                        ),
                      () => setTracked(item.id, enabled),
                    )
                  }
                  onSaveGoal={(value) => setCustomGoal(item.id, value)}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** One nutrient: track switch (vitamins and minerals), goal with source, override and reset. */
function NutrientGoalRow({
  item,
  tracked,
  onToggle,
  onSaveGoal,
}: {
  item: GoalItem;
  /** null for macros, which are always shown. */
  tracked: boolean | null;
  onToggle: (enabled: boolean) => void;
  onSaveGoal: (value: number | null) => Promise<Result>;
}) {
  const { goal } = item;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sourceId = useId();
  const range = goalRange(goal);
  const aboveUl =
    goal.kind === "target" &&
    goal.value !== null &&
    goal.ul !== null &&
    goal.ulScope === "total" &&
    goal.value > goal.ul;

  function save(value: number | null) {
    setError(null);
    startTransition(async () => {
      const result = await onSaveGoal(value);
      if (result.ok) setEditing(false);
      else setError(result.error);
    });
  }

  return (
    <li className={`py-2 ${tracked === false ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        {tracked !== null && (
          <button
            type="button"
            role="switch"
            aria-checked={tracked}
            aria-label={`Track ${item.name}`}
            onClick={() => onToggle(!tracked)}
            className="group flex h-11 w-12 shrink-0 items-center"
          >
            <span className="relative h-6 w-11 rounded-full bg-zinc-300 transition-colors group-aria-checked:bg-emerald-600 dark:bg-zinc-700">
              <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform group-aria-checked:translate-x-5" />
            </span>
          </button>
        )}
        <span className="min-w-0 flex-1">{item.name}</span>
        <button
          type="button"
          title={item.source}
          aria-expanded={showSource}
          aria-controls={sourceId}
          onClick={() => setShowSource((s) => !s)}
          className="-my-1 flex min-h-10 flex-col items-end rounded-md px-1 text-right text-sm tabular-nums underline decoration-zinc-400 decoration-dotted underline-offset-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <span>
            {goal.custom && (
              <span className="mr-1 text-xs text-emerald-700 dark:text-emerald-400">custom</span>
            )}
            {goalLabel(goal)}
          </span>
          {range && <span className="text-xs text-zinc-500">{range}</span>}
        </button>
      </div>

      {showSource && (
        <div
          id={sourceId}
          className="mt-1 rounded-lg bg-zinc-50 p-3 text-xs whitespace-pre-line text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {item.source}
        </div>
      )}

      {aboveUl && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          This goal is above the {formatAmount(goal.ul!, goal.unit)} tolerable upper limit.
        </p>
      )}

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(Number(draft));
          }}
          className="mt-2 flex items-center gap-2"
        >
          <label className="flex flex-1 items-center gap-2">
            <span className="sr-only">New goal for {item.name}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-300 bg-background px-3 text-base dark:border-zinc-700"
            />
            <span className="text-sm text-zinc-500">
              {goal.unit}
              {goal.per === "meal" ? " per meal" : ""}
            </span>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-10 rounded-lg px-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="mt-0.5 flex flex-wrap justify-end gap-x-3 text-xs">
          {goal.custom && (
            <button
              type="button"
              disabled={pending}
              onClick={() => save(null)}
              className="min-h-8 text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Reset to recommended
              {goal.recommended !== null && ` (${formatAmount(goal.recommended, goal.unit)})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDraft(goal.value === null ? "" : String(goal.value));
              setEditing(true);
            }}
            className="min-h-8 text-zinc-600 hover:underline dark:text-zinc-400"
          >
            {goal.value === null ? "Set a goal" : "Change goal"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}
