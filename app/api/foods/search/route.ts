import { NextResponse, type NextRequest } from "next/server";
import { getSignedInClient } from "@/lib/auth";
import { searchFoods } from "@/lib/fdc/client";
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, normalizeQuery } from "@/lib/fdc/search";

/** GET /api/foods/search?q=lentils — proxies FDC search so the API key stays on the server. */
export async function GET(request: NextRequest) {
  if (!(await getSignedInClient())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const query = normalizeQuery(request.nextUrl.searchParams.get("q") ?? "");
  if (query.length < MIN_QUERY_LENGTH) return NextResponse.json({ results: [] });
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Search is too long." }, { status: 400 });
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
