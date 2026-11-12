import type { NutrientAmounts } from "@/lib/fdc/mapping";
import { formatAmount } from "@/lib/format";
import type { NutrientTotal } from "@/lib/nutrients/portion";
import {
  NUTRIENT_LIST,
  type NutrientCategory,
  type NutrientDefinition,
  type NutrientId,
} from "@/lib/nutrients/registry";

/** One displayed value: null = no data; partial = some foods in a total had no data. */
export interface NutrientValue {
  amount: number | null;
  partial: boolean;
}

export type NutrientValues = Record<NutrientId, NutrientValue>;

export function valuesFromAmounts(amounts: NutrientAmounts): NutrientValues {
  const values = {} as NutrientValues;
  for (const { id } of NUTRIENT_LIST) values[id] = { amount: amounts[id] ?? null, partial: false };
  return values;
}

export function valuesFromTotals(totals: Record<NutrientId, NutrientTotal>): NutrientValues {
  const values = {} as NutrientValues;
  for (const { id } of NUTRIENT_LIST) {
    const { amount, missingCount } = totals[id];
    values[id] = { amount, partial: amount !== null && missingCount > 0 };
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

function Row({ def, value }: { def: NutrientDefinition; value: NutrientValue }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className={INDENTED.has(def.id) ? "pl-3 text-zinc-500" : undefined}>{def.name}</dt>
      <dd className="shrink-0 tabular-nums">
        {value.amount === null ? (
          <span className="text-zinc-400 italic" title="FoodData Central has no data for this">
            no data
          </span>
        ) : (
          <>
            {formatAmount(value.amount, def.unit)}
            {value.partial && (
              <span className="text-amber-600" title="Some foods have no data for this nutrient">
                *
              </span>
            )}
          </>
        )}
      </dd>
    </div>
  );
}

/** All registry nutrients, grouped into macros, vitamins and minerals. */
export function NutrientList({ values }: { values: NutrientValues }) {
  const anyPartial = NUTRIENT_LIST.some((d) => values[d.id].partial);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {SECTIONS.map(({ category, title }) => (
          <section key={category} className={category === "macro" ? "sm:col-span-2" : undefined}>
            <h4 className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              {title}
            </h4>
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {NUTRIENT_LIST.filter((d) => d.category === category).map((def) => (
                <Row key={def.id} def={def} value={values[def.id]} />
              ))}
            </dl>
          </section>
        ))}
      </div>
      {anyPartial && (
        <p className="text-xs text-zinc-500">
          <span className="text-amber-600">*</span> Some foods have no data for this nutrient, so
          the total may be low.
        </p>
      )}
    </div>
  );
}
