import Link from "next/link";

export const metadata = { title: "Settings · AbsorbIQ" };

const LINKS = [
  {
    href: "/settings/nutrients",
    title: "Nutrients",
    description: "Choose what to track, your target tier and your goals.",
  },
  {
    href: "/settings/profile",
    title: "Profile",
    description: "Age, sex, body size, activity and training.",
  },
  {
    href: "/settings/avoided",
    title: "Foods to avoid",
    description: "Foods the AI helper leaves out of its suggestions.",
  },
  {
    href: "/settings/export",
    title: "Export data",
    description: "Download what you ate and absorbed as a CSV file.",
  },
  {
    href: "/about/absorption",
    title: "About absorption",
    description: "How the absorbed estimates work, and their limits.",
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="flex flex-col">
                <span className="font-medium">{l.title}</span>
                <span className="text-sm text-muted">{l.description}</span>
              </span>
              <span aria-hidden className="text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
