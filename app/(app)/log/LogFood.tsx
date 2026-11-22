"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { MacroLine } from "@/components/MacroLine";
import { MealPicker } from "@/components/MealPicker";
import { Toast, type ToastMessage } from "@/components/Toast";
import type { FoodRecord } from "@/lib/fdc/record";
import { MIN_QUERY_LENGTH, normalizeQuery, type FoodSearchResult } from "@/lib/fdc/search";
import { formatPortion } from "@/lib/format";
import type { QuickFood } from "@/lib/logs/queries";
import type { PortionInput } from "@/lib/logs/validate";
import { occasionLabel, type MealOccasion } from "@/lib/meals";
import { nutrientsForGrams } from "@/lib/nutrients/portion";
import { deleteLog, loadFood, logFood, setFavorite } from "../actions";
import type { NutrientId } from "@/lib/nutrients/registry";
import { FoodPicker } from "./FoodPicker";

interface SearchState {
  query: string;
  results: FoodSearchResult[];
  error: string | null;
}

interface Picked {
  food: FoodRecord;
  isFavorite: boolean;
  saved?: PortionInput;
}

const SEARCH_DEBOUNCE_MS = 250;

function sourceLabel(result: FoodSearchResult): string {
  if (result.dataType === "Branded") return result.brand ?? "Branded";
  if (result.dataType === "Survey (FNDDS)") return "USDA survey";
  return "USDA";
}

export function LogFood({
  date,
  dayLabel,
  initialOccasion,
  snackNumbers,
  defaultSnack,
  recent,
  favorites,
  visible,
}: {
  date: string;
  dayLabel: string;
  initialOccasion: MealOccasion;
  snackNumbers: number[];
  defaultSnack: number;
  recent: QuickFood[];
  favorites: QuickFood[];
  /** Nutrients to show (macros plus tracked micros). */
  visible: NutrientId[];
}) {
  const router = useRouter();
  const [occasion, setOccasion] = useState(initialOccasion);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [loadingFdcId, setLoadingFdcId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();
  const dismissToast = useCallback(() => setToast(null), []);

  const normalized = normalizeQuery(query);
  const searchActive = normalized.length >= MIN_QUERY_LENGTH;
  const current = search?.query === normalized ? search : null;
  const favoriteIds = new Set(favorites.map((f) => f.food.id));

  useEffect(() => {
    if (normalized.length < MIN_QUERY_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        const body = (await res.json()) as { results?: FoodSearchResult[]; error?: string };
        setSearch({
          query: normalized,
          results: body.results ?? [],
          error: res.ok ? null : (body.error ?? "Search failed."),
        });
      } catch {
        if (!controller.signal.aborted) {
          setSearch({
            query: normalized,
            results: [],
            error: "Search failed. Check your connection.",
          });
        }
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalized]);

  function showLogged(name: string, logId: number) {
    setToast({
      id: Date.now(),
      text: `Added ${name} to ${occasionLabel(occasion)}`,
      onUndo: () =>
        startTransition(async () => {
          const result = await deleteLog(logId);
          if (!result.ok) setError(result.error);
        }),
    });
  }

  async function pickSearchResult(fdcId: number) {
    setError(null);
    setLoadingFdcId(fdcId);
    const result = await loadFood(fdcId);
    setLoadingFdcId(null);
    if (result.ok) setPicked(result.data);
    else setError(result.error);
  }

  function quickLog(item: QuickFood) {
    setError(null);
    startTransition(async () => {
      const result = await logFood({
        foodId: item.food.id,
        date,
        occasion,
        portion: {
          grams: item.grams,
          portionLabel: item.portionLabel,
          portionCount: item.portionCount,
        },
      });
      if (result.ok) showLogged(item.food.name, result.data.id);
      else setError(result.error);
    });
  }

  function save(food: FoodRecord, portion: PortionInput, addAnother: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await logFood({ foodId: food.id, date, occasion, portion });
      if (!result.ok) {
        setError(result.error);
      } else if (addAnother) {
        setPicked(null);
        setQuery("");
        showLogged(food.name, result.data.id);
      } else {
        router.push(`/dashboard?date=${date}`);
      }
    });
  }

  function toggleFavorite(food: FoodRecord, portion: PortionInput | null) {
    setError(null);
    startTransition(async () => {
      const result = await setFavorite(food.id, portion);
      if (result.ok) setPicked((p) => p && { ...p, isFavorite: portion !== null });
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Log food</h1>
          <p className="text-sm text-muted">{dayLabel}</p>
        </div>
        <Link
          href={`/dashboard?date=${date}`}
          className="flex h-10 items-center rounded-lg px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          Done
        </Link>
      </div>

      <MealPicker
        value={occasion}
        onChange={setOccasion}
        snackNumbers={snackNumbers}
        defaultSnack={defaultSnack}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {picked ? (
        <FoodPicker
          visible={visible}
          key={picked.food.id}
          food={picked.food}
          saved={picked.saved}
          isFavorite={picked.isFavorite}
          pending={pending}
          onSave={(portion, addAnother) => save(picked.food, portion, addAnother)}
          onToggleFavorite={(portion) => toggleFavorite(picked.food, portion)}
          onCancel={() => setPicked(null)}
        />
      ) : (
        <>
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods, e.g. lentils"
            aria-label="Search foods"
            className="h-12 rounded-lg border border-zinc-300 bg-transparent px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 dark:border-zinc-700"
          />

          {searchActive ? (
            <section aria-live="polite" aria-busy={!current}>
              {!current && <p className="py-3 text-sm text-muted">Searching…</p>}
              {current?.error && (
                <p role="alert" className="py-3 text-sm text-red-600 dark:text-red-400">
                  {current.error}
                </p>
              )}
              {current && !current.error && current.results.length === 0 && (
                <p className="py-3 text-sm text-muted">No foods found. Try another word.</p>
              )}
              {current && current.results.length > 0 && (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {current.results.map((r) => (
                    <li key={r.fdcId}>
                      <button
                        type="button"
                        onClick={() => pickSearchResult(r.fdcId)}
                        disabled={loadingFdcId !== null}
                        className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left hover:bg-zinc-50 disabled:opacity-60 dark:hover:bg-zinc-900"
                      >
                        <span>{r.name}</span>
                        <span className="shrink-0 text-xs text-muted">
                          {loadingFdcId === r.fdcId ? "Loading…" : sourceLabel(r)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <>
              <QuickList
                title="Favorites"
                items={favorites}
                empty="Star a food to add it here."
                pending={pending}
                onLog={quickLog}
                onOpen={(item) => setPicked({ food: item.food, isFavorite: true, saved: item })}
              />
              <QuickList
                title="Recent"
                items={recent}
                empty="Foods you log will appear here."
                pending={pending}
                onLog={quickLog}
                onOpen={(item) =>
                  setPicked({
                    food: item.food,
                    isFavorite: favoriteIds.has(item.food.id),
                    saved: item,
                  })
                }
              />
            </>
          )}
        </>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}

/** Foods with a saved portion: tap the name to adjust, tap + to log it as is. */
function QuickList({
  title,
  items,
  empty,
  pending,
  onLog,
  onOpen,
}: {
  title: string;
  items: QuickFood[];
  empty: string;
  pending: boolean;
  onLog: (item: QuickFood) => void;
  onOpen: (item: QuickFood) => void;
}) {
  return (
    <section>
      <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {items.length === 0 ? (
        <p className="py-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {items.map((item) => (
            <li key={item.food.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="flex min-h-14 flex-1 flex-col justify-center py-2 text-left"
              >
                <span>{item.food.name}</span>
                <span className="text-xs">
                  <span className="text-muted">
                    {formatPortion(item.grams, item.portionLabel, item.portionCount)} ·{" "}
                  </span>
                  <MacroLine amounts={nutrientsForGrams(item.food.nutrientsPer100g, item.grams)} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => onLog(item)}
                disabled={pending}
                aria-label={`Log ${item.food.name}, ${formatPortion(item.grams, item.portionLabel, item.portionCount)}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-2xl leading-none text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                +
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
