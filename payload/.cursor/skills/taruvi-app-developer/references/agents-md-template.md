# AGENTS.md template for consuming Taruvi apps

Every app built on Taruvi should have an `AGENTS.md` at the repo root. It tells *any* agent (Claude Code, Cursor, Copilot, Gemini CLI, Codex, etc.) the app-specific facts the Taruvi skills can't know.

Also create a `CLAUDE.md` at the root that imports from `AGENTS.md` for Claude Code compatibility.

## `AGENTS.md` — fill-in-the-blanks template

```markdown
# <APP_NAME>

<One-paragraph description of what this app does and who uses it.>

This app is built on **Taruvi** (a Django multi-tenant BaaS). Agents working in this repo should use the Taruvi skills for all backend and frontend work:

- `taruvi-app-developer` — all backend work: schema, policies, roles, function metadata, secrets, analytics queries via MCP; Python function bodies that run in the Taruvi runtime
- `taruvi-refine-providers` — Refine.dev UI built with `@taruvi/refine-providers` (data, storage, app, user, auth, access control)

## Stack

- **Frontend**: Refine v<X> + React + <Vite | CRA | Next.js> + <Ant Design | shadcn | Tailwind>
- **Backend**: Taruvi platform (hosted at `<tenant>.taruvi.cloud`)
- **Node**: `>=20`
- **Package manager**: <npm | pnpm | yarn>

## Commands

| Command | Purpose |
|---|---|
| `<pkg> install` | Install dependencies |
| `<pkg> run dev` | Start dev server (port <PORT>) |
| `<pkg> run build` | Production build |
| `<pkg> run test` | Run tests |
| `<pkg> run lint` | Lint |
| `<pkg> run typecheck` | TypeScript typecheck |

## Environment variables

Defined in `.env.local` (not committed). See `.env.example` for the full list.

| Variable | Purpose |
|---|---|
| `<FRAMEWORK_PREFIX>_TARUVI_API_URL` | Taruvi API base URL (e.g., `https://<tenant>.taruvi.cloud`) |
| `<FRAMEWORK_PREFIX>_TARUVI_API_KEY` | Taruvi API / site key |
| `<FRAMEWORK_PREFIX>_TARUVI_APP_SLUG` | This app's slug inside the tenant |

Use `VITE_` for Vite, `REACT_APP_` for CRA, `NEXT_PUBLIC_` for Next.js.

## Domain model

<Brief table mapping domain concepts to Taruvi resources.>

| Concept | Taruvi resource | Notes |
|---|---|---|
| User | datatable `users` | Also in `auth_user` (Django); Taruvi `users` has app-specific attrs |
| <Entity> | datatable `<table>` | <Key details> |
| <Entity> | datatable `<table>` | <Key details> |
| Uploaded files | storage bucket `<bucket>` | <Key details> |

## Conventions

- All Refine resources map 1:1 to Taruvi datatables by default.
- PKs are always `id` unless explicitly noted (then use `meta.idColumnName`).
- New entities **must** have a Cerbos policy before first write.
- Functions live server-side only — we don't run any long tasks in Refine.
- <Other project-specific conventions>

## Tenant & auth

- Tenant: `<tenant-slug>`
- Dev auth method: <email/password | OAuth via X | etc.>
- Production auth: <same or different>
- Session storage: browser `localStorage` (`session_token`)

## Taruvi MCP

Agents should use the Taruvi MCP server for all backend provisioning. Connection config is in `<path>` (or set up via team instructions). Prefer MCP tools over raw SQL or direct Django calls.

## What NOT to do in this repo

- <Project-specific anti-patterns, e.g., "don't write raw SQL; always use MCP tools">
- Don't bypass Cerbos with direct DB access.
- Don't hardcode tenant slugs in code; read from env.
- <Add more as you hit them>

## CI/CD

<Summarize pipeline: linting, type checks, tests, deploy target.>
```

## `CLAUDE.md` — minimal wrapper

```markdown
# CLAUDE.md

@AGENTS.md

## Claude Code additions

- For multi-file feature work, use plan mode first.
- For backend tasks (functions, schemas, policies, MCP calls) use the `taruvi-app-developer` skill.
- For frontend tasks (Refine providers, hooks, UI) use the `taruvi-refine-providers` skill.
- For changes under `src/resources/`, re-run `npm run typecheck` before finishing.
- Use an Explore subagent when touching unfamiliar parts of the codebase.
```

## Filling in the template

When scaffolding a new Taruvi app, emit an `AGENTS.md` with:

1. **Project description** — one paragraph from the user's spec.
2. **Stack** — chosen via the scaffold interview.
3. **Commands** — from `package.json` scripts.
4. **Env vars** — standard three Taruvi env vars + anything the user added.
5. **Domain model table** — one row per entity the user named.
6. **Conventions** — at minimum: "PKs are `id` unless noted", "policies before first write".
7. **Tenant & auth** — from the scaffold interview.
8. **What NOT to do** — start with the defaults above; add project-specific anti-patterns as they emerge.

## When to update AGENTS.md

- Added a new entity / datatable → add a row to the domain model table.
- Changed the command set (new script, renamed command) → update the commands table.
- Added an env var → update env vars table and `.env.example`.
- Hit a gotcha that future agents will also hit → add to "What NOT to do" or a new "Known gotchas" section.
- Changed the auth flow → update tenant & auth section.

## What doesn't belong in AGENTS.md

- Taruvi platform behavior → belongs in the Taruvi skills, not in each app's AGENTS.md.
- Reference docs for Refine / React → Refine and React have their own docs.
- Secrets or credentials → always env vars, never file content.
- Multi-step procedures → those belong in skills (or in a `docs/runbooks/` folder).

Keep AGENTS.md under ~150 lines. If it's growing past that, split into `AGENTS.md` + `docs/` and link.
