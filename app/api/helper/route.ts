import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { HelperError, runHelper, type HelperResult } from "@/lib/ai/helper";
import { DAILY_REQUEST_LIMIT, parseHelperBody } from "@/lib/ai/request";
import { getSignedInClient } from "@/lib/auth";
import { CLAUDE_MODEL } from "@/lib/config";
import { TZ_COOKIE, hourIn, todayIn } from "@/lib/dates";
import { getFood } from "@/lib/fdc/cache";
import { searchFoods } from "@/lib/fdc/client";
import { loadFactorTable } from "@/lib/logs/absorption-data";
import { getDayLogs, getTrainingSessions } from "@/lib/logs/queries";
import { ValidationError } from "@/lib/logs/validate";
import { nextSnackNumber, snackSummaries } from "@/lib/meals";
import { applyCustomGoals } from "@/lib/nutrients/goals";
import { getDailyTargets } from "@/lib/nutrients/targets";
import { customGoals, trackedMicros, visibleNutrients } from "@/lib/nutrients/tracking";
import { engineProfile, isProfileComplete, targetInput } from "@/lib/profile";
import { loadAvoidedFoods, loadProfile, loadTracking } from "@/lib/settings";

/** Several Claude calls with tool use; allow up to two minutes. */
export const maxDuration = 120;

export interface HelperResponse {
  id: number | null;
  reply: string;
  plans: HelperResult["plans"];
  avoidFoods: string[];
  summary: string;
  date: string;
  requestsLeft: number;
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/helper — { message, history } → suggestions. Claude is called only from here, with
 * the key on the server. Every number in the response is computed by our code.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSignedInClient();
  if (!supabase) return error("Your session expired. Please sign in again.", 401);
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return error("Your session expired. Please sign in again.", 401);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY. Add it to .env.local.");
    return error("The AI helper is not set up yet.", 503);
  }

  let body;
  try {
    body = parseHelperBody(await request.json());
  } catch (e) {
    return error(e instanceof ValidationError ? e.message : "Invalid request.", 400);
  }

  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  const today = todayIn(tz);

  const { count, error: countError } = await supabase
    .from("ai_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("suggestion_date", today);
  if (countError) {
    console.error(`Counting AI requests failed: ${countError.message}`);
    return error("Something went wrong. Please try again.", 500);
  }
  const used = count ?? 0;
  if (used >= DAILY_REQUEST_LIMIT) {
    return error(
      `You have used today's ${DAILY_REQUEST_LIMIT} AI helper requests. They reset tomorrow.`,
      429,
    );
  }

  try {
    const [profile, logs, training, factors, tracking, avoided] = await Promise.all([
      loadProfile(supabase, userId),
      getDayLogs(supabase, today),
      getTrainingSessions(supabase, today),
      loadFactorTable(supabase),
      loadTracking(supabase),
      loadAvoidedFoods(supabase, userId),
    ]);
    if (!isProfileComplete(profile)) return error("Finish setting up your profile first.", 400);

    const goals = applyCustomGoals(
      getDailyTargets(targetInput(profile, training)),
      customGoals(tracking),
    );
    const client = new Anthropic();
    let result: HelperResult | null = null;
    let failure: string | null = null;
    try {
      result = await runHelper(
        {
          model: CLAUDE_MODEL,
          day: {
            logs,
            goals,
            visible: visibleNutrients(trackedMicros(tracking)),
            profile: engineProfile(profile),
            factors,
          },
          date: today,
          hour: hourIn(tz),
          nextSnack: nextSnackNumber(snackSummaries(logs)),
          diet: profile.dietType,
          avoided,
          history: body.history,
          message: body.message,
        },
        {
          createMessage: (params) => client.beta.messages.create(params),
          searchFoods,
          getFood,
        },
      );
    } catch (e) {
      failure = userMessage(e);
      console.error("[helper]", e);
    }

    // Every request counts toward the daily limit, answered or not.
    const { data: saved, error: saveError } = await supabase
      .from("ai_suggestions")
      .insert({
        suggestion_date: today,
        request: { message: body.message, history_turns: body.history.length, model: CLAUDE_MODEL },
        response: result
          ? {
              reply: result.reply,
              plans: result.plans,
              avoid_foods: result.avoidFoods,
              tool_calls: result.toolCalls,
              rounds: result.rounds,
              usage: result.usage,
            }
          : { error: failure },
      })
      .select("id")
      .single<{ id: number }>();
    if (saveError) console.error(`Saving AI suggestion failed: ${saveError.message}`);

    if (!result) return error(failure!, 502);
    return NextResponse.json({
      id: saved?.id ?? null,
      reply: result.reply,
      plans: result.plans,
      avoidFoods: result.avoidFoods,
      summary: result.summary,
      date: today,
      requestsLeft: Math.max(0, DAILY_REQUEST_LIMIT - used - 1),
    } satisfies HelperResponse);
  } catch (e) {
    console.error("[helper]", e);
    return error("Something went wrong. Please try again.", 500);
  }
}

function userMessage(e: unknown): string {
  if (e instanceof HelperError) return e.userMessage;
  if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) {
    return "The AI service is busy. Please try again in a minute.";
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return "The AI helper's API key is not working. Check ANTHROPIC_API_KEY.";
  }
  if (e instanceof Anthropic.APIError) return "The AI service returned an error. Please try again.";
  return "Something went wrong. Please try again.";
}
