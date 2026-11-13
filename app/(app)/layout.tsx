import Link from "next/link";
import type { ReactNode } from "react";
import { TimezoneSync } from "@/components/TimezoneSync";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <TimezoneSync />
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-zinc-200 bg-background/90 px-4 backdrop-blur dark:border-zinc-800">
        <Link href="/home" className="font-semibold tracking-tight">
          Micronutrient
        </Link>
        <nav className="flex items-center gap-0.5">
          <Link
            href="/dashboard"
            className="flex h-10 items-center rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Day
          </Link>
          <Link
            href="/log"
            className="flex h-10 items-center rounded-lg px-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
          >
            Log food
          </Link>
          <Link
            href="/settings"
            className="flex h-10 items-center rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="h-10 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
