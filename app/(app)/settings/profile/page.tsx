import Link from "next/link";
import { Suspense } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import { requireProfile } from "@/lib/settings";
import { saveProfile } from "../actions";

export const metadata = { title: "Profile · Micronutrient Tracker" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <ProfileSettings />
    </Suspense>
  );
}

async function ProfileSettings() {
  const { profile } = await requireProfile();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/settings"
          className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ‹ Settings
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Profile</h1>
      </div>
      <ProfileForm
        profile={profile}
        action={saveProfile.bind(null, "settings")}
        submitLabel="Save profile"
      />
    </div>
  );
}
