# Datatable schema patterns (Frictionless + Taruvi extensions)

> MCP compatibility: legacy action-based tool examples below apply only to the
> tenant API-key MCP. For OAuth Worker calls, first read the [current tool guide](mcp-tool-quickref.md)
> and use discovered input schemas. Runtime SDK examples remain separate.

The full shape of the `datapackage` argument to `create_update_schema`. Taruvi follows [Frictionless Data Package](https://specs.frictionlessdata.io/data-package/) plus Taruvi-specific extensions.

Source of truth: <https://test-docs.taruvi.cloud/docs/data-service/> — `guides/migrations`, `/hierarchy`, `/graph-traversal`, `/relationships`, `/imports`.

## Envelope

```json
{ "name": "...", "title": "...", "description": "...", "resources": [ ... ] }
```

Only `resources` is required; the rest is Frictionless metadata.

## Resource

| Key | Default | Notes |
|---|---|---|
| `name` | derived from `schema.name`/`title` | Physical name = `{app_slug}_{name}`, max 57 bytes (reserves `_edges` suffix). Hyphens/whitespace → `_`; digit-leading names get `t_` prefix. |
| `title`, `description` | — | Metadata. |
| `schema` | required | See below |
| `schema_format` | `frictionless` | Also `native`, `sql` |
| `provider_type` | `flat_table` | Also `jsonb`, `mongodb`. M2M junctions must be `flat_table`. |
| `provider_config` | `{}` | Provider-specific settings |
| `hierarchy` | `false` | Promoted into `schema.hierarchy` |
| `search_fields` | `[]` | Promoted into `schema.search_fields` |
| `audit_enabled` | `false` | Toggles the central audit log for this table's writes |
| `assigned_to` | `null` | Optional user FK from `BaseModel` |

## Minimal schema

```json
{
  "resources": [{
    "name": "orders",
    "schema": {
      "fields": [
        {"name": "id", "type": "string", "format": "uuid", "constraints": {"required": true}},
        {"name": "title", "type": "string", "constraints": {"maxLength": 255}},
        {"name": "created_at", "type": "datetime"}
      ],
      "primaryKey": ["id"]
    }
  }]
}
```

**Prefer UUID IDs.** Single-column PKs are auto-normalized to `string/uuid` with `gen_random_uuid()` server default. Composite PKs are exempt. **Integer PKs auto-add `autoincrement: true`** (preserved on already-materialized tables for backward compat). FK fields are auto-normalized to UUID when their target has a UUID PK.

One call can create or update many tables.

## Field types

| `type` | Postgres | Notes |
|---|---|---|
| `string` | `TEXT` | `constraints.maxLength` for varchar-like bound |
| `integer` | `INTEGER` | |
| `number` | `NUMERIC` | |
| `boolean` | `BOOLEAN` | |
| `date` | `DATE` | ISO 8601 |
| `datetime` | `TIMESTAMP WITH TIME ZONE` | ISO 8601 |
| `time` | `TIME` | |
| `object` | `JSONB` | JSON object |
| `array` | `JSONB` | JSON array; use `arrayItem` to declare element type |
| `any` | `JSONB` (default) | Promote to native PG type via `x-pg-type` |

**Range/multirange columns** — `type: "any"` + `x-pg-type`. Values: `int4range`, `int8range`, `numrange`, `daterange`, `tsrange`, `tstzrange`, plus the `*multirange` variants. Query with `__rcontains`, `__roverlaps`, `__rstrictleft`, etc.

```json
{"name": "booking_window", "type": "any", "x-pg-type": "tstzrange"}
```

**Typed array elements** —

```json
{"name": "tag_ids", "type": "array", "arrayItem": {"type": "string", "format": "uuid"}}
```

## Field options

| Key | Purpose |
|---|---|
| `format` | Frictionless hint: `uuid`, `email`, `uri`, `date`, `datetime` |
| `title`, `description`, `rdfType` | Schema metadata, round-tripped, not enforced |
| `comment` | Postgres column comment (`COMMENT ON COLUMN ...`) — distinct from `description` which stays in the JSON schema only |
| `default` | Insert-time default; required when adding a NOT NULL column to a populated table |
| `constraints` | See below |
| `arrayItem` | Element type for `array` fields |
| `x-pg-type` | Native PG type for `type: "any"` |
| `x-rename-from` | Column rename hint — see Schema evolution |
| `x-index` | **JSONB provider only.** Per-field index hint: `"btree"` or `"gin"`. Creates an index on the JSONB extraction expression (`(data->>'field')` for btree, `(data)` for gin). Ignored by `flat_table`. |

**Internal markers** (set by the server, do not write yourself): `x-search-metadata`, `x-search-field`, `x-auto-generated`, `x-edge-table`, `x-system-table`, `x-read-only`, `x-reference-table`, `x-source-app`, `x-source-table`, `x-reflected`, `x-reflected-at`, `_hierarchy_mode`, `_hierarchy_sugar`.

## Constraints

| Key | Effect |
|---|---|
| `required` | `NOT NULL` |
| `unique` | `UNIQUE` index |
| `minLength` / `maxLength` | `CHECK (length(field) >=/<= N)` |
| `minimum` / `maximum` | `CHECK` |
| `pattern` | `CHECK` against regex |
| `enum` | `CHECK IN (...)` |

## Foreign keys

```json
"foreignKeys": [{
  "fields": ["order_id"],
  "reference": {"resource": "orders", "fields": ["id"]},
  "x-actions": {"onDelete": "CASCADE"}
}]
```

FK targets must already exist or appear earlier in the same datapackage. **Cross-app reference**: `"reference": {"resource": "other_app:table_name", "fields": ["id"]}`. **System targets**: `auth_user`, `storage_objects` (bucket file metadata).

Reverse relationships, one-to-many, and many-to-many are inferred from FKs at query time. Junction tables for M2M are just regular tables with two FKs.

### `x-actions.onDelete`

| Value | Behavior |
|---|---|
| `NO ACTION` | Default; check at end of transaction |
| `RESTRICT` | Block delete if references exist |
| `CASCADE` | Delete referencing rows |
| `SET NULL` | Set FK to NULL (field must be nullable) |
| `SET DEFAULT` | Set FK to its default (field must define a default) |

## Reverse relationships & many-to-many

Both are inferred from declared FKs at query time — just declare your foreign keys (and a junction table with two FKs for M2M) and the data service exposes reverse and M2M paths automatically. No `reverseRelationships` or `manyToManyRelationships` block to write.

Reverse names follow PostgREST convention (the child table name; e.g. `"employees"` on `departments`). When two FKs from the same child point at the same parent, the auto-generated name is disambiguated with `!fk_column` (`"employees!secondary_dept_id"`).

## Indexes

Only the primary key is auto-indexed. Add explicit entries for filter/sort/FK columns.

```json
"indexes": [
  {"name": "idx_created", "fields": ["created_at"]},
  {"name": "idx_metadata", "fields": ["metadata"], "type": "gin"},
  {"name": "idx_email_lower", "expression": "LOWER(email)", "unique": true},
  {"name": "idx_active_only", "fields": ["created_at"], "where": "is_active = true"},
  {"name": "idx_tags_ops", "fields": ["tags"], "type": "gin", "using": "gin__int_ops"}
]
```

| Key | Notes |
|---|---|
| `name` | required; auto-prefixed with physical table name |
| `fields` (alias `columns`) | mutually exclusive with `expression` |
| `expression` | expression-based index |
| `type` (alias `method`) | `btree` (default), `hash`, `gin`, `gist`, `brin` |
| `unique` | bool |
| `where` | partial-index condition |
| `using` | operator class (e.g. `gin__int_ops`, `gin__jsonb_ops`) — applies to GIN only |
| `comment` | Postgres `COMMENT ON INDEX` |

## Search (`search_fields`)

Declare which fields participate in `?search=<query>`. **The search API silently returns nothing if `search_fields` isn't declared** — no `search_fields`, no `search_vector` column synthesized, no full-text matches. Always add this block to tables that need search.

```json
"search_fields": [
  {"field": "title", "weight": "A"},
  {"field": "description", "weight": "B"}
]
```

- Plain strings auto-assigned `A`,`B`,`C`,`D` in declaration order; explicit `weight` overrides.
- **Max 10 fields, string fields only, no duplicates.**
- Synthesizes a `search_vector` `TSVECTOR` `GENERATED ALWAYS AS ... STORED` column with a GIN index. **Do not declare `search_vector` yourself.**
- `search_language` / `search_config` (default `"english"`) — any Postgres FTS config (spanish, french, german, etc.).

```json
{"search_language": "spanish", "search_config": "spanish",
 "search_fields": ["titulo", {"field": "cuerpo", "weight": "B"}]}
```

Query: `?search=project roadmap` or programmatically `{"search_vector__search": "project roadmap"}`.

## Hierarchy & graph

Both store edges in an auto-generated `<table>_edges` companion table (also exposed as its own DataTable). Columns: `id` (UUID), `from_id`/`to_id` (FK → parent, `ON DELETE CASCADE`), `type` (`VARCHAR(50)`), `metadata` (JSONB), `created_at`/`updated_at` (auto-managed on edges only), `created_by_id`. Constraints: `UNIQUE(from_id, to_id, type)`, `CHECK(from_id != to_id)`. Indexes on `(from_id, type)`, `(to_id, type)`, `type`, GIN on `metadata`.

```json
{
  "name": "employees",
  "schema": {
    "fields": [...],
    "primaryKey": ["id"],
    "hierarchy": true,
    "graph": {
      "enabled": true,
      "types": [
        {"name": "manager", "inverse": "reports", "constraints": {"max_outgoing": 1}},
        {"name": "mentor", "metadata": {"fields": [{"name": "since", "type": "date"}]}}
      ]
    }
  }
}
```

- `hierarchy: true` — enables `include=descendants|ancestors` + `depth` queries.
- `graph.enabled: true` — typed edges via the companion table.
- `graph.types[].inverse` — documentation only; traversal still uses `include=ancestors|descendants` + `relationship_type`.
- `graph.types[].metadata.fields` — typed fields stored on edges, queryable via the edges datatable.
- `graph.types[].constraints.max_outgoing` / `max_incoming` — cap edges per node (e.g. `max_outgoing: 1` for tree shape).

Pure tree: `hierarchy: true` alone is enough. DAG with multiple typed relationships: add `graph`. Traversal depth capped at 10 (`DATA_SERVICE_GRAPH_MAX_DEPTH`).

## Audit logging

Toggle via `audit_enabled: true` on the resource envelope (not in `schema`). Default `false`. When on, every CRUD mutation (incl. bulk) writes async to a single per-tenant `audit_log` table with `record_id`, `version` (monotonic per record), `event_type` (CREATE/UPDATE/DELETE), `previous_data`, `changed_fields`, `created_by`, `created_at`.

No per-table `<table>_audit`, no row ETag / optimistic concurrency, no CDC / change feed / webhooks.

## Schema evolution

Resubmitting via `create_update_schema` (or `PATCH`) triggers a migration. Changes are classified:

| Safe | Destructive |
|---|---|
| Add nullable column | Add NOT NULL column without a default |
| Add column with `default` | Narrow a column type (TEXT → VARCHAR(10)) |
| Drop column | Incompatible type cast (TEXT → INTEGER) |
| Make column nullable | Remove a NOT NULL constraint |
| Widen a column type | |
| Add foreign key, index | |
| Rename column with `x-rename-from` | |

**Destructive changes are rejected via MCP.** `create_update_schema` does not expose an `allow_data_loss` opt-in — to force one through you have to call the REST `PATCH` directly with `allow_data_loss=true`. Prefer reworking the schema (add a default, widen instead of narrowing, two-step migrate) over forcing it.

### Column rename

```json
{"name": "email_address", "type": "string", "x-rename-from": "email"}
```

Without the hint, the materializer treats it as drop + add and loses data.

### Adding a NOT NULL column to a populated table

Either supply a `default` (single safe step) or run the three-step pattern: add nullable → populate via `datatable_data` upsert / raw SQL → resubmit with `required: true`.

### Revision history & rollback

Every schema operation is recorded with a `revision_id`, the SQL that was executed, an auto-generated inverse SQL, the actor, and outcome telemetry. Rollback is service-level only — execute from a management command, shell, or internal job. DDL statements have a server-side timeout of ~30s — split large refactors into smaller steps.

Rollback caveats: dropped column data is not recoverable; an already-rolled-back operation cannot be rolled back again; type conversions whose backward cast would fail are not rollable.

### Imports

Imports use the same Frictionless data package shape. `create_update_schema` always materializes the physical tables — the MCP tool exposes no `dry_run`, `validate_only`, `force_recreate`, or `allow_data_loss`.

## Conventions

- **Soft delete is a consumer convention.** Declare `is_deleted` and filter on it yourself — `delete` does not soft-update.
- **`created_at`/`updated_at` are NOT auto-populated** on main tables (only on edges). Declare and set them yourself.
- **System FK targets:** `auth_user`, `storage_objects`.
- **PK normalization:** single-column UUID PKs get `gen_random_uuid()` default; single-column integer PKs get `autoincrement: true`; FK fields auto-normalize to UUID when their target is UUID. Composite PKs are exempt.
- **Cerbos auto-policy:** new tables get a default-DENY + scoped-ALLOW policy (skipped for `x-system-table`); removed on delete.
- **Reference tables are schema-locked** — cross-app refs sync one-way from the source on `schema_hash` change.
- **Reflection** can populate metadata from an existing physical table; `preserve_custom_metadata: true` keeps your overlaid descriptions/weights.

## Populate (query-time FK expansion)

Not a schema feature — just declare FKs. Consumers request expansion via `populate=order,order.customer`. Dots traverse nested FKs; `*` populates all one-hop FKs. **Max populate depth: 3.**

## Common mistakes

1. Omitting `primaryKey` (required on every table).
2. Renaming a column without `x-rename-from` (data is lost).
3. Adding a required column to a populated table without a `default` (classified destructive — rejected via MCP).
4. Narrowing or changing a column type in place (destructive).
5. FK to a not-yet-materialized table in the same datapackage — order `resources[]` so targets come first.
6. Forgetting `indexes` on filter/FK columns — only the PK is auto-indexed.
7. Declaring `search_vector` manually — it's synthesized.
8. Using `jsonb` provider for an M2M junction (rejected).
9. A name longer than ~57 bytes after `{app_slug}_` prefix.

## Comprehensive example

A single datapackage exercising every supported attribute. Each numbered tag like `[1]` in the description below maps to a feature used in the JSON.

```json
{
  "name": "blog_platform",                                                  // [1]
  "title": "Blog Platform",                                                 // [1]
  "description": "Authors, posts, comments, tags",                          // [1]
  "resources": [

    {
      "name": "departments",                                                // [2]
      "title": "Departments",                                               // [2]
      "schema_format": "frictionless",                                      // [3]
      "provider_type": "flat_table",                                        // [3]
      "provider_config": {},                                                // [3]
      "hierarchy": true,                                                    // [4] resource-level convenience
      "schema": {
        "fields": [
          {"name": "id", "type": "string", "format": "uuid",
           "constraints": {"required": true}},
          {"name": "name", "type": "string",
           "constraints": {"required": true, "maxLength": 120, "unique": true}}
        ],
        "primaryKey": ["id"],
        "graph": {                                                          // [4]
          "enabled": true,
          "types": [
            {"name": "parent", "inverse": "children",
             "constraints": {"max_outgoing": 1},
             "description": "Reporting line; tree-shaped"},
            {"name": "collaborates_with",
             "metadata": {"fields": [{"name": "since", "type": "date"}]}}
          ]
        }
      }
    },

    {
      "name": "authors",
      "audit_enabled": true,                                                // [5]
      "schema": {
        "fields": [
          {"name": "id", "type": "string", "format": "uuid",
           "constraints": {"required": true}},
          {"name": "department_id", "type": "string", "format": "uuid"},
          {"name": "email", "type": "string", "format": "email",            // [6]
           "constraints": {"required": true, "unique": true,
                           "pattern": "^[^@]+@[^@]+\\.[^@]+$"}},            // [7]
          {"name": "display_name", "type": "string",
           "title": "Display name",                                         // [8]
           "description": "Shown publicly on posts",                        // [8]
           "constraints": {"required": true, "minLength": 2, "maxLength": 80}},
          {"name": "bio", "type": "string"},
          {"name": "website", "type": "string", "format": "uri"},
          {"name": "follower_count", "type": "integer",
           "default": 0,                                                    // [9]
           "constraints": {"minimum": 0, "maximum": 10000000}},
          {"name": "tier", "type": "string", "default": "free",
           "constraints": {"enum": ["free", "pro", "enterprise"]}},
          {"name": "is_verified", "type": "boolean", "default": false},
          {"name": "metadata", "type": "object"},
          {"name": "social_handles", "type": "array",
           "arrayItem": {"type": "string"}},                                // [10]
          {"name": "active_hours", "type": "any",
           "x-pg-type": "tstzrange"},                                       // [11]
          {"name": "joined_on", "type": "date"},
          {"name": "preferred_notification_time", "type": "time"},
          {"name": "created_at", "type": "datetime"},
          {"name": "updated_at", "type": "datetime"},
          {"name": "legacy_user_id", "type": "string",
           "x-rename-from": "old_uid"}                                      // [12]
        ],
        "primaryKey": ["id"],
        "foreignKeys": [
          {"fields": ["department_id"],
           "reference": {"resource": "departments", "fields": ["id"]},
           "x-actions": {"onDelete": "SET NULL"}}                           // [13]
        ],
        "indexes": [
          {"name": "idx_authors_tier_active",
           "fields": ["tier", "is_verified"]},
          {"name": "idx_authors_email_lower",
           "expression": "LOWER(email)", "unique": true},                   // [14]
          {"name": "idx_authors_active_only",
           "fields": ["created_at"], "where": "is_verified = true"},        // [15]
          {"name": "idx_authors_metadata",
           "fields": ["metadata"], "type": "gin"}                           // [16]
        ],
        "search_fields": [                                                  // [17]
          {"field": "display_name", "weight": "A"},
          {"field": "bio", "weight": "B"}
        ],
        "search_language": "english",
        "search_config": "english"
      }
    },

    {
      "name": "posts",
      "schema": {
        "fields": [
          {"name": "id", "type": "string", "format": "uuid",
           "constraints": {"required": true}},
          {"name": "author_id", "type": "string", "format": "uuid",
           "constraints": {"required": true}},
          {"name": "owner_user_id", "type": "string", "format": "uuid"},
          {"name": "cover_file_id", "type": "string", "format": "uuid"},
          {"name": "title", "type": "string",
           "constraints": {"required": true, "maxLength": 500}},
          {"name": "slug", "type": "string",
           "constraints": {"required": true, "unique": true,
                           "pattern": "^[a-z0-9-]+$"}},
          {"name": "body", "type": "string"},
          {"name": "status", "type": "string", "default": "draft",
           "constraints": {"enum": ["draft", "published", "archived"]}},
          {"name": "view_count", "type": "integer", "default": 0,
           "constraints": {"minimum": 0}},
          {"name": "rating", "type": "number",
           "constraints": {"minimum": 0, "maximum": 5}},
          {"name": "tags_cache", "type": "array",
           "arrayItem": {"type": "string"}},
          {"name": "published_at", "type": "datetime"},
          {"name": "score_range", "type": "any",
           "x-pg-type": "numrange"}
        ],
        "primaryKey": ["id"],
        "foreignKeys": [
          {"fields": ["author_id"],
           "reference": {"resource": "authors", "fields": ["id"]},
           "x-actions": {"onDelete": "CASCADE"}},
          {"fields": ["owner_user_id"],
           "reference": {"resource": "auth_user", "fields": ["id"]},        // [18]
           "x-actions": {"onDelete": "SET NULL"}},
          {"fields": ["cover_file_id"],
           "reference": {"resource": "storage_objects", "fields": ["id"]},  // [18]
           "x-actions": {"onDelete": "SET NULL"}}
        ],
        "indexes": [
          {"name": "idx_posts_status_pub",
           "fields": ["status", "published_at"]},
          {"name": "idx_posts_author", "fields": ["author_id"]}
        ],
        "search_fields": [
          {"field": "title", "weight": "A"},
          {"field": "body", "weight": "B"}
        ]
        // tags (M2M via post_tags) and comments (hasMany via FK) are
        // auto-inferred — no manyToManyRelationships / reverseRelationships block needed.
      }
    },

    {
      "name": "tags",
      "schema": {
        "fields": [
          {"name": "id", "type": "string", "format": "uuid",
           "constraints": {"required": true}},
          {"name": "label", "type": "string",
           "constraints": {"required": true, "unique": true, "maxLength": 60}}
        ],
        "primaryKey": ["id"]
      }
    },

    {
      "name": "post_tags",                                                  // [21] junction
      "schema": {
        "fields": [
          {"name": "post_id", "type": "string", "format": "uuid",
           "constraints": {"required": true}},
          {"name": "tag_id", "type": "string", "format": "uuid",
           "constraints": {"required": true}}
        ],
        "primaryKey": ["post_id", "tag_id"],                                // [22]
        "foreignKeys": [
          {"fields": ["post_id"],
           "reference": {"resource": "posts", "fields": ["id"]},
           "x-actions": {"onDelete": "CASCADE"}},
          {"fields": ["tag_id"],
           "reference": {"resource": "tags", "fields": ["id"]},
           "x-actions": {"onDelete": "CASCADE"}}
        ]
      }
    },

    {
      "name": "comments",
      "schema": {
        "fields": [
          {"name": "id", "type": "string", "format": "uuid",
           "constraints": {"required": true}},
          {"name": "post_id", "type": "string", "format": "uuid",
           "constraints": {"required": true}},
          {"name": "reviewer_id", "type": "string", "format": "uuid"},
          {"name": "body", "type": "string",
           "constraints": {"required": true, "minLength": 1}},
          {"name": "is_deleted", "type": "boolean", "default": false}       // [23]
        ],
        "primaryKey": ["id"],
        "foreignKeys": [
          {"fields": ["post_id"],
           "reference": {"resource": "posts", "fields": ["id"]},
           "x-actions": {"onDelete": "CASCADE"}},
          {"fields": ["reviewer_id"],
           "reference": {"resource": "moderation:reviewers", "fields": ["id"]}, // [24]
           "x-actions": {"onDelete": "NO ACTION"}}
        ]
      }
    }

  ]
}
```

Inline `// [N]` markers point back to the corresponding section above for each feature: envelope/resource keys, `hierarchy`/`graph`, `audit_enabled`, field `format`/`constraints`/`default`/`arrayItem`/`x-pg-type`/`x-rename-from`, FKs with `x-actions` and cross-app `app:table` refs, system FK targets (`auth_user`, `storage_objects`), expression/partial/GIN indexes, weighted `search_fields`, junction tables, composite `primaryKey`, and the `is_deleted` consumer convention.
