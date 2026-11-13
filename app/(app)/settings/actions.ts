"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { fail, run, type ActionResult } from "@/lib/actions";
import { ValidationError } from "@/lib/logs/validate";
import { parseCustomGoal, parseNutrientId } from "@/lib/nutrients/goals";
import { TIERS, type Tier } from "@/lib/nutrients/registry";
import { MICRO_IDS, getPreset, isMicro } from "@/lib/nutrients/tracking";
import { GOAL_VIEWS, parseProfileForm, type GoalView, type ProfileFormState } from "@/lib/profile";

/**
 * Saves the profile form. From the first-login setup screen ("onboarding") it then continues to
 * the Day view.
 */
export async function saveProfile(
  mode: "onboarding" | "settings",
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const result = await run(async (supabase) => {
    const update = parseProfileForm(Object.fromEntries(formData));
    const { data: auth } = await supabase.auth.getClaims();
    const id = auth?.claims?.sub;
    if (!id) throw new ValidationError("Your session expired. Please sign in again.");
    const { error } = await supabase.from("profiles").upsert({ id, ...update });
    if (error) fail("Saving profile", error);
    return null;
  });
  if (!result.ok) return { error: result.error, saved: false };
  if (mode === "onboarding") redirect("/dashboard");
  refresh();
  return { error: null, saved: true };
}

/** Updates columns on the signed-in user's own profile row (RLS limits the update to it). */
async function updateProfile(changes: Record<string, string>): Promise<ActionResult> {
  return run(async (supabase) => {
    const { data: auth } = await supabase.auth.getClaims();
    const id = auth?.claims?.sub;
    if (!id) throw new ValidationError("Your session expired. Please sign in again.");
    const { data, error } = await supabase
      .from("profiles")
      .update(changes)
      .eq("id", id)
      .select("id");
    if (error || !data?.length) fail("Updating profile", error);
    refresh();
    return null;
  });
}

export async function setTier(tier: Tier): Promise<ActionResult> {
  if (!(TIERS as readonly unknown[]).includes(tier)) {
    return { ok: false, error: "Choose a target tier." };
  }
  return updateProfile({ target_tier: tier });
}

export async function setGoalView(view: GoalView): Promise<ActionResult> {
  if (!(GOAL_VIEWS as readonly unknown[]).includes(view)) {
    return { ok: false, error: "Choose a goal view." };
  }
  return updateProfile({ goal_view: view });
}

export async function setTracked(nutrientId: string, enabled: boolean): Promise<ActionResult> {
  return run(async (supabase) => {
    const id = parseNutrientId(nutrientId);
    if (!isMicro(id) || typeof enabled !== "boolean") {
      throw new ValidationError("Only vitamins and minerals can be switched off.");
    }
    const { error } = await supabase
      .from("tracked_nutrients")
      .upsert({ nutrient_id: id, enabled }, { onConflict: "user_id,nutrient_id" });
    if (error) fail("Saving tracked nutrient", error);
    refresh();
    return null;
  });
}

/** Tracks exactly the preset's nutrients (custom goals are kept). */
export async function applyPreset(presetId: string): Promise<ActionResult> {
  return run(async (supabase) => {
    const preset = getPreset(presetId);
    if (!preset) throw new ValidationError("Unknown preset.");
    const on = new Set(preset.nutrients);
    const { error } = await supabase.from("tracked_nutrients").upsert(
      MICRO_IDS.map((id) => ({ nutrient_id: id, enabled: on.has(id) })),
      { onConflict: "user_id,nutrient_id" },
    );
    if (error) fail("Applying preset", error);
    refresh();
    return null;
  });
}

/** Sets a goal override, or resets to the recommended goal when `value` is null. */
export async function setCustomGoal(
  nutrientId: string,
  value: number | null,
): Promise<ActionResult> {
  return run(async (supabase) => {
    const id = parseNutrientId(nutrientId);
    const custom_goal = parseCustomGoal(value);
    const { error } = await supabase
      .from("tracked_nutrients")
      .upsert({ nutrient_id: id, custom_goal }, { onConflict: "user_id,nutrient_id" });
    if (error) fail("Saving goal", error);
    refresh();
    return null;
  });
}
