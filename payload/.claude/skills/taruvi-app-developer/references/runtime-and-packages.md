# Runtime and Packages

## Mandatory Runtime Split

| Runtime | Use | Packages |
|---|---|---|
| Frontend (React + Refine) | UI, CRUD hooks, auth/access control in browser | `@taruvi/sdk`, `@taruvi/refine-providers`, `@refinedev/core` |
| Python (functions/services/scripts) | Backend orchestration, multi-resource operations | Taruvi Python SDK |

## Non-Negotiables

- Never use Python SDK in browser code.
- Never use frontend providers as a substitute for backend orchestration.
- Never answer Taruvi-specific behavior from memory only; read the relevant module references first.
- Never invent endpoints or method names.

## Query Strategy for Dashboards

- **Default**: datatable provider with `aggregate` / `groupBy` (single table) plus `populate` for FK expansion. Cross-table needs on Taruvi datatables usually fit this — try it before reaching for a separate query.
- **Analytics queries are the exception**, not the default. Use them only for an **external database** source or for SQL the data provider can't express (multi-table joins with grouped aggregation, window functions, recursive CTEs). Registering a query is a separate backend round-trip — avoid it for anything a single `useList` with `meta.aggregate` + `meta.populate` can do.
- Never fetch full row sets into React to derive summary metrics.
