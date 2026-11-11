export const DISCLAIMER =
  "For information only, not medical advice. Absorption figures are estimates. Talk to a doctor or registered dietitian before changing your diet or taking supplements.";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 px-4 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
      {DISCLAIMER}
    </footer>
  );
}
