/**
 * Calendar dates as ISO "YYYY-MM-DD" strings in the user's time zone. The browser stores its
 * time zone in the TZ_COOKIE cookie (components/TimezoneSync.tsx) so the server knows "today".
 */

export const TZ_COOKIE = "tz";

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidTimeZone(timeZone: string | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Today's date in `timeZone` (UTC when missing or invalid). */
export function todayIn(timeZone: string | undefined, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidTimeZone(timeZone) ? timeZone : "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "Today", "Yesterday", "Tomorrow", or e.g. "Mon, Nov 9" (with the year if not this year). */
export function formatDayLabel(isoDate: string, today: string): string {
  if (isoDate === today) return "Today";
  if (isoDate === addDays(today, -1)) return "Yesterday";
  if (isoDate === addDays(today, 1)) return "Tomorrow";
  const sameYear = isoDate.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** The current hour (0–23) in `timeZone` (UTC when missing or invalid). */
export function hourIn(timeZone: string | undefined, now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: isValidTimeZone(timeZone) ? timeZone : "UTC",
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

/** e.g. "Wednesday, November 11, 2026". */
export function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
