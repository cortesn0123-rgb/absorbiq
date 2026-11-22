import Link from "next/link";
import { Suspense } from "react";
import { loadAvoidedFoods, requireProfile } from "@/lib/settings";
import { AvoidedFoods } from "./AvoidedFoods";

export const metadata = { title: "Foods to avoid · AbsorbIQ" };

export default function AvoidedPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted">
          Loading…
        </p>
      }
    >
      <Avoided />
    </Suspense>
  );
}

async function Avoided() {
  const { user, profile, supabase } = await requireProfile();
  const words = await loadAvoidedFoods(supabase, user.id);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/settings"
          className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ‹ Settings
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Foods to avoid</h1>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The AI helper never suggests these. Your diet type ({profile.dietType}) is applied as well;
        change it in{" "}
        <Link
          href="/settings/profile"
          className="text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Profile
        </Link>
        .
      </p>
      <AvoidedFoods initial={words} />
    </div>
  );
}
