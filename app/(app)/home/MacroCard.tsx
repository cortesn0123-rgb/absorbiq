import { formatAmount } from "@/lib/format";
import type { EnergyShare, MacroSummary } from "@/lib/logs/dashboard";
import { NutrientBar } from "./NutrientBar";

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** Calories, protein/carbs/fat (grams and % of calories), fiber, water and limit bars. */
export function MacroCard({ macros }: { macros: MacroSummary }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Macros</h2>
      {macros.energy && (
        <NutrientBar
          row={{ ...macros.energy, name: "Calories" }}
          showMarker={false}
          showScore={false}
        />
      )}

      <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {macros.shares.map((share) => (
          <li key={share.id}>
            <ShareRow share={share} />
          </li>
        ))}
        {macros.fiber && (
          <li>
            <NutrientBar row={macros.fiber} showMarker={false} showScore={false} compact />
          </li>
        )}
        <li>
          <NutrientBar row={macros.water} showMarker={false} showScore={false} compact />
        </li>
      </ul>

      <h3 className="mt-4 text-xs font-semibold tracking-wide text-muted uppercase">Limits</h3>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {macros.limits.map((row) => (
          <li key={row.id}>
            <NutrientBar row={row} showMarker={false} showScore={false} compact />
          </li>
        ))}
        {macros.noLimit.map((n) => (
          <li key={n.id} className="py-1.5 text-sm" title={n.reason}>
            <div className="flex items-baseline justify-between gap-3">
              <span>{n.name}</span>
              <span className="tabular-nums">
                {n.consumed === null ? (
                  <span className="text-muted italic">no data</span>
                ) : (
                  formatAmount(n.consumed, n.unit)
                )}
              </span>
            </div>
            <p className="text-xs text-muted">No set limit for your tier: keep it low.</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShareRow({ share }: { share: EnergyShare }) {
  const inRange =
    share.pctOfCalories !== null && share.targetPct !== null
      ? share.pctOfCalories < share.targetPct.min - 0.005
        ? "below range"
        : share.pctOfCalories > share.targetPct.max + 0.005
          ? "above range"
          : "in range"
      : null;
  return (
    <div>
      {share.row && <NutrientBar row={share.row} showMarker={false} showScore={false} compact />}
      <p className="-mt-1 pb-1.5 text-xs text-muted tabular-nums">
        {share.pctOfCalories === null ? "–" : pct(share.pctOfCalories)} of calories
        {share.targetPct && (
          <>
            {" "}
            · target {pct(share.targetPct.min)}–{pct(share.targetPct.max)}
            {inRange && (
              <span
                className={
                  inRange === "in range"
                    ? "text-green-700 dark:text-green-400"
                    : "text-amber-700 dark:text-amber-400"
                }
              >
                {" "}
                ({inRange})
              </span>
            )}
          </>
        )}
      </p>
    </div>
  );
}
