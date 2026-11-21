/**
 * evaluate_plan: today's logs plus proposed foods, run through the bioavailability engine in meal
 * context. Returns consumed-vs-goal gaps, absorption scores, calories and warnings, both as a
 * compact tool result for Claude and as the numbers the UI shows. Every number shown to the user
 * comes from here, never from Claude.
 */

import { occasionLabel } from "@/lib/meals";
import type { NutrientId, Unit } from "@/lib/nutrients/registry";
import {
  nearUl,
  overUl,
  remaining,
  snapshot,
  type DayInput,
  type DaySnapshot,
  type NutrientStatus,
  type ProposedFood,
} from "./day";

/** Rounds to 3 significant figures, to keep tool results short. */
export function sig3(value: number): number {
  if (value === 0 || !Number.isFinite(value)) return 0;
  return Number(value.toPrecision(3));
}

export interface GapChange {
  id: NutrientId;
  name: string;
  unit: Unit;
  goal: number;
  before: number;
  after: number;
  /** Goal reached after the plan. */
  met: boolean;
}

export interface ScoreChange {
  id: NutrientId;
  name: string;
  before: number | null;
  after: number;
}

export interface PlanWarning {
  kind: "over-ul" | "over-limit" | "meal-limit";
  text: string;
}

export interface PlanEvaluation {
  /** Daily targets that were short before the plan, with consumed before and after. */
  gaps: GapChange[];
  calories: { added: number; after: number; goal: number | null };
  /** Absorption scores that moved by at least SCORE_STEP. */
  scores: ScoreChange[];
  warnings: PlanWarning[];
  before: DaySnapshot;
  after: DaySnapshot;
}

/** Smallest change in an absorption score worth reporting. */
export const SCORE_STEP = 0.05;

function byId(s: DaySnapshot): Map<NutrientId, NutrientStatus> {
  return new Map(s.nutrients.map((n) => [n.id, n]));
}

function fmt(value: number, unit: Unit): string {
  return `${sig3(value)} ${unit}`;
}

export function evaluatePlan(
  input: DayInput,
  items: readonly ProposedFood[],
  before: DaySnapshot = snapshot(input),
): PlanEvaluation {
  const after = snapshot(input, items);
  const prior = byId(before);

  const gaps: GapChange[] = [];
  const scores: ScoreChange[] = [];
  const warnings: PlanWarning[] = [];

  for (const n of after.nutrients) {
    const was = prior.get(n.id);
    if (!was) continue;
    const short = remaining(was);
    if (short !== null && short > 0 && n.id !== "energy" && n.consumed !== null) {
      gaps.push({
        id: n.id,
        name: n.name,
        unit: n.unit,
        goal: n.goal,
        before: was.consumed ?? 0,
        after: n.consumed,
        met: n.consumed >= n.goal,
      });
    }
    if (n.score !== null && (was.score === null || Math.abs(n.score - was.score) >= SCORE_STEP)) {
      scores.push({ id: n.id, name: n.name, before: was.score, after: n.score });
    }
    if (overUl(n) && !overUl(was)) {
      warnings.push({
        kind: "over-ul",
        text: `${n.name} would reach ${fmt(n.consumed!, n.unit)}, above the upper limit of ${fmt(n.ul!, n.unit)}.`,
      });
    }
    if (
      n.kind === "limit" &&
      n.per === "day" &&
      n.consumed !== null &&
      n.consumed > n.goal &&
      (was.consumed ?? 0) <= was.goal
    ) {
      warnings.push({
        kind: "over-limit",
        text: `${n.name} would reach ${fmt(n.consumed, n.unit)}, over the ${fmt(n.goal, n.unit)} limit.`,
      });
    }
  }

  const priorMeals = new Set(before.mealsOverLimit.map((m) => `${m.nutrient}|${m.meal}`));
  for (const m of after.mealsOverLimit) {
    if (priorMeals.has(`${m.nutrient}|${m.meal}`)) continue;
    const unit = after.nutrients.find((n) => n.id === m.nutrient)?.unit ?? "g";
    const name = after.nutrients.find((n) => n.id === m.nutrient)?.name ?? m.nutrient;
    warnings.push({
      kind: "meal-limit",
      text: `${name} in ${m.meal} would reach ${fmt(m.total, unit)}, over the ${fmt(m.limit, unit)} per-meal limit.`,
    });
  }

  const energyBefore = prior.get("energy");
  const energyAfter = after.nutrients.find((n) => n.id === "energy");
  const kcalBefore = energyBefore?.consumed ?? 0;
  const kcalAfter = energyAfter?.consumed ?? kcalBefore;

  return {
    gaps,
    calories: {
      added: kcalAfter - kcalBefore,
      after: kcalAfter,
      goal: energyAfter?.goal ?? null,
    },
    scores,
    warnings,
    before,
    after,
  };
}

// ---------------------------------------------------------------------------
// What Claude sees
// ---------------------------------------------------------------------------

function statusLine(n: NutrientStatus) {
  const short = remaining(n);
  return {
    nutrient: n.id,
    unit: n.unit,
    consumed: n.consumed === null ? null : sig3(n.consumed),
    goal: sig3(n.goal),
    ...(n.kind === "target"
      ? { remaining: short === null ? null : sig3(short) }
      : { limit_per: n.per, room: n.consumed === null ? null : sig3(n.goal - n.consumed) }),
    ...(n.score !== null ? { absorption_score: Math.round(n.score * 100) / 100 } : {}),
    ...(n.partial ? { some_foods_lack_data: true } : {}),
  };
}

/** Targets and limits for the tool results and the day context. */
export function nutrientSummary(s: DaySnapshot) {
  return {
    targets: s.nutrients.filter((n) => n.kind === "target").map(statusLine),
    limits: s.nutrients.filter((n) => n.kind === "limit").map(statusLine),
    near_or_over_upper_limit: s.nutrients.filter(nearUl).map((n) => ({
      nutrient: n.id,
      unit: n.unit,
      consumed: sig3(n.consumed!),
      upper_limit: sig3(n.ul!),
    })),
    meals_over_limit: s.mealsOverLimit.map((m) => ({
      nutrient: m.nutrient,
      meal: m.meal,
      total: sig3(m.total),
      limit: m.limit,
    })),
  };
}

/** The evaluate_plan tool result. */
export function evaluationForClaude(
  items: readonly ProposedFood[],
  evaluation: PlanEvaluation,
  rejected: readonly { fdc_id: number; reason: string }[],
) {
  return {
    items: items.map((p) => ({
      fdc_id: p.food.fdcId,
      name: p.food.name,
      grams: p.grams,
      meal: occasionLabel(p.occasion),
      household_portions: p.food.portions.slice(0, 5).map((x) => `${x.label} = ${x.grams} g`),
    })),
    rejected,
    calories: {
      added: sig3(evaluation.calories.added),
      after: sig3(evaluation.calories.after),
      goal: evaluation.calories.goal === null ? null : sig3(evaluation.calories.goal),
    },
    gaps: evaluation.gaps.map((g) => ({
      nutrient: g.id,
      unit: g.unit,
      before: sig3(g.before),
      after: sig3(g.after),
      goal: sig3(g.goal),
      met: g.met,
    })),
    absorption_score_changes: evaluation.scores.map((s) => ({
      nutrient: s.id,
      before: s.before === null ? null : Math.round(s.before * 100) / 100,
      after: Math.round(s.after * 100) / 100,
    })),
    warnings: evaluation.warnings.map((w) => w.text),
    day_after: nutrientSummary(evaluation.after),
  };
}
