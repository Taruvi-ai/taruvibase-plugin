# App Data Provider

App-level configuration, edge function execution, and analytics queries — all through a single `"app"` provider.

## Setup

```tsx
<Refine
  dataProvider={{
    default: dataProvider(client),
    app: appDataProvider(client),
  }}
/>
```

## Fetch Roles

```tsx
const { result } = useList({ resource: "roles", dataProviderName: "app" });
// result.data → [{ id, name, permissions, ... }]
```

## Fetch Settings

```tsx
const { result } = useOne({ resource: "settings", dataProviderName: "app", id: "" });
// result.data → { ...app settings object }
```

## Fetch Secrets

```tsx
// Single secret by key
const { result } = useOne({
  resource: "secrets",
  dataProviderName: "app",
  id: "STRIPE_KEY",
  meta: { app: "production", tags: ["payment"] }, // optional
});
// result.data → { key, value, tags, secret_type, ... }

// Batch get by keys
const { result } = useList({
  resource: "secrets",
  dataProviderName: "app",
  meta: {
    keys: ["API_KEY", "DATABASE_URL", "STRIPE_KEY"],
    app: "production",      // optional: app context for 2-tier inheritance
    includeMetadata: true,  // optional: include tags, secret_type
  },
});
// result.data → [{ key, value }, ...] or [{ key, value, tags, secret_type }, ...]
```

## Execute Edge Functions

Use `useCustom` with `meta.kind: "function"`. The `url` is the function slug.

```tsx
// Synchronous — wait for result
const { data, isLoading } = useCustom({
  dataProviderName: "app",
  url: "process-order",
  method: "post",
  payload: { orderId: 123, action: "confirm" },
  meta: { kind: "function" },
});

// Async — returns immediately with job ID
useCustom({
  dataProviderName: "app",
  url: "long-running-task",
  method: "post",
  payload: { taskId: 789 },
  meta: { kind: "function", async: true },
});
```

## Execute Analytics Queries

**Prefer the datatable provider first.** `useList` with `meta.aggregate` + `meta.groupBy` (and `meta.populate` for related fields) covers single-table metrics and most cross-table cases on Taruvi datatables. Reach for analytics queries only when (a) the source is an **external database** or (b) the SQL truly cannot be expressed via the data provider — multi-table joins with grouped aggregation, window functions, recursive CTEs.

When one of those applies, use `useCustom` with `meta.kind: "analytics"`. The `url` is the query slug.

```tsx
const { data } = useCustom({
  dataProviderName: "app",
  url: "monthly-sales-report",
  method: "post",
  payload: { start_date: "2024-01-01", end_date: "2024-12-31", region: "US" },
  meta: { kind: "analytics" },
});
```

**Dashboard example:**
```tsx
const { result: summaryResult } = useCustom({
  dataProviderName: "app",
  url: "hrms-dashboard-summary",
  method: "post",
  payload: {},
  meta: { kind: "analytics" },
});

const summary = summaryResult.data?.[0];
```

## Meta Types

```tsx
import type { FunctionMeta, AnalyticsMeta, AppCustomMeta } from "@taruvi/refine-providers";

// FunctionMeta:  { kind: "function"; async?: boolean }
// AnalyticsMeta: { kind: "analytics" }
// AppCustomMeta: FunctionMeta | AnalyticsMeta
```
