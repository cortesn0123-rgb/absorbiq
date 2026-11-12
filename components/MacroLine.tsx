import type { NutrientAmounts } from "@/lib/fdc/mapping";
import { formatNumber } from "@/lib/format";

function grams(value: number | undefined): string {
  return value === undefined ? "–" : `${formatNumber(value)} g`;
}

/** "116 kcal · P 9 g · C 20 g · F 0.4 g" for one portion. */
export function MacroLine({ amounts }: { amounts: NutrientAmounts }) {
  return (
    <span className="tabular-nums">
      <span className="font-medium text-foreground">
        {amounts.energy === undefined ? "–" : formatNumber(amounts.energy)} kcal
      </span>
      <span className="text-zinc-500">
        {" · "}P {grams(amounts.protein)} · C {grams(amounts.carbohydrate)} · F {grams(amounts.fat)}
      </span>
    </span>
  );
}
