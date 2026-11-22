import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to max hits per window, then reports when to retry", () => {
    const limiter = createRateLimiter([{ max: 2, ms: 10_000 }]);
    expect(limiter.check("u", 0)).toEqual({ ok: true });
    expect(limiter.check("u", 1_000)).toEqual({ ok: true });
    expect(limiter.check("u", 2_000)).toEqual({ ok: false, retryAfterSeconds: 8 });
    expect(limiter.check("u", 10_000)).toEqual({ ok: true });
  });

  it("keeps users separate", () => {
    const limiter = createRateLimiter([{ max: 1, ms: 1_000 }]);
    expect(limiter.check("a", 0).ok).toBe(true);
    expect(limiter.check("b", 0).ok).toBe(true);
    expect(limiter.check("a", 10).ok).toBe(false);
  });

  it("enforces every window", () => {
    const limiter = createRateLimiter([
      { max: 3, ms: 1_000 },
      { max: 4, ms: 60_000 },
    ]);
    for (const t of [0, 1, 2]) expect(limiter.check("u", t).ok).toBe(true);
    expect(limiter.check("u", 3).ok).toBe(false);
    expect(limiter.check("u", 2_000).ok).toBe(true);
    expect(limiter.check("u", 4_000)).toEqual({ ok: false, retryAfterSeconds: 56 });
  });

  it("does not count rejected hits", () => {
    const limiter = createRateLimiter([{ max: 1, ms: 1_000 }]);
    limiter.check("u", 0);
    limiter.check("u", 500);
    expect(limiter.check("u", 1_000).ok).toBe(true);
  });

  it("forgets the least recently used key past maxKeys", () => {
    const limiter = createRateLimiter([{ max: 1, ms: 60_000 }], 2);
    limiter.check("a", 0);
    limiter.check("b", 0);
    limiter.check("c", 0);
    expect(limiter.check("a", 1).ok).toBe(true);
    expect(limiter.check("c", 1).ok).toBe(false);
  });
});
