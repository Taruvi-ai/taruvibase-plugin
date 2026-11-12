---
name: taruvi-refine-providers
description: >
  Refine.dev frontend work on a Taruvi app: wiring data/storage/app/user
  providers, authProvider, accessControlProvider; Refine hooks against Taruvi
  (CRUD, useCustom, useCan, useDataGrid, useForm); building list pages,
  dashboards, KPI cards, file managers, network-backed autocompletes; calling
  Taruvi functions and analytics from the frontend; debugging 401/403, token
  refresh, redirect loops, or permission failures. Triggers: any Refine/React
  work in a Taruvi project, "build a list page", "add a dashboard", "wire up
  auth", "dataProvider", "@taruvi/refine-providers", `VITE_TARUVI_*`. Skip
  for backend Python, MCP provisioning, schemas, policies, or raw SQL — use
  `taruvi-app-developer` instead.
metadata:
  author: taruvi-ai
  version: "2.0.0"
---

# Taruvi Refine providers (frontend)

Single frontend skill for Taruvi. Covers everything that runs in the browser: wiring `@taruvi/refine-providers`, all Refine hook usage against Taruvi, production-ready list/dashboard/dropdown/upload UX, auth flow, and access control.

If the task is provisioning resources or authoring Python function bodies, switch to `taruvi-app-developer`.

## Provider map

| Provider | Refine key | Purpose |
|---|---|---|
| `dataProvider(client)` | `default` | Datatable CRUD, filters, pagination, aggregation, graph |
| `storageDataProvider(client)` | `storage` | File/object upload, list, download, delete |
| `appDataProvider(client)` | `app` | Function/analytics execution, roles, settings, secrets (via `useCustom` / `useList` / `useOne`) |
| `userDataProvider(client)` | `user` | User CRUD |
| `authProvider(client)` | `authProvider` prop | Login, logout, token refresh, identity, permissions |
| `accessControlProvider(client)` | `accessControlProvider` prop | Batched Cerbos checks for `useCan` / `CanAccess` |

Hook support matrix and `meta` options live in [`overview.md`](references/overview.md).

**Deprecated — do not use:** `functionsDataProvider`, `analyticsDataProvider`. Use `appDataProvider` + `useCustom` with `meta.kind: "function"` or `meta.kind: "analytics"` instead.

## Workflow

1. Read [`overview.md`](references/overview.md) once — install, client setup, full provider/hook map.
2. Open the task-specific reference (table below).
3. Identify the installed package's current non-deprecated API. Don't ship new code on a deprecated surface just because old examples exist.
4. Apply the production-ready defaults (next section).
5. Walk the UI for each role before reporting done — confirm list actions, create buttons, and menu items show/hide correctly.

## Reference index

| Task | Read |
|---|---|
| Database CRUD, filters, aggregation, graph | [`database-provider.md`](references/database-provider.md) |
| File upload, batch delete, metadata, filters | [`storage-provider.md`](references/storage-provider.md) |
| Function execution, analytics, roles, settings, secrets | [`app-provider.md`](references/app-provider.md) |
| User CRUD | [`user-provider.md`](references/user-provider.md) |
| Login, logout, token flow, identity | [`auth-provider.md`](references/auth-provider.md) |
| `useCan`, `CanAccess`, prefixed ACL resources | [`access-control-provider.md`](references/access-control-provider.md) |
| TypeScript types, deprecated migration | [`types-and-utilities.md`](references/types-and-utilities.md) |

## Production-ready defaults

Unless the user explicitly scopes down, every frontend deliverable must meet these. They are non-suggestion.

### Lists / tables

- Backend pagination by default. Default `pageSize` `10`; expose `10` / `20` / `50` / `100`.
- Server-side search, filter, sort — pushed into provider `filters` / `sorters`, never re-applied to fetched rows in React.
- Visible search input + relevant filter controls (status, department, date range) — debounce search 300–500ms.
- One primary search control per page (don't duplicate `DataGrid` quick filter with a separate page search on the same fields).
- MUI `DataGrid` → use `useDataGrid`. Hand-wiring `useList` + component state is a documented exception, not a default.

### Dashboards / KPIs / charts

- **Default**: datatable `aggregate` + `groupBy` via `useList` with `meta.aggregate: ["count"]` (note the array — `aggregate: "count"` fails silently). For cross-table needs, the data provider supports `populate` and aggregation together — try that first; aggregating over populated FK fields usually does the job.
- **Analytics queries are the exception, not the default.** Reach for `appDataProvider` + `useCustom({ meta: { kind: "analytics" } })` only when (a) the source is an **external database** or (b) the SQL genuinely cannot be expressed via the data provider — multi-table joins with grouped aggregation, window functions, recursive CTEs, etc. Registering a query is a separate backend round-trip (`taruvi-app-developer`); avoid it for anything a single `useList` with `meta.aggregate` + `meta.populate` can do.
- Never fetch full row sets into React to derive summary metrics.
- Graph queries must set an explicit `depth`.
- `having` only works after `groupBy`. Use `filters` for pre-aggregation filtering.

### Network-backed dropdowns

- `Autocomplete` (or equivalent typeahead), not static `Select`.
- Paginated backend queries (default option `pageSize` `10`), debounced search pushed into provider filters. No client-side filtering over a one-shot load.

### File uploads / attachments

- Multi-file UX by default. Report per-file success/failure — never an all-or-nothing aggregate.
- Chunk batch uploads to ≤10 files / ≤100MB; chunk batch deletes to ≤100 paths.
- Quota is advisory — surface as a warning, not an upload blocker.
- Warn on overwrite — upload silently replaces existing paths.
- Set `visibility` at bucket level; per-object override wins over bucket default.

### Bulk actions

- Backend bulk ops (`updateMany`, `deleteMany`) for single-resource; serverless function for multi-resource cascades.
- Show selection scope clearly (selected rows vs filtered set), surface partial-failure details, invalidate affected queries.

### Notifications

Use the wired Refine `notificationProvider` (`useNotification`). Don't add a parallel toast/snackbar system.

## Contract rules (mandatory)

### Function execution

```typescript
useCustom({
  url: "<function-slug>",
  method: "post",
  dataProviderName: "app",
  payload: { /* inputs */ },
  meta: { kind: "function" },
});
```

`payload` carries inputs — not `values`, not `config.payload`.

### Analytics execution

Same shape with `meta: { kind: "analytics" }`.

### Access control

- `useCan` / `CanAccess` resources use **prefixed ACL strings** — `datatable:employees`, `function:employee-terminate`, `query:hrms-dashboard-summary`. Never `params.entityType`, never a bare resource name.
- Map UI actions to canonical Cerbos actions before checking: `list` / `show` → `read`, `edit` → `update`, `create` → `create`, `delete` → `delete`, `execute` for functions/queries.
- Verify the runtime payload — `/check/resources`'s `resource.kind` must exactly match the requested `resource` string.
- Don't debounce or throttle `useCan` manually — `accessControlProvider` already batches via DataLoader.

### Client setup

```tsx
const client = new Client({
  apiKey: import.meta.env.VITE_TARUVI_API_KEY,
  appSlug: import.meta.env.VITE_TARUVI_APP_SLUG,
  apiUrl: import.meta.env.VITE_TARUVI_API_URL,
});

<Refine
  dataProvider={{
    default: dataProvider(client),
    storage: storageDataProvider(client),
    app: appDataProvider(client),
    user: userDataProvider(client),
  }}
  notificationProvider={useNotificationProvider}
  authProvider={authProvider(client)}
  accessControlProvider={accessControlProvider(client)}
/>
```

Env vars use the framework's browser-exposing prefix (`VITE_*`, `REACT_APP_*`, `NEXT_PUBLIC_*`). Never hardcoded.

## Gotchas worth surfacing here

The non-obvious ones. Per-domain pitfalls live in the references.

- **401 vs 403** — 401 = expired session (re-login). 403 = forbidden (show denied). Treating 403 as 401 causes infinite re-login loops.
- **`_cachedUser` after role change** — identity is cached module-locally and only clears on `logout()`. After admin role changes, force re-login or invalidate `["identity"]` and `["access-control"]` query keys.
- **`useCustom` for async functions** — async returns a `task_id`, not a result. Either keep the function sync (<30s) or wire a polling pattern with a separate status-check function.
- **`dataProviderName` missing** — `useCustom` / `useCreate` without the right `dataProviderName` routes to `default`, returning confusing "resource not found" errors. Always set `"app"` for functions/analytics and `"storage"` for buckets.
- **Prefilled form fields** — set `InputLabelProps: { shrink: true }` on TextFields with default values so the label doesn't overlap.
- **`aggregate` must be an array** — `aggregate: "count"` silently fails. Use `aggregate: ["count"]`.
- **Client-side filtering on backend data** — fetching a page of rows and filtering in React is a correctness *and* scalability bug. Always push state into provider queries.
