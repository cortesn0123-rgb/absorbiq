import "server-only";
import { DEFAULT_FACTORS, FactorTable, type FactorRow } from "@/lib/bioavailability";
import type { createClient } from "@/lib/supabase/server";

/** Loads what the (pure) bioavailability engine needs from the database. */

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface FactorDbRow {
  nutrient_id: string;
  condition_key: string;
  factor: number | string;
  low: number | string;
  high: number | string;
  description: string | null;
  source_citation: string;
}

/**
 * Absorption factors from the absorption_factors table, over the built-in defaults. Falls back
 * to the defaults if the table cannot be read, so the app keeps working.
 */
export async function loadFactorTable(supabase: Supabase): Promise<FactorTable> {
  const { data, error } = await supabase
    .from("absorption_factors")
    .select("nutrient_id, condition_key, factor, low, high, description, source_citation");
  if (error) {
    console.error(`Loading absorption factors failed; using defaults: ${error.message}`);
    return DEFAULT_FACTORS;
  }
  const rows: FactorRow[] = (data as FactorDbRow[]).map((r) => ({
    nutrient: r.nutrient_id,
    key: r.condition_key,
    value: Number(r.factor),
    low: Number(r.low),
    high: Number(r.high),
    description:
      r.description ??
      DEFAULT_FACTORS.all().find((d) => d.nutrient === r.nutrient_id && d.key === r.condition_key)
        ?.description ??
      "",
    source: r.source_citation,
  }));
  return FactorTable.withOverrides(rows);
}
