import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
}

/**
 * Returns the signed-in user, or redirects to /login. Call inside a <Suspense> boundary.
 * Makes the caller render at request time only: signed-in content is per-user, and the
 * session check reads the clock (Date.now()), which Cache Components rejects while prerendering.
 */
export async function requireUser(): Promise<CurrentUser> {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
