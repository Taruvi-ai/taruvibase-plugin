# Backend query capabilities

What the Taruvi data service supports for datatables, storage, and users. Source of truth: <https://test-docs.taruvi.cloud/docs/data-service/guides/querying> (and `aggregations`, `graph-traversal` siblings). Reflects May 2026 surface.

REST URL convention: `?field__operator=value` (double-underscore separates path segments and operator). Field paths can traverse relations with `.` (see below).

## Filter operators

### Comparison
| Op | Meaning |
|---|---|
| (none) / `eq` | Equals — `?status=active` or `?status__eq=active` |
| `ne` | Not equals |
| `gt` / `gte` / `lt` / `lte` | Comparisons |

### String matching
**Defaults are case-sensitive.** Prefix with `i` for case-insensitive; `s` suffix is an explicit case-sensitive alias.

| Op | Meaning |
|---|---|
| `contains` / `ncontains` | Contains (case-sensitive) |
| `icontains` / `nicontains` | Contains (case-insensitive) |
| `containss` / `ncontainss` | Contains (case-sensitive — explicit alias) |
| `startswith` / `nstartswith` / `istartswith` / `nistartswith` / `startswiths` | Same pattern |
| `endswith` / `nendswith` / `iendswith` / `niendswith` / `endswiths` | Same pattern |

### Set / range / null
| Op | Meaning |
|---|---|
| `in` / `nin` | Value in / not in list — `status__in=active,pending` |
| `between` / `nbetween` | `price__between=10,100` |
| `null` / `nnull` | `bio__null=true` |

### Full-text search
- `?search=<query>` — only works if the table declares `search_fields` in its schema (that's what synthesizes `search_vector`). Without it, the call silently returns nothing. See [`datatable-schema-patterns.md`](datatable-schema-patterns.md#search-search_fields).
- Modifiers: phrase with quotes (`?search="rest api"`), exclude with `-` (`?search=guide -archived`), boolean OR (`?search=tutorial OR guide`). Multi-word queries are ANDed by default.
- Response rows include a `rank` relevance score.

### Array (PostgreSQL array columns)
| Op | Maps to |
|---|---|
| `acontains` / `nacontains` | `@>` (contains all) |
| `acontainedby` / `nacontainedby` | `<@` |
| `aoverlap` / `naoverlap` | `&&` |
| `aelement` / `naelement` | `= ANY()` |

## Filtering on related fields (dot notation)

Traverse foreign-key or reverse relationships with `.` in the field path. The related row is **not** included in the response unless you also pass `populate=` for the same path.

| Direction | Example |
|---|---|
| Forward FK (many-to-one) | `?deal_id.name__contains=Acme` |
| Multi-hop forward | `?deal_id.company_id.name__startswith=Acme` (max 3 hops) |
| Reverse FK (one-to-many) | `?activities.subject__contains=follow-up` — parent appears once if ≥1 child matches |
| Many-to-many | `?roles.name__contains=admin` — junction table traversed automatically |

Multiple filters on the same FK path share one JOIN and are ANDed.

Limits (defaults, env-configurable): max **3 hops** per chain, max **5 distinct traversal paths** per request. Aggregations and traversal filters cannot be combined.

## Sorting

- `?_sort=field&_order=asc|desc` — single field.
- `?_sort=field1,field2&_order=asc,desc` — multiple fields.
- Dot notation works: `?_sort=deal_id.name&_order=desc`. Sort-only traversal uses `LEFT JOIN` (NULL FKs preserved); if a filter shares the path, the join is shared and promoted to `INNER JOIN`.
- Same 3-hop / `belongsTo`-only limits as filter traversal.

## Pagination

- `?page=N&page_size=M` (page is 1-indexed). REST also accepts `_start` / `_end`.
- Response includes `total` and `pagination.{current_page,total_pages,has_next,has_previous}`.

## Populate (FK expansion)

- `?populate=author,category` — expand FK fields inline.
- `?populate=author.company` — dotted path, max 3 hops.
- `?populate=*` — expand all one-hop FKs.

## Aggregation

REST params: `_aggregate`, `_group_by`, `_having`. Available through the Refine data provider's `meta` and the Python SDK; generally **not** via the MCP record-query tool (use an analytics query for MCP-side aggregation — or raw SQL if the server offers it).

Supported functions: `count(*)`, `count(field)`, `count(distinct field)`, `sum`, `avg`, `min`, `max`, `array_agg`, `string_agg`, `json_agg`, `stddev`, `variance`.

Syntax features:

- Multiple aggregates: `_aggregate=sum(price),count(*),avg(price)`.
- Aliases: `_aggregate=sum(total) as revenue`. Custom alias becomes the response field name.
- Group by SQL expressions: `_group_by=date_trunc('day', created_at)`; timezone: `date_trunc('day', created_at AT TIME ZONE 'America/New_York')`.
- `_having` operators: `__gt`, `__gte`, `__lt`, `__lte`, `__eq`, `__ne`. Comma-separated for multiple conditions: `_having=count__gte=10,sum_total__gte=5000`. References use the **response field name** (`sum_total`, not `sum(total)`).

Response shape:

- **Without GROUP BY**: `{ "data": [...], "aggregates": { "count": N, "sum_price": ..., "avg_rating": ... } }`.
- **With GROUP BY**: each row in `data` includes the group fields plus aggregate columns (`{category, sum_price, count, avg_price}`).
- Default field naming: `<function>_<field>` (`sum(price)` → `sum_price`); `count(*)` → `count`; aliased aggregates use the alias.

Compatible with `filter`, `sort`, `populate`, pagination. Not yet supported: window functions, nested aggregations, traversal filters alongside aggregates.

## Graph / hierarchy traversal

Query params:

- `format=tree` (nested children) or `format=graph` (separate `nodes` + `edges` arrays).
- `include=descendants` (incoming edges) | `ancestors` (outgoing) | `both`.
- `depth=<int>` — server max `DATA_SERVICE_GRAPH_MAX_DEPTH=10`. Recommend ≤10 for small orgs, ≤7 medium, ≤5 large.
- `relationship_type=<name>` — filter by edge type (single or comma-separated).

Response rows carry `_depth` and `_relationship_type` from the traversal.

Edge CRUD (REST):
```
GET    /api/apps/{slug}/datatables/{table}/edges/
POST   /api/apps/{slug}/datatables/{table}/edges/
PATCH  /api/apps/{slug}/datatables/{table}/edges/{edge_id}/
DELETE /api/apps/{slug}/datatables/{table}/edges/
```

Edge row: `{id, from_id, to_id, type, metadata, created_at}`. Edge tables are created automatically as `<table>_edges` when the schema declares `hierarchy.enabled: true` or `graph.enabled: true`.

Hierarchy mode (`hierarchy.enabled`) is a single implicit `parent` type; graph mode (`graph.enabled`) supports multiple typed edges and DAGs. See [`datatable-schema-patterns.md`](datatable-schema-patterns.md) for declaration.

## Provider modes

Datatables run on either the `flat_table` provider (default, fully supported) or the `jsonb` provider. Traversal filters are **rejected on the jsonb provider** with a clear error.

## Datatable write features

- **Upsert**: `meta.upsert: true` on create.
- **Delete by filter**: `meta.deleteByFilter: true` on `useDeleteMany` (Refine) or `action="delete"` with `filters` (MCP).
- **Zero-downtime column rename**: `x-rename-from` in the schema (see [`datatable-schema-patterns.md`](datatable-schema-patterns.md)).

## Storage object filters

| Filter | Example |
|---|---|
| `size__gte`, `size__lte` | `?size__gte=1048576` |
| `created_at__gte`, `created_at__lte` | Date range |
| `search` | Searches filename + path (case-insensitive) |
| `prefix` | Bucket-relative path prefix (`users/123/`) |
| `mimetype`, `mimetype__in` | `?mimetype__in=image/png,image/jpeg` |
| `mimetype_category` | `?mimetype_category=image` (matches `image/*`) |
| `visibility` | `public` / `private` |
| `created_by_me`, `modified_by_me` | Files by the authenticated user |
| `metadata_search` | Search inside metadata JSON |

### Bucket configuration

| Field | Required | Default | MCP bucket create |
|---|---|---|---|
| `name` | Yes | — | ✅ |
| `app_category` | Yes | `assets` or `attachments` | ✅ |
| `visibility` | No | `private` | ✅ |
| `max_size_bytes` | No | Advisory quota | ✅ |
| `file_size_limit` | No | 50MB | ❌ REST only |
| `allowed_mime_types` | No | Empty = all | ❌ REST only |
| `max_objects` | No | Advisory quota | ❌ REST only |

### Upload behavior & batch limits

- Uploading to an existing path **replaces silently** (upsert).
- `allowed_mime_types` rejections return a generic 400 with no MIME-type detail.
- Batch upload: ≤10 files, ≤100MB per call, no partial success.
- Batch delete: ≤100 paths per call, supports partial success.
- Quotas are advisory — the API does not block uploads when exceeded.

## User list filters

| Filter | Meaning |
|---|---|
| `search` | username, email, first_name, last_name (case-insensitive) |
| `is_active` / `is_staff` / `is_superuser` / `is_deleted` | Status flags |
| `roles` | Comma-separated role slugs |

Sorting: single field, Django-style (`ordering=-date_joined`).

Role assignments: separate from user CRUD (dedicated assign/revoke operations), max 100 roles × 100 usernames per call, supports `expires_at`.

User attributes: tenant-wide JSONB validated against a JSON Schema (admin-controlled). User preferences: per-user key-value (user-controlled).
