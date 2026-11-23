import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { DISCLAIMER } from "@/components/Disclaimer";
import { DAILY_REQUEST_LIMIT } from "@/lib/ai/request";
import { TZ_COOKIE, todayIn } from "@/lib/dates";
import { NUTRIENTS, isNutrientId } from "@/lib/nutrients/registry";
import { requireProfile } from "@/lib/settings";
import { HelperChat } from "./HelperChat";

export const metadata = { title: "AI helper · AbsorbIQ" };

export default function HelperPage({ searchParams }: PageProps<"/helper">) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted">
          Loading…
        </p>
      }
    >
      <Helper searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * The AI helper. "Ask for suggestions" on the dashboard opens it with ?ask=1, and a gap's "Ask AI
 * helper" with ?nutrient=<id>; both send the request straight away.
 */
async function Helper({ searchParams }: Pick<PageProps<"/helper">, "searchParams">) {
  const { supabase } = await requireProfile();
  const { nutrient, ask } = await searchParams;
  const def = typeof nutrient === "string" && isNutrientId(nutrient) ? NUTRIENTS[nutrient] : null;
  const request = def
    ? `Suggest foods and portions to close my ${def.name} gap for the rest of today, paired so they are well absorbed.`
    : "Suggest foods and portions to close my nutrient gaps for the rest of today.";

  const today = todayIn((await cookies()).get(TZ_COOKIE)?.value);
  const { count } = await supabase
    .from("ai_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("suggestion_date", today);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">AI helper</h1>
        <Link
          href="/home"
          className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← Dashboard
        </Link>
      </div>
      <HelperChat
        initialRequest={request}
        autoStart={def !== null || ask === "1"}
        requestsLeft={Math.max(0, DAILY_REQUEST_LIMIT - (count ?? 0))}
      />
      <p className="text-xs text-muted">
        Suggestions come from Claude (AI); every amount, gap and absorption figure is calculated by
        this app from USDA FoodData Central. {DISCLAIMER}
      </p>
    </div>
  );
}
