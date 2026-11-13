import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard?day=2026-01-01", "/dashboard?day=2026-01-01"],
    [null, "/home"],
    ["", "/home"],
    ["https://evil.com", "/home"],
    ["//evil.com", "/home"],
    ["/\\evil.com", "/home"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
