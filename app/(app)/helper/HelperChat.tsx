"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { SCORE_NOTE } from "@/components/AbsorptionScore";
import { Toast, type ToastMessage } from "@/components/Toast";
import type { HelperResponse } from "@/app/api/helper/route";
import type { ChatTurn, PlanItem, PlanResult } from "@/lib/ai/helper";
import { formatAmount, formatNumber, formatPortion } from "@/lib/format";
import { occasionLabel } from "@/lib/meals";
import { addAvoidedFoods, logSuggestedFood } from "./actions";

type Turn = { role: "user"; text: string } | { role: "assistant"; data: HelperResponse };

const cardClass = "rounded-xl border border-zinc-200 p-4 dark:border-zinc-800";

function itemKey(turn: number, plan: number, item: number): string {
  return `${turn}-${plan}-${item}`;
}

export function HelperChat({
  initialRequest,
  autoStart,
  requestsLeft: initialLeft,
}: {
  initialRequest: string;
  autoStart: boolean;
  requestsLeft: number;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState(autoStart ? "" : initialRequest);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestsLeft, setRequestsLeft] = useState(initialLeft);
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    const history: ChatTurn[] = turns.map((t) =>
      t.role === "user" ? t : { role: "assistant", text: t.data.summary },
    );
    setTurns((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const body = (await res.json().catch(() => null)) as
        (HelperResponse & { error?: undefined }) | { error: string } | null;
      if (!res.ok || !body || "error" in body) {
        setError(body && "error" in body && body.error ? body.error : "Something went wrong.");
        if (res.status === 429) setRequestsLeft(0);
        return;
      }
      setTurns((prev) => [...prev, { role: "assistant", data: body as HelperResponse }]);
      setRequestsLeft((body as HelperResponse).requestsLeft);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void send(initialRequest);
    }
    // Runs once on load when the user came from an "Ask" button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pending]);

  return (
    <div className="flex flex-col gap-4">
      {turns.length === 0 && !pending && (
        <p className="text-sm text-zinc-500">
          Ask for foods to close today&apos;s gaps. Follow up with things like &ldquo;no
          dairy&rdquo; or &ldquo;something from a gas station&rdquo;.
        </p>
      )}

      {turns.map((turn, t) =>
        turn.role === "user" ? (
          <p
            key={t}
            className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2 text-white"
          >
            {turn.text}
          </p>
        ) : (
          <Answer
            key={t}
            data={turn.data}
            turnIndex={t}
            logged={logged}
            onLogged={(key, name) => {
              setLogged((prev) => new Set(prev).add(key));
              setToast({ id: Date.now(), text: `Added ${name}` });
            }}
            onError={setError}
          />
        ),
      )}

      {pending && (
        <p
          role="status"
          className="self-start rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
        >
          Looking up foods and calculating… this can take up to a minute.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-100"
        >
          {error}
        </p>
      )}
      <div ref={bottom} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-0 -mx-4 flex gap-2 border-t border-zinc-200 bg-background/95 p-3 backdrop-blur dark:border-zinc-800"
      >
        <label className="sr-only" htmlFor="helper-input">
          Your request
        </label>
        <textarea
          id="helper-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          maxLength={1000}
          placeholder={turns.length ? "Follow up, e.g. no dairy" : "What do you need?"}
          disabled={pending || requestsLeft === 0}
          className="min-w-0 flex-1 resize-none rounded-lg border border-zinc-300 bg-background p-2 text-base dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={pending || !input.trim() || requestsLeft === 0}
          className="h-12 shrink-0 self-end rounded-lg bg-emerald-600 px-4 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
      <p className="-mt-2 text-xs text-zinc-500">
        {requestsLeft === 0
          ? "No AI requests left today. They reset tomorrow."
          : `${requestsLeft} AI ${requestsLeft === 1 ? "request" : "requests"} left today.`}
      </p>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function Answer({
  data,
  turnIndex,
  logged,
  onLogged,
  onError,
}: {
  data: HelperResponse;
  turnIndex: number;
  logged: Set<string>;
  onLogged: (key: string, name: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2 dark:bg-zinc-900">
        {data.reply}
      </p>
      {data.avoidFoods.length > 0 && <AvoidPrompt words={data.avoidFoods} onError={onError} />}
      {data.plans.map((plan, p) => (
        <PlanCard
          key={p}
          plan={plan}
          suggestionId={data.id}
          date={data.date}
          keyOf={(i) => itemKey(turnIndex, p, i)}
          logged={logged}
          onLogged={onLogged}
          onError={onError}
        />
      ))}
    </div>
  );
}

function AvoidPrompt({ words, onError }: { words: string[]; onError: (m: string) => void }) {
  const [state, setState] = useState<"ask" | "saved" | "dismissed">("ask");
  const [isPending, startTransition] = useTransition();
  if (state === "dismissed") return null;
  const list = words.join(", ");
  return (
    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {state === "saved" ? (
        <p>Saved. The helper will leave out {list} from now on (edit in Settings).</p>
      ) : (
        <>
          <p>Save {list} to your foods to avoid, so future suggestions leave it out?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await addAvoidedFoods(words);
                  if (result.ok) setState("saved");
                  else onError(result.error);
                })
              }
              className="h-10 rounded-lg bg-amber-600 px-3 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setState("dismissed")}
              className="h-10 rounded-lg px-3 font-medium hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  suggestionId,
  date,
  keyOf,
  logged,
  onLogged,
  onError,
}: {
  plan: PlanResult;
  suggestionId: number | null;
  date: string;
  keyOf: (item: number) => string;
  logged: Set<string>;
  onLogged: (key: string, name: string) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<Set<number>>(new Set());

  async function add(item: PlanItem, index: number) {
    const key = keyOf(index);
    if (logged.has(key) || busy.has(index)) return;
    setBusy((prev) => new Set(prev).add(index));
    const result = await logSuggestedFood(suggestionId, {
      foodId: item.foodId,
      date,
      occasion: item.occasion,
      portion: {
        grams: item.grams,
        portionLabel: item.portionLabel,
        portionCount: item.portionCount,
      },
    });
    setBusy((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    if (result.ok) onLogged(key, item.name);
    else onError(result.error);
  }

  const allLogged = plan.items.every((_, i) => logged.has(keyOf(i)));
  const improved = plan.gaps.filter((g) => g.after > g.before);

  return (
    <section className={cardClass}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{plan.title}</h2>
        {plan.items.length > 1 && !allLogged && (
          <button
            type="button"
            onClick={async () => {
              for (const [i, item] of plan.items.entries()) await add(item, i);
            }}
            className="h-9 shrink-0 rounded-lg px-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
          >
            Add all
          </button>
        )}
      </div>

      <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {plan.items.map((item, i) => {
          const done = logged.has(keyOf(i));
          return (
            <li key={i} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium">{item.name}</p>
                <p className="text-zinc-500 tabular-nums">
                  {formatPortion(item.grams, item.portionLabel, item.portionCount)}
                  {item.portionLabel && ` (${formatNumber(item.grams)} g)`} ·{" "}
                  {occasionLabel(item.occasion)}
                </p>
              </div>
              <button
                type="button"
                disabled={done || busy.has(i)}
                onClick={() => void add(item, i)}
                className="h-10 shrink-0 rounded-lg border border-emerald-600 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:border-zinc-300 disabled:text-zinc-500 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                {done ? "Added ✓" : busy.has(i) ? "Adding…" : "Add to log"}
              </button>
            </li>
          );
        })}
      </ul>

      {improved.length > 0 && (
        <div className="mt-3 text-sm">
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Gaps (eaten vs goal)
          </h3>
          <ul className="mt-1 tabular-nums">
            {improved.map((g) => (
              <li key={g.id} className="py-0.5">
                <span className="font-medium">{g.name}:</span> {formatAmount(g.before, g.unit)} →{" "}
                {formatAmount(g.after, g.unit)} of {formatAmount(g.goal, g.unit)}
                {g.met && <span className="text-emerald-700 dark:text-emerald-400"> ✓ met</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-2 text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
        +{formatNumber(plan.calories.added)} kcal · {formatNumber(plan.calories.after)}
        {plan.calories.goal !== null && ` of ${formatNumber(plan.calories.goal)}`} kcal today
      </p>

      {plan.scores.length > 0 && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400" title={SCORE_NOTE}>
          Absorption score (estimate):{" "}
          {plan.scores
            .map(
              (s) =>
                `${s.name} ${s.before === null ? "—" : `~${formatNumber(s.before)}`} → ~${formatNumber(s.after)}`,
            )
            .join(" · ")}
        </p>
      )}

      {plan.warnings.length > 0 && (
        <ul role="alert" className="mt-2 text-sm text-red-800 dark:text-red-300">
          {plan.warnings.map((w) => (
            <li key={w.text}>⚠ {w.text}</li>
          ))}
        </ul>
      )}

      {plan.dropped.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">
          Left out: {plan.dropped.map((d) => `${d.name} (${d.reason})`).join("; ")}
        </p>
      )}

      {plan.tip && (
        <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Tip: {plan.tip}
        </p>
      )}
    </section>
  );
}
