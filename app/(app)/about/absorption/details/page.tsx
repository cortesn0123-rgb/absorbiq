import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

export const metadata = { title: "Absorption technical notes · AbsorbIQ" };

async function loadNotes(): Promise<string> {
  "use cache";
  return readFile(path.join(process.cwd(), "docs", "bioavailability.md"), "utf8");
}

/** Shows docs/bioavailability.md as written; read once when the page is built. */
export default async function AbsorptionDetailsPage() {
  const text = await loadNotes();
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/about/absorption"
        className="text-sm text-emerald-700 underline underline-offset-4 dark:text-emerald-400"
      >
        ‹ About absorption
      </Link>
      <pre className="font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}
