---
name: taruvi-app-developer
description: >
  Backend work on a Taruvi app: provisioning datatables, Cerbos policies,
  roles, users, buckets, secrets, analytics queries, or raw SQL via the
  Taruvi MCP server; and authoring Python function bodies that run in the
  Taruvi function runtime (`def main(params, user_data, sdk_client)`) for
  multi-resource cascades, event/cron handlers, public webhooks, and external
  API calls. Triggers: "create a datatable", "Frictionless schema", "Cerbos
  policy", "serverless function", "scheduled job", "analytics query",
  "sdk_client", `save_functions`, `run_queries`. Skip for Refine
  frontend work — use `taruvi-refine-providers` instead.
license: Apache-2.0
compatibility: >
  Requires the Taruvi MCP server for provisioning tasks (tools prefixed
  `Taruvi:`). Python function bodies run inside the Taruvi function runtime
  (Celery workers) with an injected, pre-authenticated `sdk_client`.
metadata:
  author: EOX Vantage
  version: "2.0.0"
  organization: Taruvi
---

# Taruvi app developer (backend)

Single backend skill for Taruvi. Covers two layers:

- **Control plane (MCP)** — provisioning datatables, policies, roles, buckets, secrets, function metadata, analytics queries, schema and data operations.
- **Data plane (function runtime)** — Python bodies with signature `def main(params, user_data, sdk_client)` running on Celery workers with a pre-authenticated `sdk_client`.

If the task is wiring React/Refine providers or hooks on the frontend, switch to `taruvi-refine-providers`.

## Decision: function or just MCP provisioning?

Provisioning alone is enough for: schema changes, policy/role/user management, bucket creation, secret management, registering analytics queries, data operations.

You need a **function body** when the task involves any of:

- 2+ resources at runtime (DB + storage, users + DB, etc.)
- Event triggers (`RECORD_CREATE`, `RECORD_UPDATE`, `RECORD_DELETE`, `POST_USER_CREATE`, …)
- Schedule / cron
- External API call with a stored secret
- Long-running work (>30s → `async_mode=True`)
- Public unauthenticated endpoint (`is_public=True`)
- Authorization gate beyond plain Cerbos resource policy
- Function-to-function pipeline

When in doubt, see [`when-not-to-use-functions.md`](references/when-not-to-use-functions.md).

## MCP connection contract

Use browser OAuth through the client. Read the [current tool guide](references/mcp-tool-quickref.md) before any MCP work. The Worker uses separate read/write/delete tools and site/app slugs; legacy manage_* and raw SQL tools are absent. Legacy examples in references are not Worker tool signatures. Pin the connection and verify live scope before mutations.

## Workflow

1. Read [`architecture-overview.md`](references/architecture-overview.md) once for the runtime split; for greenfield apps also scaffold an `AGENTS.md` from [`agents-md-template.md`](references/agents-md-template.md).
2. Decide function vs provisioning (above). Before writing function code, read [`function-authoring.md`](references/function-authoring.md) and the relevant section of [`function-sdk-reference.md`](references/function-sdk-reference.md).
3. For MCP work, open [`mcp-tool-quickref.md`](references/mcp-tool-quickref.md) and the task-specific reference below.
4. For destructive ops, follow the destructive-op protocol (below).
5. Verify by re-reading the resource (`get_tables`, `get_policies`, etc.) and executing functions / analytics queries end-to-end before reporting done.

## Reference index

| Task | Read |
|---|---|
| MCP tool signatures | [`mcp-tool-quickref.md`](references/mcp-tool-quickref.md) |
| Frictionless schema (FKs, indexes, hierarchy, graph) | [`datatable-schema-patterns.md`](references/datatable-schema-patterns.md) |
| Cerbos policy authoring | [`cerbos-policy-cookbook.md`](references/cerbos-policy-cookbook.md) — or discover the relevant MCP documentation resource |
| Secrets and custom secret types | [`secrets-and-types.md`](references/secrets-and-types.md) |
| Legacy tenant raw SQL (not available on OAuth Worker) | [`raw-sql-safety.md`](references/raw-sql-safety.md) |
| Analytics queries (registration + Jinja2 params) | [`analytics-queries.md`](references/analytics-queries.md) |
| Filter operators / query capabilities | [`backend-capabilities.md`](references/backend-capabilities.md) |
| Function runtime contract, modes, triggers | [`function-authoring.md`](references/function-authoring.md) |
| `sdk_client` modules and methods | [`function-sdk-reference.md`](references/function-sdk-reference.md) |
| Event triggers, CEL filters | [`function-events.md`](references/function-events.md) |
| Worked function examples (8 scenarios) | [`function-scenarios.md`](references/function-scenarios.md) |
| Cross-layer worked features | [`feature-workflow-examples.md`](references/feature-workflow-examples.md) |
| Integration pitfalls | [`integration-pitfalls.md`](references/integration-pitfalls.md) |
| Frontend Worker deploy | [`frontend-worker-deploy.md`](references/frontend-worker-deploy.md), [`deployment.md`](references/deployment.md) |
| Env var setup | [`env-setup.md`](references/env-setup.md) |

## Non-negotiables

Most of these are wired into the references too — listed here because skipping them causes real bugs.

1. **Trust the MCP tool, not memory.** Tool responses carry the IDs/slugs/status you need next. Don't invent endpoints or method names.
2. **`save_tables` drops fields missing from the payload.** Always `get_tables` first, then send the full preserved field list.
3. **`save_policies` replaces — does not merge.** Get the existing policy first, mutate, and send the full body back.
4. **Function signature is exactly `def main(params, user_data, sdk_client):`.** Any deviation → immediate `SandboxError`.
5. **Never re-authenticate `sdk_client`.** It's pre-authenticated. No `client.auth()`, no `client.login()`, no API keys passed in.
6. **Never hardcode secrets.** Use `sdk_client.secrets.get("KEY")`.
7. **Return JSON-serializable values from functions.** `datetime`, `set`, `Decimal`, and custom classes crash on return — convert first.
8. **Tasks >30s need `is_async=True`.** Sync calls time out at 30s and leave UI spinners stuck.
9. **Use `log()`, not `print()`.** `print()` is unstructured stdout and not queryable.
10. **Frontend multi-resource cascades are bugs.** Move them to a function — browser navigation mid-operation leaves the DB inconsistent.

## Destructive-op protocol

Applies to deletions, schema or policy replacement, user attribute changes, function replacement, secret type deletion, and role changes. Use current tool schemas; the OAuth Worker exposes no raw SQL tool.

1. **Plan** — inspect current state (`get_tables`, `get_policies`, …) and state what will be deleted/replaced and what depends on it.
2. **Validate** — surface the blast radius in plain language ("This will drop `orders` and 3 dependent FKs in `invoices`"). Get explicit user confirmation.
3. **Execute** — only after confirmation. Report the tool's response verbatim.

## Verification scope

Use an existing test tenant and least-privileged test identities when available.
Create test users only when account creation is part of the authorized validation
work in a test environment. Do not create a super-admin as a default, or create
accounts in production simply because provisioning finished. Provide cleanup
steps for any temporary accounts and use the agreed credential-delivery method.

Before executing a function or analytics query, inspect its side effects and
confirm the target tenant/app. Use realistic fixtures in a test environment.
External messages, payments, destructive changes, and production mutations need
authorized test inputs or a supported dry-run path. If safe execution is not
available, report the validation limitation instead of invoking the operation.
Inspect actual safe execution responses and match frontend field names to them.

## Drift check

`bash scripts/check-versions.sh` warns when pinned SDK/provider versions drift from the latest on PyPI/npm.
