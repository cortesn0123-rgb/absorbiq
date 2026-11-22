<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Rules for Codex and Gemini workers
You are working in a worker copy of this project, on a worker branch. Before anything else:
1. Read `CLAUDE.md` in this folder. All of its rules apply to you too, even where it says "Claude".
2. If you were started as an unattended worker, follow `E:\AgentHub\WORKER.md` exactly, including "Other models" and "Hard limits".

## graphify
- Code question? Run `graphify query "<question>"` first (also `graphify explain "<concept>"`, `graphify path "<A>" "<B>"`). Open source files only at the lines it points to.
- After changing code, run `graphify update .` (local, free).
