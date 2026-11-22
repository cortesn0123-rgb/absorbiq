import { NextResponse, type NextRequest } from "next/server";
import { getSignedInClient } from "@/lib/auth";
import { loadFactorTable } from "@/lib/logs/absorption-data";
import { absorbLogs } from "@/lib/logs/day-absorption";
import { buildExportCsv, parseExportRange } from "@/lib/logs/export";
import { getLogsInRange, type LoggedFood } from "@/lib/logs/queries";
import { ValidationError } from "@/lib/logs/validate";
import { trackedMicros, visibleNutrients } from "@/lib/nutrients/tracking";
import { engineProfile, isProfileComplete } from "@/lib/profile";
import { loadProfile, loadTracking } from "@/lib/settings";

function error(message: string, status: number) {
  return new NextResponse(message, { status, headers: { "Content-Type": "text/plain" } });
}

/** GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD — eaten and absorbed per nutrient per day. */
export async function GET(request: NextRequest) {
  const supabase = await getSignedInClient();
  if (!supabase) return error("Your session expired. Please sign in again.", 401);
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return error("Your session expired. Please sign in again.", 401);

  const params = request.nextUrl.searchParams;
  let dates: string[];
  try {
    dates = parseExportRange(params.get("from"), params.get("to"));
  } catch (e) {
    return error(e instanceof ValidationError ? e.message : "Invalid dates.", 400);
  }
  const from = dates[0];
  const to = dates[dates.length - 1];

  try {
    const [profile, logs, factors, tracking] = await Promise.all([
      loadProfile(supabase, userId),
      getLogsInRange(supabase, from, to),
      loadFactorTable(supabase),
      loadTracking(supabase),
    ]);
    if (!isProfileComplete(profile)) return error("Finish setting up your profile first.", 400);

    const byDay = new Map<string, LoggedFood[]>();
    for (const log of logs) byDay.set(log.date, [...(byDay.get(log.date) ?? []), log]);
    const engine = engineProfile(profile);
    const csv = buildExportCsv(
      dates.map((date) => {
        const dayLogs = byDay.get(date);
        return {
          date,
          totals: dayLogs ? absorbLogs(dayLogs, engine, factors).day.totals : null,
        };
      }),
      visibleNutrients(trackedMicros(tracking)),
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="absorbiq-${from}-to-${to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[export]", e);
    return error("Something went wrong. Please try again.", 500);
  }
}
