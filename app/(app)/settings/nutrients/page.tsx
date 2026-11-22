import Link from "next/link";
import { Suspense } from "react";
import { applyCustomGoals, goalSource } from "@/lib/nutrients/goals";
import { NUTRIENT_LIST } from "@/lib/nutrients/registry";
import { getDailyTargets } from "@/lib/nutrients/targets";
import { customGoals, trackedMicros } from "@/lib/nutrients/tracking";
import { targetInput } from "@/lib/profile";
import { loadTracking, requireProfile } from "@/lib/settings";
import { NutrientSettings, type GoalItem } from "./NutrientSettings";

export const metadata = { title: "Nutrients · AbsorbIQ" };

export default function NutrientsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Nutrients />
    </Suspense>
  );
}

async function Nutrients() {
  const { profile, supabase } = await requireProfile();
  const rows = await loadTracking(supabase);
  // No training sessions here: sweat-loss additions only apply on the day they happen.
  const goals = applyCustomGoals(getDailyTargets(targetInput(profile)), customGoals(rows));
  const items: GoalItem[] = NUTRIENT_LIST.map((def) => ({
    id: def.id,
    name: def.name,
    category: def.category,
    goal: goals[def.id],
    source: goalSource(goals[def.id]),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/settings"
          className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ‹ Settings
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Nutrients</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pick the vitamins and minerals to track. Lists, totals and suggestions show only these.
          Macros are always shown.
        </p>
      </div>
      <NutrientSettings
        tier={profile.targetTier}
        goalView={profile.goalView}
        tracked={trackedMicros(rows)}
        items={items}
      />
    </div>
  );
}
