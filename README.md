# MyAi — Today execution system

Treat yourself as an AI agent and process today's work queue.

MyAi is a today-only task tracker styled like an agent's execution dashboard.
Each task you add is a "job" that gets queued, run, paused, completed, or
errored — with a live timer, a compute-effort rating (Low / Medium / High /
Extra High), and an appendable work log, just like watching an agent process
a task in real time.

Everything is scoped to the current day and stored locally in the browser
(`localStorage`) — no account, no backend required to use it.

## Features

- **Execution queue** — add a task, start it, and watch its runtime tick up
  live. Only one task can be "Running" at a time.
- **Compute effort** — tag each task Low / Medium / High / Extra High.
- **Work log** — append timestamped log entries per task (Success / Error /
  Note / Warning / In progress) while it runs.
- **Day-scoped state** — state resets per calendar day (`localStorage`,
  keyed by date); nothing carries over to tomorrow.
- **Keyboard-first** — `⌘K` new task, `⌘↵` run, `Space` pause/resume,
  `⇧⌘↵` complete.
- **Undo** — deleting a task shows a 7-second undo toast.
- **Light/dark theme** toggle, persisted in preferences.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
```

Then open the local dev URL and start adding today's tasks.

## Useful Commands

- `npm run dev` — start local development
- `npm run build` — build for deployment
- `npm test` — build and verify the rendered output
- `npm run lint` — lint the project

## Stack

Built on [vinext](https://github.com/cloudflare/vinext) (a Next.js-compatible
full-stack framework for Cloudflare), with optional D1/Drizzle support for
future server-side persistence. Currently all task data lives client-side in
`localStorage`; `db/schema.ts` is intentionally empty and ready for when
server-backed sync is added.

This project also includes optional support for OpenAI Sites-hosted
deployments (workspace auth headers, ChatGPT sign-in via Dispatch) — see
`app/chatgpt-auth.ts` if deploying on that platform.
