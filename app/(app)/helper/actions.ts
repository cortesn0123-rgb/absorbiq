"use server";

import { refresh } from "next/cache";
import { fail, run, type ActionResult } from "@/lib/actions";
import { normalizeAvoided, parseAvoidedWord, MAX_AVOIDED } from "@/lib/ai/restrictions";
import { ValidationError, parseId, parseLogEntry } from "@/lib/logs/validate";
import { loadAvoidedFoods } from "@/lib/settings";

/** Logs a food from a helper suggestion and marks the suggestion as accepted. */
export async function logSuggestedFood(
  suggestionId: number | null,
  entry: unknown,
): Promise<ActionResult<{ id: number }>> {
  return run(async (supabase) => {
    const { foodId, date, occasion, portion } = parseLogEntry(entry);
    const { data, error } = await supabase
      .from("food_logs")
      .insert({
        food_id: foodId,
        log_date: date,
        meal_slot: occasion.slot,
        snack_number: occasion.snackNumber,
        grams: portion.grams,
        portion_label: portion.portionLabel,
        portion_count: portion.portionCount,
      })
      .select("id")
      .single<{ id: number }>();
    if (error || !data) fail("Logging food", error);
    if (suggestionId !== null) {
      const { error: markError } = await supabase
        .from("ai_suggestions")
        .update({ accepted: true })
        .eq("id", parseId(suggestionId, "suggestion"));
      if (markError) console.error(`Marking suggestion accepted failed: ${markError.message}`);
    }
    refresh();
    return { id: data.id };
  });
}

async function userId(supabase: Parameters<Parameters<typeof run>[0]>[0]): Promise<string> {
  const { data: auth } = await supabase.auth.getClaims();
  const id = auth?.claims?.sub;
  if (!id) throw new ValidationError("Your session expired. Please sign in again.");
  return id;
}

async function saveAvoided(
  supabase: Parameters<Parameters<typeof run>[0]>[0],
  id: string,
  words: string[],
): Promise<void> {
  if (words.length > MAX_AVOIDED) {
    throw new ValidationError(`You can save up to ${MAX_AVOIDED} foods to avoid.`);
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({ avoided_foods: words })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) fail("Saving foods to avoid", error);
}

/** Adds foods to avoid (after the user confirms in the chat, or from Settings). */
export async function addAvoidedFoods(words: unknown): Promise<ActionResult<string[]>> {
  return run(async (supabase) => {
    if (!Array.isArray(words) || words.length === 0) throw new ValidationError("Nothing to save.");
    const parsed = words.map((w) => {
      const word = parseAvoidedWord(w);
      if (!word) throw new ValidationError("Use letters only, up to 40 characters.");
      return word;
    });
    const id = await userId(supabase);
    const next = normalizeAvoided([...(await loadAvoidedFoods(supabase, id)), ...parsed]);
    await saveAvoided(supabase, id, next);
    refresh();
    return next;
  });
}

export async function removeAvoidedFood(word: unknown): Promise<ActionResult<string[]>> {
  return run(async (supabase) => {
    const parsed = parseAvoidedWord(word);
    if (!parsed) throw new ValidationError("Unknown food.");
    const id = await userId(supabase);
    const next = (await loadAvoidedFoods(supabase, id)).filter((w) => w !== parsed);
    await saveAvoided(supabase, id, next);
    refresh();
    return next;
  });
}
