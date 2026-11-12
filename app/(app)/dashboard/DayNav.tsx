"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, isIsoDate } from "@/lib/dates";

const arrowClass =
  "flex size-11 items-center justify-center rounded-full text-2xl text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900";

/** Previous / next day arrows, and a date picker behind the day's name. */
export function DayNav({
  date,
  today,
  label,
  longDate,
}: {
  date: string;
  today: string;
  label: string;
  longDate: string;
}) {
  const router = useRouter();
  const href = (d: string) => (d === today ? "/dashboard" : `/dashboard?date=${d}`);

  return (
    <nav aria-label="Day" className="flex items-center justify-between gap-2">
      <Link href={href(addDays(date, -1))} aria-label="Previous day" className={arrowClass}>
        ‹
      </Link>
      <div className="flex flex-col items-center">
        <label className="relative cursor-pointer text-center">
          <span className="block text-2xl font-semibold tracking-tight">{label}</span>
          <span className="block text-sm text-zinc-500">{longDate}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => isIsoDate(e.target.value) && router.push(href(e.target.value))}
            onClick={(e) => e.currentTarget.showPicker?.()}
            aria-label="Choose a day"
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        {date !== today && (
          <Link
            href="/dashboard"
            className="mt-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Back to today
          </Link>
        )}
      </div>
      <Link href={href(addDays(date, 1))} aria-label="Next day" className={arrowClass}>
        ›
      </Link>
    </nav>
  );
}
