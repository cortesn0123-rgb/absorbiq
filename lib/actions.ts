import "server-only";
import { getSignedInClient } from "@/lib/auth";
import { FdcError } from "@/lib/fdc/client";
import { ValidationError } from "@/lib/logs/validate";

/** Shared plumbing for Server Actions. */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Runs an action for the signed-in user, turning errors into messages the UI can show. */
export async function run<T>(
  action: (supabase: NonNullable<Awaited<ReturnType<typeof getSignedInClient>>>) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const supabase = await getSignedInClient();
    if (!supabase) return { ok: false, error: "Your session expired. Please sign in again." };
    return { ok: true, data: await action(supabase) };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    if (error instanceof FdcError) {
      return {
        ok: false,
        error:
          error.status === 404
            ? "FoodData Central has no details for this food."
            : "FoodData Central is not responding. Please try again.",
      };
    }
    console.error(error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what} failed: ${error?.message ?? "no rows"}`);
}
