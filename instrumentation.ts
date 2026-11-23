import { missingEnv } from "@/lib/env";

/** Runs once when the server starts: logs missing settings so a bad deploy shows up in the logs. */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const missing = missingEnv(process.env);
  if (missing.length > 0) {
    console.error(
      `[env] Missing environment variables: ${missing.join(", ")}. Add them in Vercel > Project > Settings > Environment Variables (or .env.local), then redeploy.`,
    );
  }
}
