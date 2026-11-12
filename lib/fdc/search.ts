/** Orders FDC search results by data-type preference. */

import { foodBrand, tidyName } from "./normalize";
import type { FdcDataType, FdcSearchFood } from "./types";

export interface FoodSearchResult {
  fdcId: number;
  name: string;
  dataType: FdcDataType;
  brand: string | null;
}

/**
 * Lower is preferred: lab-analysed Foundation and SR Legacy first, then Survey (FNDDS) mixed
 * dishes, then Branded label data.
 */
export const DATA_TYPE_RANK: Record<FdcDataType, number> = {
  Foundation: 0,
  "SR Legacy": 0,
  "Survey (FNDDS)": 1,
  Branded: 2,
};

/** Data types for the two search requests; branded results are fetched separately so they
 * cannot crowd out generic foods. */
export const GENERIC_DATA_TYPES: FdcDataType[] = ["Foundation", "SR Legacy", "Survey (FNDDS)"];
export const BRANDED_DATA_TYPES: FdcDataType[] = ["Branded"];

function isRankedType(dataType: string): dataType is FdcDataType {
  return dataType in DATA_TYPE_RANK;
}

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;

/** Normalizes a query so equivalent searches share a cache entry. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Stable sort by data-type rank, keeping FDC's relevance order within a rank. Drops unknown
 * data types and duplicates.
 */
export function rankSearchResults(foods: readonly FdcSearchFood[]): FoodSearchResult[] {
  const seen = new Set<number>();
  const results: FoodSearchResult[] = [];
  for (const food of foods) {
    if (seen.has(food.fdcId) || !isRankedType(food.dataType)) continue;
    seen.add(food.fdcId);
    results.push({
      fdcId: food.fdcId,
      name: tidyName(food.description),
      dataType: food.dataType,
      brand: food.dataType === "Branded" ? foodBrand(food) : null,
    });
  }
  // Array.prototype.sort is stable, so relevance order survives within each rank.
  return results.sort((a, b) => DATA_TYPE_RANK[a.dataType] - DATA_TYPE_RANK[b.dataType]);
}
