import "server-only";
import { FOOD_COLUMNS, toFoodRecord, type FoodRecord, type FoodRow } from "@/lib/fdc/record";
import { isMealSlot, type MealOccasion } from "@/lib/meals";
import type { createClient } from "@/lib/supabase/server";

/** Reads the signed-in user's logs. Row Level Security limits every query to their own rows. */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface LoggedFood {
  id: number;
  date: string;
  occasion: MealOccasion;
  grams: number;
  portionLabel: string | null;
  portionCount: number | null;
  createdAt: string;
  food: FoodRecord;
}

export interface WaterEntry {
  id: number;
  ml: number;
  createdAt: string;
}

/** A food with a saved portion, for one-tap logging (recent foods and favorites). */
export interface QuickFood {
  food: FoodRecord;
  grams: number;
  portionLabel: string | null;
  portionCount: number | null;
}

const LOG_COLUMNS = `id, log_date, meal_slot, snack_number, grams, portion_label, portion_count, created_at, food:foods(${FOOD_COLUMNS})`;

interface LogRow {
  id: number;
  log_date: string;
  meal_slot: string;
  snack_number: number | null;
  grams: number | string;
  portion_label: string | null;
  portion_count: number | string | null;
  created_at: string;
  food: FoodRow;
}

function toLoggedFood(row: LogRow): LoggedFood {
  const slot = isMealSlot(row.meal_slot) ? row.meal_slot : "snack";
  return {
    id: row.id,
    date: row.log_date,
    occasion: { slot, snackNumber: slot === "snack" ? (row.snack_number ?? 1) : null },
    grams: Number(row.grams),
    portionLabel: row.portion_label,
    portionCount: row.portion_count === null ? null : Number(row.portion_count),
    createdAt: row.created_at,
    food: toFoodRecord(row.food),
  };
}

function check<T>(result: { data: unknown; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`Loading ${what} failed: ${result.error.message}`);
  return result.data as T;
}

export async function getDayLogs(supabase: Supabase, date: string): Promise<LoggedFood[]> {
  const rows = check<LogRow[]>(
    await supabase
      .from("food_logs")
      .select(LOG_COLUMNS)
      .eq("log_date", date)
      .order("created_at", { ascending: true }),
    "food logs",
  );
  return rows.map(toLoggedFood);
}

export async function getWaterLogs(supabase: Supabase, date: string): Promise<WaterEntry[]> {
  const rows = check<{ id: number; ml: number; created_at: string }[]>(
    await supabase
      .from("water_logs")
      .select("id, ml, created_at")
      .eq("log_date", date)
      .order("created_at", { ascending: true }),
    "water logs",
  );
  return rows.map((r) => ({ id: r.id, ml: r.ml, createdAt: r.created_at }));
}

/** Most recently logged distinct foods, each with the portion it was last logged with. */
export async function getRecentFoods(supabase: Supabase, limit = 8): Promise<QuickFood[]> {
  const rows = check<LogRow[]>(
    await supabase
      .from("food_logs")
      .select(LOG_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(100),
    "recent foods",
  );
  const seen = new Set<number>();
  const recent: QuickFood[] = [];
  for (const log of rows.map(toLoggedFood)) {
    if (seen.has(log.food.id)) continue;
    seen.add(log.food.id);
    recent.push(log);
    if (recent.length === limit) break;
  }
  return recent.map(({ food, grams, portionLabel, portionCount }) => ({
    food,
    grams,
    portionLabel,
    portionCount,
  }));
}

export async function getFavorites(supabase: Supabase): Promise<QuickFood[]> {
  const rows = check<
    {
      grams: number | string;
      portion_label: string | null;
      portion_count: number | string | null;
      food: FoodRow;
    }[]
  >(
    await supabase
      .from("favorite_foods")
      .select(`grams, portion_label, portion_count, food:foods(${FOOD_COLUMNS})`)
      .order("created_at", { ascending: false }),
    "favorites",
  );
  return rows.map((r) => ({
    food: toFoodRecord(r.food),
    grams: Number(r.grams),
    portionLabel: r.portion_label,
    portionCount: r.portion_count === null ? null : Number(r.portion_count),
  }));
}

export async function getFavoriteFoodIds(supabase: Supabase): Promise<number[]> {
  const rows = check<{ food_id: number }[]>(
    await supabase.from("favorite_foods").select("food_id"),
    "favorites",
  );
  return rows.map((r) => r.food_id);
}
