import "server-only";
import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { isNutrientId } from "@/lib/nutrients/registry";
import { type TrackingRow } from "@/lib/nutrients/tracking";
import {
  PROFILE_COLUMNS,
  isProfileComplete,
  profileFromRow,
  type CompleteProfile,
  type Profile,
  type ProfileRow,
} from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/** Loads the signed-in user's profile and nutrient settings. RLS limits reads to their own rows. */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadProfile(supabase: Supabase, userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw new Error(`Loading profile failed: ${error.message}`);
  return profileFromRow(data);
}

/**
 * The signed-in user with a complete profile; sends users who have not finished setup to
 * /onboarding. Call inside <Suspense> (see requireUser).
 */
export async function requireProfile(): Promise<{
  user: CurrentUser;
  profile: CompleteProfile;
  supabase: Supabase;
}> {
  const user = await requireUser();
  const supabase = await createClient();
  const profile = await loadProfile(supabase, user.id);
  if (!isProfileComplete(profile)) redirect("/onboarding");
  return { user, profile, supabase };
}

interface TrackingDbRow {
  nutrient_id: string;
  enabled: boolean;
  custom_goal: number | string | null;
}

export async function loadTracking(supabase: Supabase): Promise<TrackingRow[]> {
  const { data, error } = await supabase
    .from("tracked_nutrients")
    .select("nutrient_id, enabled, custom_goal");
  if (error) throw new Error(`Loading tracked nutrients failed: ${error.message}`);
  return (data as TrackingDbRow[]).flatMap((r) =>
    isNutrientId(r.nutrient_id)
      ? [
          {
            nutrientId: r.nutrient_id,
            enabled: r.enabled,
            customGoal: r.custom_goal === null ? null : Number(r.custom_goal),
          },
        ]
      : [],
  );
}
