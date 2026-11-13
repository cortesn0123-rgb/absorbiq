"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export function LoginForm() {
  const callbackError = useSearchParams().get("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(
    callbackError ? { kind: "error", message: callbackError } : { kind: "idle" },
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "sending" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/home` },
    });
    setStatus(error ? { kind: "error", message: error.message } : { kind: "sent", email });
  }

  if (status.kind === "sent") {
    return (
      <div
        role="status"
        className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      >
        Check <strong>{status.email}</strong> for a sign-in link. Open it in this browser.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-12 rounded-lg border border-zinc-300 bg-transparent px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 dark:border-zinc-700"
        placeholder="you@example.com"
      />
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="h-12 rounded-lg bg-emerald-600 text-base font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {status.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {status.kind === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {status.message}
        </p>
      )}
    </form>
  );
}
