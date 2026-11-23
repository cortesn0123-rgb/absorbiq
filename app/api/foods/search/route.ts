import { NextResponse, type NextRequest } from "next/server";
import { getSignedInClient } from "@/lib/auth";
import { searchFoods } from "@/lib/fdc/client";
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, normalizeQuery } from "@/lib/fdc/search";
import { createRateLimiter } from "@/lib/rate-limit";

// The FDC key allows about 1,000 requests an hour for the whole app, so one
// user can't use more than a share of it. Typing searches as you go, so the
// per-minute window is generous.
const searchLimiter = createRateLimiter([
  { max: 30, ms: 60_000 },
  { max: 200, ms: 60 * 60_000 },
]);

/** GET /api/foods/search?q=lentils — proxies FDC search so the API key stays on the server. */
export async function GET(request: NextRequest) {
  const supabase = await getSignedInClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const query = normalizeQuery(request.nextUrl.searchParams.get("q") ?? "");
  if (query.length < MIN_QUERY_LENGTH) return NextResponse.json({ results: [] });
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Search is too long." }, { status: 400 });
  }
  const { data } = await supabase.auth.getClaims();
  const limit = searchLimiter.check(data?.claims?.sub ?? "");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many searches. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  try {
    return NextResponse.json({ results: await searchFoods(query) });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "FoodData Central is not responding. Please try again." },
      { status: 502 },
    );
  }
}
