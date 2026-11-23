import { formatNumber } from "@/lib/format";
import type { GoalRowData } from "@/lib/logs/day-goals";

export const SCORE_NOTE =
  "Absorption score = estimated absorbed ÷ what a typical mixed diet absorbs from the same amount. 1.0 means typical absorption for what you ate, however much that was; above 1, your food pairings helped absorption; below 1, they held it back. It is an estimate for spotting weak pairings, not a target. — means nothing was eaten.";

/** "~1.2 (0.9–1.5)", or "—" when nothing was eaten. */
export function ScoreValue({
  score,
  range = true,
}: {
  score: NonNullable<GoalRowData["score"]>;
  range?: boolean;
}) {
  if (score.value === null) return <>—</>;
  return (
    <>
      ~{formatNumber(score.value)}
      {range && score.low !== null && score.high !== null && (
        <span className="text-muted">
          {" "}
          ({formatNumber(score.low)}–{formatNumber(score.high)})
        </span>
      )}
    </>
  );
}
