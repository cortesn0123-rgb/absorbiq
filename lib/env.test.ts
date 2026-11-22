import { describe, expect, it } from "vitest";
import { missingEnv, validateSupabaseEnv } from "./env";

const url = "https://abcd1234.supabase.co";

describe("validateSupabaseEnv", () => {
  it("accepts a project URL and a publishable key", () => {
    expect(validateSupabaseEnv(url, "sb_publishable_abc")).toEqual({
      url,
      anonKey: "sb_publishable_abc",
    });
  });

  it("rejects missing values", () => {
    expect(() => validateSupabaseEnv(undefined, "sb_publishable_abc")).toThrow(/Missing/);
    expect(() => validateSupabaseEnv(url, "")).toThrow(/Missing/);
  });

  it("rejects a secret key in a public variable", () => {
    expect(() => validateSupabaseEnv(url, "sb_secret_abc")).toThrow(/secret key/);
  });

  it("rejects a URL that is not a URL", () => {
    expect(() => validateSupabaseEnv("sb_publishable_abc", "sb_publishable_xyz")).toThrow(
      /must be your project URL/,
    );
  });
});

describe("missingEnv", () => {
  it("lists missing and blank variables", () => {
    expect(
      missingEnv({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abc",
        SUPABASE_SECRET_KEY: " ",
        FDC_API_KEY: "x",
      }),
    ).toEqual(["SUPABASE_SECRET_KEY", "ANTHROPIC_API_KEY"]);
  });
});
