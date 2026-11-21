/**
 * Claude's free text (the reply, plan titles and tips) must not carry nutrient numbers: only
 * numbers our code computes are shown (CLAUDE.md, "AI helper integrity"). Any sentence with a
 * digit is dropped.
 */

const MAX_REPLY = 600;
const MAX_TITLE = 60;
const MAX_TIP = 200;

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** The text without any sentence that contains a digit. */
export function withoutNumbers(text: string, max = MAX_REPLY): string {
  return clip(
    sentences(text)
      .filter((s) => !/\d/.test(s))
      .join(" "),
    max,
  );
}

export function planTitle(title: string, index: number): string {
  const clean = title.replace(/\s+/g, " ").trim();
  return !clean || /\d/.test(clean) ? `Option ${index + 1}` : clip(clean, MAX_TITLE);
}

export function planTip(tip: string): string | null {
  return withoutNumbers(tip, MAX_TIP) || null;
}
