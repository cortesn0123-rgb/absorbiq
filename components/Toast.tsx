"use client";

import { useEffect } from "react";

export interface ToastMessage {
  /** Changes for every new toast so the timer restarts. */
  id: number;
  text: string;
  onUndo?: () => void;
}

/** Bottom-of-screen confirmation with an optional Undo; dismisses itself after 5 s. */
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
    >
      <span>{toast.text}</span>
      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            onDismiss();
          }}
          className="h-9 shrink-0 rounded-lg px-3 font-semibold text-emerald-400 hover:bg-white/10 dark:text-emerald-700 dark:hover:bg-black/5"
        >
          Undo
        </button>
      )}
    </div>
  );
}
