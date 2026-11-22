import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth";
import { isProfileComplete } from "@/lib/profile";
import { loadProfile } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { saveProfile } from "../settings/actions";

export const metadata = { title: "Set up your profile · AbsorbIQ" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Onboarding />
    </Suspense>
  );
}

/** First-login setup: every signed-in page sends users here until the profile is complete. */
async function Onboarding() {
  const user = await requireUser();
  const profile = await loadProfile(await createClient(), user.id);
  if (isProfileComplete(profile)) redirect("/settings/profile");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your profile</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your goals depend on your age, sex, body size and activity. You can change any of this
          later in Settings.
        </p>
      </div>
      <ProfileForm
        profile={profile}
        action={saveProfile.bind(null, "onboarding")}
        submitLabel="Save and continue"
      />
    </div>
  );
}
