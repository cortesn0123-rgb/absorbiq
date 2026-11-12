"use server";

import { refresh } from "next/cache";
import { getSignedInClient } from "@/lib/auth";
import { getFood } from "@/lib/fdc/cache";
import { FdcError } from "@/lib/fdc/client";
import type { FoodRecord } from "@/lib/fdc/record";
import {
  ValidationError,
  parseDate,
  parseId,
  parseLogEntry,
  parseOccasion,
  parsePortion,
  parseWaterMl,
} from "@/lib/logs/validate";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Runs an action for the signed-in user, turning errors into messages the UI can show. */
async function run<T>(
  action: (supabase: NonNullable<Awaited<ReturnType<typeof getSignedInClient>>>) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const supabase = await getSignedInClient();
    if (!supabase) return { ok: false, error: "Your session expired. Please sign in again." };
    return { ok: true, data: await action(supabase) };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    if (error instanceof FdcError) {
      return {
        ok: false,
        error:
          error.status === 404
            ? "FoodData Central has no details for this food."
            : "FoodData Central is not responding. Please try again.",
      };
    }
    console.error(error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what} failed: ${error?.message ?? "no rows"}`);
}

/** Fetches (and caches) a food so the user can pick a portion. */
export async function loadFood(
  fdcId: number,
): Promise<ActionResult<{ food: FoodRecord; isFavorite: boolean }>> {
  return run(async (supabase) => {
    const food = await getFood(parseId(fdcId, "food"));
    const { count } = await supabase
      .from("favorite_foods")
      .select("food_id", { count: "exact", head: true })
      .eq("food_id", food.id);
    return { food, isFavorite: (count ?? 0) > 0 };
  });
}

export async function logFood(entry: unknown): Promise<ActionResult<{ id: number }>> {
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
    refresh();
    return { id: data.id };
  });
}

export async function updateLog(
  id: number,
  changes: { occasion: unknown; portion: unknown },
): Promise<ActionResult> {
  return run(async (supabase) => {
    const occasion = parseOccasion(changes.occasion);
    const portion = parsePortion(changes.portion);
    const { data, error } = await supabase
      .from("food_logs")
      .update({
        meal_slot: occasion.slot,
        snack_number: occasion.snackNumber,
        grams: portion.grams,
        portion_label: portion.portionLabel,
        portion_count: portion.portionCount,
      })
      .eq("id", parseId(id))
      .select("id");
    if (error || !data?.length) fail("Updating food log", error);
    refresh();
    return null;
  });
}

export async function deleteLog(id: number): Promise<ActionResult> {
  return run(async (supabase) => {
    const { error } = await supabase.from("food_logs").delete().eq("id", parseId(id));
    if (error) fail("Deleting food log", error);
    refresh();
    return null;
  });
}

/** Saves a food as a favorite with `portion`, or removes it when `portion` is null. */
export async function setFavorite(foodId: number, portion: unknown): Promise<ActionResult> {
  return run(async (supabase) => {
    const food_id = parseId(foodId, "food");
    if (portion === null) {
      const { error } = await supabase.from("favorite_foods").delete().eq("food_id", food_id);
      if (error) fail("Removing favorite", error);
    } else {
      const p = parsePortion(portion);
      const { error } = await supabase.from("favorite_foods").upsert(
        {
          food_id,
          grams: p.grams,
          portion_label: p.portionLabel,
          portion_count: p.portionCount,
        },
        { onConflict: "user_id,food_id" },
      );
      if (error) fail("Saving favorite", error);
    }
    refresh();
    return null;
  });
}

export async function addWater(date: string, ml: number): Promise<ActionResult<{ id: number }>> {
  return run(async (supabase) => {
    const { data, error } = await supabase
      .from("water_logs")
      .insert({ log_date: parseDate(date), ml: parseWaterMl(ml) })
      .select("id")
      .single<{ id: number }>();
    if (error || !data) fail("Logging water", error);
    refresh();
    return { id: data.id };
  });
}

export async function deleteWater(id: number): Promise<ActionResult> {
  return run(async (supabase) => {
    const { error } = await supabase.from("water_logs").delete().eq("id", parseId(id));
    if (error) fail("Deleting water", error);
    refresh();
    return null;
  });
}
