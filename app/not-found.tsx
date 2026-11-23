import Link from "next/link";

export const metadata = { title: "Page not found · AbsorbIQ" };

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-3 px-4 py-16">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-muted">That page does not exist or has moved.</p>
      <Link
        href="/home"
        className="flex h-11 items-center rounded-lg bg-emerald-600 px-4 font-medium text-white hover:bg-emerald-700"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
