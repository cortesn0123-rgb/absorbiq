/**
 * In-memory sliding-window rate limiter, keyed by user.
 *
 * State lives in the server process, so on Vercel each instance keeps its own
 * counts. That is enough to stop one user from draining a shared API quota by
 * accident or in a loop; it is not a hard guarantee across instances.
 */

export type Window = { max: number; ms: number };

export type RateLimiter = {
  /** Records a hit for `key` and returns whether it is allowed. Rejected hits are not counted. */
  check(key: string, now?: number): { ok: true } | { ok: false; retryAfterSeconds: number };
};

export function createRateLimiter(windows: Window[], maxKeys = 10_000): RateLimiter {
  const longest = Math.max(...windows.map((w) => w.ms));
  const hits = new Map<string, number[]>();

  return {
    check(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < longest);
      for (const w of windows) {
        const inWindow = recent.filter((t) => now - t < w.ms);
        if (inWindow.length >= w.max) {
          hits.set(key, recent);
          const retryAfterMs = inWindow[0] + w.ms - now;
          return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
        }
      }
      recent.push(now);
      hits.delete(key);
      hits.set(key, recent);
      // Drop the least recently used key so memory stays bounded.
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
      return { ok: true };
    },
  };
}
