## Rules for Codex and Gemini workers
You are working in a worker copy of this project, on a worker branch. Before anything else:
1. Read `CLAUDE.md` in this folder. All of its rules apply to you too, even where it says "Claude".
2. If you were started as an unattended worker, follow `E:\AgentHub\WORKER.md` exactly, including "Other models" and "Hard limits".

## graphify
- Code question? Run `graphify query "<question>"` first (also `graphify explain "<concept>"`, `graphify path "<A>" "<B>"`). Open source files only at the lines it points to.
- After changing code, run `graphify update .` (local, free).
