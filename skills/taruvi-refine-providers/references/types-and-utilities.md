# TypeScript Types & Utilities

## Importing Types

```tsx
import type {
  // Meta & response types
  TaruviMeta,
  TaruviListResponse,

  // App provider meta types
  FunctionMeta,            // { kind: "function"; async?: boolean }
  AnalyticsMeta,           // { kind: "analytics" }
  AppCustomMeta,           // FunctionMeta | AnalyticsMeta

  // Storage types
  StorageUploadVariables,  // { files: File[]; paths?: string[]; metadatas?: Record<string, unknown>[] }

  // Auth types
  LoginParams,
  LogoutParams,
  RegisterParams,
} from "@taruvi/refine-providers";
```

## TaruviMeta — Full Shape

Extends Refine's `MetaQuery`. Used in the `meta` parameter of all data provider hooks.

```tsx
interface TaruviMeta extends MetaQuery {
  // Database
  populate?: string | string[];
  headers?: Record<string, string>;
  idColumnName?: string;
  select?: string | string[];
  tableName?: string;
  upsert?: boolean;
  deleteByFilter?: boolean;

  // Aggregation
  aggregate?: AggregateExpression[];
  groupBy?: string[];
  having?: CrudFilter[];

  // Graph
  format?: "tree" | "graph";
  include?: "descendants" | "ancestors" | "both";
  depth?: number;
  graph_types?: string[];

  // Storage
  bucketName?: string;
}
```

## Utility Functions

Exported for building custom providers or advanced use cases:

```tsx
import {
  REFINE_OPERATOR_MAP,      // Record<string, string> — Refine operator → DRF suffix
  convertRefineFilters,     // (filters?: CrudFilter[]) => Record<string, string>
  convertRefineSorters,     // (sorters?: CrudSort[]) => string | undefined
  convertRefinePagination,  // (pagination?: Pagination) => { page?: number; page_size?: number }
  buildRefineQueryParams,   // (options) => Record<string, unknown>
  buildQueryString,         // (params?) => string (e.g. "?page=1&page_size=10")
  handleError,              // (error: unknown) => never
  formatAggregates,         // (aggregates?: string[]) => string | undefined
  formatGroupBy,            // (groupBy?: string[]) => string | undefined
  formatHaving,             // (having?: CrudFilter[]) => string | undefined
} from "@taruvi/refine-providers";
```

## Deprecated Providers

`functionsDataProvider` and `analyticsDataProvider` are removed. Use `appDataProvider` with `useCustom` instead.

```tsx
// ❌ Old (deprecated)
import { functionsDataProvider, analyticsDataProvider } from "@taruvi/refine-providers";
<Refine dataProvider={{ functions: functionsDataProvider(client) }} />
const { mutate } = useCreate();
mutate({ dataProviderName: "functions", resource: "my-func", values: { ... } });

// ✅ New
import { appDataProvider } from "@taruvi/refine-providers";
<Refine dataProvider={{ app: appDataProvider(client) }} />
useCustom({
  dataProviderName: "app",
  url: "my-func",
  method: "post",
  payload: { ... },
  meta: { kind: "function" },
});
```
