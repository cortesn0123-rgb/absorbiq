"use client";

import { useState, useTransition } from "react";
import { addAvoidedFoods, removeAvoidedFood } from "../../helper/actions";

export function AvoidedFoods({ initial }: { initial: string[] }) {
  const [words, setWords] = useState(initial);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add() {
    const word = input.trim();
    if (!word) return;
    startTransition(async () => {
      const result = await addAvoidedFoods([word]);
      if (result.ok) {
        setWords(result.data);
        setInput("");
        setError(null);
      } else setError(result.error);
    });
  }

  function remove(word: string) {
    startTransition(async () => {
      const result = await removeAvoidedFood(word);
      if (result.ok) {
        setWords(result.data);
        setError(null);
      } else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex gap-2"
      >
        <label htmlFor="avoid-input" className="sr-only">
          Food to avoid
        </label>
        <input
          id="avoid-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={40}
          placeholder="e.g. dairy, peanuts, mushrooms"
          className="h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-background px-3 text-base dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="h-12 shrink-0 rounded-lg bg-emerald-600 px-4 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {words.length === 0 ? (
        <p className="text-sm text-muted">No foods saved.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {words.map((w) => (
            <li key={w} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>{w}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => remove(w)}
                aria-label={`Remove ${w}`}
                className="h-10 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
