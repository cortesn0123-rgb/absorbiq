/**
 * Public Supabase settings. These must be read with literal `process.env.NEXT_PUBLIC_*`
 * expressions so Next.js can inline them into the browser bundle.
 */
export function supabaseEnv(): { url: string; anonKey: string } {
  return validateSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Fails fast on missing values, a non-URL, or a secret key placed in a public variable. */
export function validateSupabaseEnv(
  url: string | undefined,
  anonKey: string | undefined,
): { url: string; anonKey: string } {
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }
  if (anonKey.startsWith("sb_secret_") || url.startsWith("sb_secret_")) {
    throw new Error(
      "A Supabase secret key is in a NEXT_PUBLIC_ variable, which would expose it to browsers. Use the publishable (anon) key there and put the secret key in SUPABASE_SECRET_KEY.",
    );
  }
  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be your project URL, e.g. https://abcd1234.supabase.co (Project Settings > API).",
    );
  }
  return { url, anonKey };
}

/** Every variable the app needs in production (see .env.example). */
export const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "FDC_API_KEY",
  "ANTHROPIC_API_KEY",
] as const;

/** Names of required variables that are missing or blank. */
export function missingEnv(env: Record<string, string | undefined>): string[] {
  return REQUIRED_ENV.filter((name) => !env[name]?.trim());
}
