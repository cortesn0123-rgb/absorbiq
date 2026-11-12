import { connection } from "next/server";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Today · Micronutrient Tracker" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  // Per-user page: render at request time only. The session check reads the clock (Date.now()).
  await connection();
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        {user.email && <p className="mt-1 text-sm text-zinc-500">Signed in as {user.email}</p>}
      </div>
      <section className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="font-medium">No foods logged yet</p>
        <p className="mt-1 text-sm text-zinc-500">Food logging arrives in the next phase.</p>
      </section>
    </div>
  );
}
