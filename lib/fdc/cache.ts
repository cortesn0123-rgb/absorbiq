import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchFoodDetails } from "./client";
import { normalizeFood } from "./normalize";
import { FOOD_COLUMNS, toFoodInsert, toFoodRecord, type FoodRecord, type FoodRow } from "./record";

async function readCachedFood(
  admin: ReturnType<typeof createAdminClient>,
  fdcId: number,
): Promise<FoodRecord | null> {
  const { data, error } = await admin
    .from("foods")
    .select(FOOD_COLUMNS)
    .eq("fdc_id", fdcId)
    .maybeSingle<FoodRow>();
  if (error) throw new Error(`Reading cached food ${fdcId} failed: ${error.message}`);
  return data ? toFoodRecord(data) : null;
}

/**
 * Returns a food from our cache, fetching it from FDC (once, ever) on a miss. New foods are
 * mapped to the registry, tagged and stored.
 */
export async function getFood(fdcId: number): Promise<FoodRecord> {
  const admin = createAdminClient();
  const cached = await readCachedFood(admin, fdcId);
  if (cached) return cached;

  const food = normalizeFood(await fetchFoodDetails(fdcId));
  if (food.missing.length > 0) {
    console.warn(
      `[fdc] ${food.fdcId} "${food.name}" (${food.dataType}) has no data for: ${food.missing.join(", ")}`,
    );
  }

  // Another request may have cached it meanwhile; keep whichever row landed first.
  const { error } = await admin
    .from("foods")
    .upsert(toFoodInsert(food), { onConflict: "fdc_id", ignoreDuplicates: true });
  if (error) throw new Error(`Caching food ${fdcId} failed: ${error.message}`);

  const stored = await readCachedFood(admin, fdcId);
  if (!stored) throw new Error(`Food ${fdcId} was not cached.`);
  return stored;
}
