import Link from "next/link";
import { Suspense } from "react";
import { DISCLAIMER } from "@/components/Disclaimer";
import { requireUser } from "@/lib/auth";
import { NUTRIENTS, isNutrientId } from "@/lib/nutrients/registry";

export const metadata = { title: "AI helper · Micronutrient Tracker" };

export default function HelperPage({ searchParams }: PageProps<"/helper">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Helper searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * Placeholder for the AI helper (a later phase). The dashboard links here with
 * ?nutrient=<id>; the request is pre-filled so the helper can pick it up.
 */
async function Helper({ searchParams }: Pick<PageProps<"/helper">, "searchParams">) {
  await requireUser();
  const { nutrient } = await searchParams;
  const def = typeof nutrient === "string" && isNutrientId(nutrient) ? NUTRIENTS[nutrient] : null;
  const request = def
    ? `Suggest foods and portions to close my ${def.name} gap for the rest of today, paired so they are well absorbed.`
    : "Suggest foods and portions to close my nutrient gaps for the rest of today.";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">AI helper</h1>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Your request</span>
        <textarea
          defaultValue={request}
          rows={3}
          disabled
          className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        The AI helper is coming soon. It will suggest foods; the app will look them up in FoodData
        Central and calculate their nutrients and absorption itself.
      </p>
      <p className="text-xs text-zinc-500">{DISCLAIMER}</p>
      <Link href="/home" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">
        ← Back to dashboard
      </Link>
    </div>
  );
}
