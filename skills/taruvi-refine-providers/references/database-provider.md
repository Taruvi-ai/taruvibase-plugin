# Database Data Provider

The primary provider for CRUD operations on Taruvi datatables. Maps Refine hooks to the Taruvi data service surface — see <https://test-docs.taruvi.cloud/docs/data-service/guides/querying> for the underlying REST contract.

## Setup

```tsx
<Refine dataProvider={dataProvider(client)} resources={[{ name: "posts" }]} />
```

## Return values

Queries return `{ result, query }`; mutations return `{ mutate, mutation }`.

```tsx
const { result, query } = useList({ resource: "posts" });
result.data;        // TData[]
result.total;       // number — total count
query.isLoading;    // boolean
query.refetch;      // () => void
```

## CRUD

```tsx
useList({ resource: "posts" });
useOne({ resource: "posts", id: 1 });
useMany({ resource: "posts", ids: [1, 2, 3] });
useCreate().mutate({ resource: "posts", values: { title: "Hello" } });
useUpdate().mutate({ resource: "posts", id: 1, values: { title: "Updated" } });
useDelete().mutate({ resource: "posts", id: 1 });
```

## Filtering

```tsx
useList({
  resource: "posts",
  filters: [
    { field: "status", operator: "eq", value: "published" },
    { field: "views", operator: "gte", value: 100 },
    { field: "title", operator: "contains", value: "tutorial" },   // case-sensitive
    { field: "title", operator: "containss", value: "Tutorial" },  // alias
    { field: "category", operator: "in", value: ["tech", "news"] },
  ],
});
```

### Operator reference

**Defaults are case-sensitive.** Prefix with `i` for case-insensitive; the `*s` suffix is an explicit case-sensitive alias.

| Operator | Description |
|---|---|
| `eq` / `ne` | Equal / not equal |
| `lt` / `gt` / `lte` / `gte` | Comparison |
| `contains` / `ncontains` | Contains (case-sensitive) |
| `containss` / `ncontainss` | Contains (case-sensitive — alias) |
| `icontains` / `nicontains` | Contains (case-insensitive) |
| `startswith` / `nstartswith` / `startswiths` / `nstartswiths` | Starts with (case-sensitive) |
| `istartswith` / `nistartswith` | Starts with (case-insensitive) |
| `endswith` / `nendswith` / `endswiths` / `nendswiths` | Ends with (case-sensitive) |
| `iendswith` / `niendswith` | Ends with (case-insensitive) |
| `in` / `nin` | In / not in array |
| `null` / `nnull` | Is null / is not null |
| `between` / `nbetween` | Between / not between two values |

### Filtering on related fields (dot notation)

Use `.` in the `field` path to filter through a foreign key, reverse relationship, or many-to-many. The related row is **not** added to the response unless you also `populate` the same path.

```tsx
useList({
  resource: "deals",
  filters: [
    { field: "company_id.name", operator: "contains", value: "Acme" },         // forward FK
    { field: "owner_id.team_id.name", operator: "eq", value: "sales" },        // multi-hop (max 3)
    { field: "activities.subject", operator: "contains", value: "follow-up" }, // reverse FK — at least one match
    { field: "tags.name", operator: "in", value: ["urgent", "vip"] },          // many-to-many — junction handled
  ],
  meta: { populate: ["company_id"] },   // include company row in payload
});
```

Defaults: max **3 hops** per chain, max **5 distinct traversal paths** per request. Aggregations and traversal filters cannot be combined. Filters on the same FK path share one JOIN and are ANDed.

### Array operators

```tsx
filters: [
  { field: "tags", operator: "acontains", value: ["urgent"] },        // array contains
  { field: "tags", operator: "aoverlap", value: ["urgent", "vip"] },  // arrays overlap
];
```

Array operators: `acontains` / `nacontains` (`@>`), `acontainedby` / `nacontainedby` (`<@`), `aoverlap` / `naoverlap` (`&&`), `aelement` / `naelement` (`= ANY()`).

### Full-text search

`useList({ resource: "posts", filters: [{ field: "search", operator: "eq", value: "rest api" }] })`. Only works if the table declares `search_fields` in its schema — without it the call silently returns nothing. Quote phrases (`"rest api"`), exclude with `-` (`guide -archived`), boolean OR (`tutorial OR guide`). Response rows include a `rank` score.

## Sorting and pagination

```tsx
useList({
  resource: "posts",
  sorters: [
    { field: "created_at", order: "desc" },
    { field: "author_id.name", order: "asc" },   // dot notation — sort by related field
  ],
  pagination: { currentPage: 1, pageSize: 20 },
});
```

Sort-only traversal uses `LEFT JOIN` (NULL FKs preserved). 3-hop max, `belongsTo` only.

## Meta options (`TaruviMeta`)

```tsx
useList({
  resource: "posts",
  meta: {
    tableName: "blog_posts",            // override DB table
    populate: ["author", "category"],   // FK expansion ("*" for all one-hop)
    select: ["id", "title", "status"],
    idColumnName: "post_id",            // custom PK
    upsert: true,                       // on create
    deleteByFilter: true,               // on useDeleteMany
  },
});
```

`populate` supports dotted paths (`author.company`) up to 3 hops.

| Option | Type | Default | Description |
|---|---|---|---|
| `tableName` | `string` | resource name | Override DB table name |
| `populate` | `string \| string[]` | — | FK fields to populate. `"*"` for all one-hop |
| `select` | `string \| string[]` | — | Fields to return |
| `idColumnName` | `string` | `"id"` | Custom primary key column |
| `headers` | `Record<string, string>` | — | Custom request headers |
| `upsert` | `boolean` | `false` | Upsert on create |
| `deleteByFilter` | `boolean` | `false` | Delete by filter instead of IDs |

## Aggregations

```tsx
useList({
  resource: "orders",
  meta: {
    aggregate: ["sum(total) as revenue", "count(*)", "avg(quantity)"],
    groupBy: ["status", "date_trunc('month', created_at)"],
    having: [{ field: "count", operator: "gt", value: 10 }],
  },
});
// → [{ status, sum_month, revenue, count, avg_quantity }, ...]
```

Functions: `count(*)`, `count(field)`, `count(distinct field)`, `sum`, `avg`, `min`, `max`, `array_agg`, `string_agg`, `json_agg`, `stddev`, `variance`.

Response field naming: `<function>_<field>` (`sum(price)` → `sum_price`), `count(*)` → `count`, custom aliases (`sum(total) as revenue`) → alias name.

**Without `groupBy`**, the response is `{ data: [], aggregates: { count, sum_total, ... } }` — read `result.data.aggregates` (or however the provider surfaces it; verify in network logs).

`having` references the **response field name** (`count`, `sum_total`), not the raw function (`sum(total)`).

Restrictions: no nested aggregations, no window functions, no traversal filters in the same query. `aggregate` must be an array — `aggregate: "count"` fails silently.

## Graph / hierarchy operations

The provider switches to graph mode when any of `format`, `include`, `depth`, or `graph_types` is set in `meta`.

```tsx
useOne({
  resource: "employees",
  id: "1",
  meta: {
    format: "tree",              // "tree" or "graph"
    include: "descendants",      // "descendants" | "ancestors" | "both"
    depth: 3,                    // ≤ server max (default 10)
    graph_types: ["manager"],
  },
});

// Create edge
useCreate().mutate({
  resource: "employees",
  values: { from_id: 1, to_id: 2, type: "manager", metadata: { since: "2024-01-01" } },
  meta: { format: "graph" },
});

// Delete edge
useDelete().mutate({ resource: "employees", id: "edge-123", meta: { format: "graph" } });
```

Each traversed row carries `_depth` (distance from root) and `_relationship_type` (edge label).

| Meta key | Type | Description |
|---|---|---|
| `format` | `"tree" \| "graph"` | Output shape — nested tree vs. `{nodes, edges}` |
| `include` | `"descendants" \| "ancestors" \| "both"` | Traversal direction |
| `depth` | `number` | Max levels (server cap ~10) |
| `graph_types` | `string[]` | Filter edges by type |
