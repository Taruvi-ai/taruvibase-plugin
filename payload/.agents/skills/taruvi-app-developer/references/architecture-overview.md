# Taruvi architecture overview

> MCP compatibility: legacy action-based tool examples below apply only to the
> tenant API-key MCP. For OAuth Worker calls, first read the [current tool guide](mcp-tool-quickref.md)
> and use discovered input schemas. Runtime SDK examples remain separate.

The mental model you need to orchestrate Taruvi app development.

## The three layers

```
┌────────────────────────────────────────────────────────────────┐
│  Consuming app (Refine + Taruvi providers)                     │
│  - React components, Refine hooks, access control              │
│  - AGENTS.md tells agents about THIS app's conventions         │
│  → taruvi-refine-providers skill                               │
└────────────────────────────────────────────────────────────────┘
                         ↓  HTTP + session token
┌────────────────────────────────────────────────────────────────┐
│  Taruvi REST API + Taruvi function runtime                     │
│  - /api/apps/{slug}/datatables/{name}/data/                    │
│  - /api/apps/{slug}/storage/buckets/{slug}/objects/            │
│  - /api/apps/{slug}/functions/{slug}/execute/                  │
│  - Function runtime: Celery workers running Python with SDK    │
│  → taruvi-app-developer skill (this one)                       │
└────────────────────────────────────────────────────────────────┘
                         ↑  MCP tool calls
┌────────────────────────────────────────────────────────────────┐
│  Agent (Claude Code / Cursor / etc.) with Taruvi MCP server    │
│  - 24 tools for provisioning backend resources                 │
│  - Used at BUILD time, not runtime                             │
│  → taruvi-app-developer skill (this one)                       │
└────────────────────────────────────────────────────────────────┘
```

## Where does each kind of knowledge live?

| What | Where | Skill |
|---|---|---|
| "How do I create a datatable?" | MCP tool docs + skill body | `taruvi-app-developer` |
| "What Frictionless fields are supported?" | [`datatable-schema-patterns.md`](datatable-schema-patterns.md) | `taruvi-app-developer` |
| "How do I write a Cerbos policy?" | [`cerbos-policy-cookbook.md`](cerbos-policy-cookbook.md) | `taruvi-app-developer` |
| "What's the signature of a function body?" | [`function-authoring.md`](function-authoring.md) | `taruvi-app-developer` |
| "How does `sdk_client.database` work in a function?" | [`function-sdk-reference.md`](function-sdk-reference.md) | `taruvi-app-developer` |
| "What meta options does Refine's dataProvider accept?" | refine provider references | `taruvi-refine-providers` |
| "How do I wire authProvider?" | refine `auth-provider.md` | `taruvi-refine-providers` |
| "What commands run the dev server?" | App's AGENTS.md | (per-app) |
| "What tenant does this app belong to?" | App's AGENTS.md | (per-app) |
| "How are entities named in this app?" | App's AGENTS.md | (per-app) |

## Tenancy

Every Taruvi resource exists inside a **tenant schema**. Tenants are resolved via subdomain (`acme.taruvi.cloud`) or `X-Tenant` header (local dev).

Agents don't need to worry about tenant resolution for MCP operations — the MCP server uses the session's tenant context. The consuming app's providers do the same: the `Client` instance's `apiUrl` encodes which tenant, and session tokens carry the auth context.

Things that cross tenant boundaries:

- Core user identity (Django `auth_user` in `public` schema).
- Shared RBAC definitions (Django groups).
- Organization/site config.

Things tenant-scoped:

- All datatables, storage objects, functions, policies, secrets, roles, analytics queries, tags.

## Apps within a tenant

A tenant can have multiple apps. Each app has a slug (`my-blog`, `internal-crm`). Provisioning targets an app via the MCP context or explicit `app_slug` argument.

Consuming Refine apps hard-wire a single app via `Client({ appSlug: "..." })`. If one Refine app needs to span multiple Taruvi apps, create multiple `Client` instances.

## The control plane vs data plane

Taruvi intentionally splits:

- **Control plane (MCP)**: `create_update_schema`, `manage_policies`, `manage_function`, `manage_secret_types`, `execute_raw_sql` — agent-time provisioning, may be destructive. Lives in `taruvi-app-developer`.
- **Data plane (SDKs)**: CRUD on rows, file upload/download, function execution, policy checks — runtime consumption, never destroys schema. Lives in `taruvi-refine-providers` (frontend) and the function runtime (`taruvi-app-developer`, Python `sdk_client`).

This is why you don't see `drop_table` in the JS SDK: schema mutations are control-plane by design. Keep this split in mind when deciding where to put logic:

- Schema changes → MCP (this skill).
- Row reads/writes from the browser → Refine providers (`taruvi-refine-providers`).
- Row reads/writes from a function body → `sdk_client.database` (this skill, [`function-sdk-reference.md`](function-sdk-reference.md)).

## The fourth layer — AGENTS.md / CLAUDE.md

Per consuming app, an `AGENTS.md` at the repo root tells *any* agent (Claude Code, Cursor, Copilot, etc.) the app-specific facts:

- Project purpose
- Commands (dev, build, test, lint)
- Entity vocabulary ("a 'Post' maps to the `posts` datatable with columns ...")
- Auth method (email/pass, OAuth, etc.)
- Env vars
- Skill references (which Taruvi skills to use for what)

See the template in [`agents-md-template.md`](agents-md-template.md).

## Failure mode: knowing where to put new information

When you learn a new fact about a Taruvi app you're building, ask:

- Is it true across **all Taruvi apps**? → Belongs in a Taruvi skill (update the relevant `references/*.md`).
- Is it true across **all apps in this tenant**? → Belongs in shared org-level docs (not covered by these skills).
- Is it true for **this one app**? → Belongs in the app's `AGENTS.md`.
- Is it **an agent correction I just made**? → Belongs in the "Gotchas" section of whichever skill was in scope.
