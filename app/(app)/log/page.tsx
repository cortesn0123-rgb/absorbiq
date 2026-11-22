import { cookies } from "next/headers";
import { Suspense } from "react";
import { TZ_COOKIE, formatDayLabel, hourIn, isIsoDate, todayIn } from "@/lib/dates";
import { getDayLogs, getFavorites, getRecentFoods } from "@/lib/logs/queries";
import {
  MAX_SNACKS_PER_DAY,
  defaultMealSlot,
  defaultSnackNumber,
  isMealSlot,
  snackSummaries,
  type MealOccasion,
} from "@/lib/meals";
import { trackedMicros, visibleNutrients } from "@/lib/nutrients/tracking";
import { loadTracking, requireProfile } from "@/lib/settings";
import { LogFood } from "./LogFood";

export const metadata = { title: "Log food · AbsorbIQ" };

export default function LogPage({ searchParams }: PageProps<"/log">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <LogScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function LogScreen({ searchParams }: Pick<PageProps<"/log">, "searchParams">) {
  const { supabase } = await requireProfile();
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const timeZone = cookieStore.get(TZ_COOKIE)?.value;
  const now = new Date();
  const today = todayIn(timeZone, now);
  const date = isIsoDate(params.date) ? params.date : today;

  const [dayLogs, recent, favorites, tracking] = await Promise.all([
    getDayLogs(supabase, date),
    getRecentFoods(supabase),
    getFavorites(supabase),
    loadTracking(supabase),
  ]);
  const snacks = snackSummaries(dayLogs);
  const defaultSnack = defaultSnackNumber(snacks, now);

  // ?meal=lunch, or ?meal=snack&snack=2 from a meal's "Add" link; else a meal for the time of day.
  const slot = isMealSlot(params.meal) ? params.meal : defaultMealSlot(hourIn(timeZone, now));
  const snackParam = Number(params.snack);
  const initialOccasion: MealOccasion =
    slot === "snack"
      ? {
          slot,
          snackNumber:
            Number.isInteger(snackParam) && snackParam >= 1 && snackParam <= MAX_SNACKS_PER_DAY
              ? snackParam
              : defaultSnack,
        }
      : { slot, snackNumber: null };

  return (
    <LogFood
      date={date}
      dayLabel={formatDayLabel(date, today)}
      initialOccasion={initialOccasion}
      snackNumbers={snacks.map((s) => s.snackNumber)}
      defaultSnack={defaultSnack}
      recent={recent}
      favorites={favorites}
      visible={visibleNutrients(trackedMicros(tracking))}
    />
  );
}
