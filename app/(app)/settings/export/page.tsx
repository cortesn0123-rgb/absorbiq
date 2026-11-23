import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { TZ_COOKIE, addDays, todayIn } from "@/lib/dates";
import { MAX_EXPORT_DAYS } from "@/lib/logs/export";

export const metadata = { title: "Export data · AbsorbIQ" };

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-300 bg-background px-3 text-base dark:border-zinc-700";

export default function ExportPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted">
          Loading…
        </p>
      }
    >
      <Export />
    </Suspense>
  );
}

async function Export() {
  await requireUser();
  const today = todayIn((await cookies()).get(TZ_COOKIE)?.value);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/settings"
          className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ‹ Settings
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Export data</h1>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Download a CSV file (opens in Excel, Numbers or Google Sheets) with what you ate and the
        estimated amount absorbed, per nutrient per day, for the nutrients you track. Absorbed
        amounts are estimates with a low–high range. Up to {MAX_EXPORT_DAYS} days at a time.
      </p>
      <form action="/api/export" method="get" className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            From
            <input
              type="date"
              name="from"
              required
              max={today}
              defaultValue={addDays(today, -29)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            To
            <input
              type="date"
              name="to"
              required
              max={today}
              defaultValue={today}
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="submit"
          className="h-11 rounded-lg bg-emerald-600 px-4 font-medium text-white hover:bg-emerald-700"
        >
          Download CSV
        </button>
      </form>
    </div>
  );
}
