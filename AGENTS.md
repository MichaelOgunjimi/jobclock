<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Issues live in the `MichaelOgunjimi/jobclock` GitHub repo, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## New worktrees

- Run `make new-worktree` immediately after creating or entering a linked worktree. It links the primary checkout's `.env.local` and assigns a stable free dev port (4000-4999) in the git-ignored `.worktree.env`. In the primary checkout it does nothing.
- Start the dev server with `make dev`; it uses the worktree's port (3000 in the primary checkout). Never start a dev server on another project's port.
- `make check` runs the type check, lint, and unit tests; run it before committing.
- `make migrate` applies database migrations to the database in `.env.local`, which may be the hosted project. Confirm the target first.
