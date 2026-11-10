# Taruvi MCP operations reference

What the Taruvi MCP server lets you do, and the gotchas for each operation. Read this before composing a sequence of calls.

## How to use this file

**This file deliberately does not name MCP tools.** The server's tool names and argument shapes change between versions. For every operation below:

1. Find the tool in the connected server's tool list whose name and description match the operation (e.g. "read table schemas", "run a function").
2. Read that tool's description and input schema, and follow them. **When the live tool description disagrees with this file, the tool description wins.**
3. If no tool covers an operation, the server doesn't offer it — say so and use the fallback listed here (SDK, REST API, or Console). Don't invent a tool name.

Many tools accept an optional site and app. Pass them unless the user's connection covers only one site / one app. Batch tools usually report success and failure per item — check the failures, a partial failure is not an error response.

## Sites and apps

- **Confirm the connection first.** Before the first change in a session, list the apps this connection covers and confirm with the user that it's the intended site and app.
- Sites and apps can be listed, created, and renamed. Slugs can't change after creation. Deleting sites or apps is a Console action.

## Datatables

- **Read table schemas** — one, several, or all tables in the app. **Always read before saving an existing table.**
- **Save table schemas** — create or update tables from Frictionless Data Package resources. Physical tables are materialized automatically.
  - **The schema you send replaces the stored one.** A field left out is dropped, with its column and data. Send the complete schema back with your change.
  - DDL has a ~30s server-side timeout — split large refactors into smaller saves.
  - See [`datatable-schema-patterns.md`](datatable-schema-patterns.md) for field types, FKs, indexes, search, vectors, graph tables, and safe-vs-destructive changes.
- **Delete tables** — drops the physical table, its records, and metadata. **Destructive.** Fails while other tables have FKs to it (for graph tables, including its own `{table}_edges`) — delete referencing tables first. Check the tool description for whether a force option exists; confirm with the user before any delete.

## Records

- **Query records** — filters, ordering, pagination, field selection, relationship population, full-text and vector search.
  - Filter keys use `field__operator` (`total__gte`, `status__in`), with `and` / `or` / `not` groups.
  - FK traversal via dot notation (`deal_id.name__contains`, reverse `employees.status__eq`), max 3 hops; flat tables only.
  - Aggregation (count/sum/group by) is generally **not** available through record queries — use an analytics query, the SDK, or the Refine data provider. See [`backend-capabilities.md`](backend-capabilities.md) for the full operator set.
- **Save records** — upsert, matched on the primary key or chosen unique fields. Check the tool description for batch limits and whether updates need complete rows.
- **Delete records** — check the tool description for whether it deletes by id only or also by filter. If by id only, query the ids first.

## Graph / hierarchy edges

For tables with `hierarchy: true` or `graph.enabled: true`: **list**, **create**, and **delete** edges. Each edge is `{from_id, to_id, type, metadata?}`. Both nodes must exist. Direction: `from_id` is the child/report, `to_id` the parent/manager.

## Storage

- **List buckets**, **create buckets**, **list objects** in a bucket (with a path prefix).
- Creating a bucket requires an `app_category` of `"assets"` or `"attachments"`; visibility defaults to private.
- Uploading files, deleting objects, and changing or deleting buckets may not be MCP operations — use the SDK, REST API, or Console if no tool covers them.

## Secrets

- **Secret types** — list, create, update, delete. A type must exist before secrets of that type. Type names match `^[a-zA-Z0-9_-]+$`; description is required. **Sensitivity level is immutable after creation.** System types can't be changed or deleted; a type in use can't be deleted.
- **Secrets** — list, read by key, create/update. Values validate against the type's schema. Non-`public` values come back as `[ENCRYPTED]` — read them inside a function body with `sdk_client.secrets.get(...)` instead. App-level secrets resolve before site-level ones.

See [`secrets-and-types.md`](secrets-and-types.md).

## Users

- **List users** — active users only by default; ask explicitly for inactive ones.
- **Create users** — username and email are required. Generate a strong password if the user wants password sign-in. Assign roles at creation (list roles first).
- **Update users** — **passwords can't be changed here**; use the password-reset flow.
- **User attributes schema** — tenant-wide JSON Schema (Draft 2020-12). **Saving replaces the whole schema** — read, merge, then save.

## Roles

- **List**, **create** (optionally under a parent role), **delete** roles, and **assign** / **revoke** roles for users (optionally with an expiry).
- Role **slugs** are app-scoped (`<app>-<name>`) and are what role tools expect. **Exception:** Cerbos policy `roles[]` arrays match the bare role `name`, not the slug — see [`cerbos-policy-cookbook.md`](cerbos-policy-cookbook.md).
- Deleting a role fails while it has members or child roles: revoke members and delete children first.

## Functions

- **List / read functions** — reading one returns its code (app mode) or webhook config (proxy mode).
- **Create / update functions** — `execution_mode` (`"app"` or `"proxy"`) is required on create, plus `code` (app) or `webhook_url` (proxy). Defaults: active, not public, sync.
  - Check whether an existing function has the same name before creating — update the existing one by slug instead of creating a duplicate.
  - `is_public` means anyone can run it without signing in.
  - App-mode signature: `def main(params, user_data, sdk_client)`. See [`function-authoring.md`](function-authoring.md).
- **Delete functions.**
- **Run functions** — sync runs return the result and logs (**the way to debug**); async runs return a task id whose result you fetch separately.
- **Event subscriptions** — subscribe / unsubscribe functions to events (`RECORD_CREATE`, `RECORD_UPDATE`, `RECORD_DELETE`, `PRE_USER_CREATE`, `POST_USER_CREATE`, `POST_USER_UPDATE`, `POST_USER_DELETE`) and list subscribers. See [`function-events.md`](function-events.md).
- Schedules (cron) may not be an MCP operation — if no tool covers them, set them in Console.

## Policies (Cerbos)

- **List / read policies**, **create or update policies**, **disable policies**.
- **Saving replaces the policy, it does not merge** — read the existing policy, add your rule, send the full body back.
- Policies read back may come in Cerbos-native shape, which can differ from the shape the save tool expects — check the save tool's input schema.
- Check the tool list for whether a disabled policy can be re-enabled; if not, recreate it.

See [`cerbos-policy-cookbook.md`](cerbos-policy-cookbook.md).

## Analytics queries

- **List / read**, **create**, **update**, **delete**, and **run** saved queries.
- Queries are `internal` (your app's own tables, no credentials) or `external` (needs a `secret_key` pointing to an analytics-typed secret). Pass the connection type explicitly.
- **Check the tool description for the placeholder rules** (which template syntax is accepted, whether values are bound or substituted) before writing `query_text`.

See [`analytics-queries.md`](analytics-queries.md).

## Raw SQL

Some server versions offer an audited raw SQL tool; others don't. Check the tool list. If there's none, use schema saves for DDL, record saves/deletes for writes, and an internal analytics query for reads and aggregation. See [`raw-sql-safety.md`](raw-sql-safety.md).

## Docs

Product docs may be exposed as MCP resources (`taruvi://docs/...`) or through a docs tool. Check the server's resources and tools.
