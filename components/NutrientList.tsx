import type { NutrientEstimate, TotalEstimate } from "@/lib/bioavailability";
import type { NutrientAmounts } from "@/lib/fdc/mapping";
import { NUTRIENT_LIST, type NutrientCategory, type NutrientId } from "@/lib/nutrients/registry";
import { NutrientRow } from "./NutrientRow";

/**
 * One displayed nutrient: amount eaten (null = no data; partial = some foods in a total had no
 * data), and optionally the absorbed estimate from lib/bioavailability.
 */
export interface NutrientValue {
  amount: number | null;
  partial: boolean;
  estimate?: Pick<NutrientEstimate, "absorbed" | "low" | "high" | "reasons" | "basis">;
}

export type NutrientValues = Record<NutrientId, NutrientValue>;

/** Eaten amounts only (e.g. a portion preview before it is logged). */
export function valuesFromAmounts(amounts: NutrientAmounts): NutrientValues {
  const values = {} as NutrientValues;
  for (const { id } of NUTRIENT_LIST) values[id] = { amount: amounts[id] ?? null, partial: false };
  return values;
}

/** Eaten and absorbed, from engine output for one food or a total. */
export function valuesFromEstimates(
  estimates: Record<NutrientId, NutrientEstimate | TotalEstimate>,
): NutrientValues {
  const values = {} as NutrientValues;
  for (const { id } of NUTRIENT_LIST) {
    const e = estimates[id];
    const missing = "missingCount" in e ? e.missingCount : 0;
    values[id] = { amount: e.consumed, partial: e.consumed !== null && missing > 0, estimate: e };
  }
  return values;
}

const SECTIONS: { category: NutrientCategory; title: string }[] = [
  { category: "macro", title: "Macros" },
  { category: "vitamin", title: "Vitamins" },
  { category: "mineral", title: "Minerals" },
];

/** Sub-components shown indented under carbohydrates or fat. */
const INDENTED = new Set<NutrientId>([
  "fiber",
  "sugars_total",
  "added_sugars",
  "saturated_fat",
  "trans_fat",
  "mufa",
  "pufa",
  "ala",
  "linoleic_acid",
]);

/** All registry nutrients, grouped into macros, vitamins and minerals. */
export function NutrientList({ values }: { values: NutrientValues }) {
  const showAbsorbed = NUTRIENT_LIST.some((d) => values[d.id].estimate);
  const anyPartial = NUTRIENT_LIST.some((d) => values[d.id].partial);
  return (
    <div className="flex flex-col gap-4 text-sm">
      {showAbsorbed && (
        <div className="flex justify-end gap-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          <span className="w-20 text-right">Eaten</span>
          <span className="w-28 text-right">Absorbed</span>
        </div>
      )}
      <div className={`grid gap-x-8 gap-y-4 ${showAbsorbed ? "" : "sm:grid-cols-2"}`}>
        {SECTIONS.map(({ category, title }) => (
          <section
            key={category}
            className={category === "macro" && !showAbsorbed ? "sm:col-span-2" : undefined}
          >
            <h4 className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              {title}
            </h4>
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {NUTRIENT_LIST.filter((d) => d.category === category).map((def) => (
                <NutrientRow
                  key={def.id}
                  def={def}
                  value={values[def.id]}
                  indented={INDENTED.has(def.id)}
                  showAbsorbed={showAbsorbed}
                />
              ))}
            </dl>
          </section>
        ))}
      </div>
      {showAbsorbed && (
        <p className="text-xs text-zinc-500">
          Absorbed amounts are estimates (~) with a likely range. Tap one to see why.
        </p>
      )}
      {anyPartial && (
        <p className="text-xs text-zinc-500">
          <span className="text-amber-600">*</span> Some foods have no data for this nutrient, so
          the total may be low.
        </p>
      )}
    </div>
  );
}
