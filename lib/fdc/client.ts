import "server-only";
import { cacheLife } from "next/cache";
import {
  BRANDED_DATA_TYPES,
  GENERIC_DATA_TYPES,
  rankSearchResults,
  type FoodSearchResult,
} from "./search";
import type { FdcFoodDetail, FdcSearchResponse } from "./types";

/** USDA FoodData Central API. Server only: the API key must never reach the browser. */
const BASE_URL = "https://api.nal.usda.gov/fdc/v1";

export class FdcError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FdcError";
  }
}

async function fdcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.FDC_API_KEY;
  if (!apiKey) throw new Error("Missing FDC_API_KEY. Add it to .env.local.");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    // Header rather than query string, so the key never appears in logged URLs.
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new FdcError(`FDC ${path} failed: ${res.status}`, res.status);
  return (await res.json()) as T;
}

/**
 * Searches FDC, preferring Foundation and SR Legacy, then Survey (FNDDS), then Branded.
 * Pass a query from normalizeQuery(). Results are cached for a day to save API quota.
 */
export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  "use cache";
  cacheLife("days");
  const search = (dataType: string[], pageSize: number) =>
    fdcFetch<FdcSearchResponse>("/foods/search", {
      method: "POST",
      body: JSON.stringify({ query, dataType, pageSize }),
    });
  const [generic, branded] = await Promise.all([
    search(GENERIC_DATA_TYPES, 25),
    search(BRANDED_DATA_TYPES, 10),
  ]);
  return rankSearchResults([...(generic.foods ?? []), ...(branded.foods ?? [])]);
}

/** Full food details. Call through getFood() in cache.ts, which caches them in our database. */
export async function fetchFoodDetails(fdcId: number): Promise<FdcFoodDetail> {
  return fdcFetch<FdcFoodDetail>(`/food/${fdcId}`);
}
