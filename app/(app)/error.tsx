"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Shown when a signed-in page fails to load. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">
        This page could not load. Check your connection and try again.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="h-11 rounded-lg bg-emerald-600 px-4 font-medium text-white hover:bg-emerald-700"
        >
          Try again
        </button>
        <Link
          href="/home"
          className="flex h-11 items-center rounded-lg px-4 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
