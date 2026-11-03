# MCP tool quick reference

Every Taruvi MCP tool with its signature, purpose, and key gotcha. Read this before composing a sequence of calls.

## Datatables

### `get_datatable_schema(table_name=None)`
Get schema for one table (by `table_name`) or list all if omitted. Non-destructive. Always call this before `create_update_schema` on an existing table.

### `create_update_schema(datapackage: dict)`
Upsert tables from a Frictionless Data Package. **Missing fields are dropped**, not preserved. Materializes physical tables automatically. **Destructive changes are rejected** (narrowing types, incompatible casts, adding NOT NULL without a default, dropping NOT NULL) — this tool does not expose `allow_data_loss`, `dry_run`, `validate_only`, or `force_recreate`. Rework the schema or fall back to REST `PATCH` directly. Every accepted operation is recorded with a `revision_id` and an auto-generated inverse SQL; rollback is service-level only. DDL has a ~30s server-side timeout — split large refactors. Returns `{created_count, updated_count, error_count, errors}`. See [`datatable-schema-patterns.md`](datatable-schema-patterns.md) for safe-vs-destructive classification.

### `datatable_data(action, table_name, ...)`
- `action="query"` → args: `filters` dict, `sort_by`, `order`, `limit` (default 100, cap 1000), `offset`, `populate`. Returns rows + pagination.
  - `filters` keys use `field__operator` (e.g. `total__gte`, `status__in`, `metadata__color`).
  - Related-field traversal via dot notation: `deal_id.name__contains`, `activities.subject__contains`. Max 3 hops, 5 distinct paths; not combinable with aggregation. See [`backend-capabilities.md`](backend-capabilities.md) for the full operator set.
  - Aggregation is **not** available through this tool — use `manage_query` (analytics) or `execute_raw_sql`.
- `action="upsert"` → args: `data` (dict or list), `unique_fields` (comma-sep conflict keys), `validate=True`, `partial=False`.
- `action="delete"` → args: `ids` (scalar or list) **xor** `filters`. Exactly one of the two.

### `datatable_edges(action, table_name, ...)`
For graph/hierarchy-enabled tables only.
- `action="list"` → args: `from_id`, `to_id`, `edge_type`, `limit`, `offset`.
- `action="create"` → args: `edges` (dict or list of `{from_id, to_id, type, metadata}`), `validate_nodes=True`.
- `action="delete"` → args: `edge_ids` (scalar or list).

### `delete_datatable(table_name, force=False)`
Drops physical table + edges + metadata. **Destructive.** Without `force`, fails on FK dependencies and the error lists the deps. Use `force=True` only after user confirmation.

## Storage

### `manage_storage(action, ...)`
- `action="list_buckets"` → no args.
- `action="create_bucket"` → args: `name`, `visibility` (`"public"` or `"private"`, default `"private"`), `app_category` (**required**: `"assets"` or `"attachments"`), `max_size_bytes`.
- `action="list_objects"` → args: `bucket_slug`, `prefix`, `limit=50`.
- `action="get_quota"` → args: `bucket_slug`.

## Secrets

### `list_secrets(list_types=False, ...)`
- Default (`list_types=False`) lists secrets. Args: `app_slug`, `secret_type`, `tags`, `search`, `limit=50`, `analytics_only=False`.
- `list_types=True` lists secret types. Args: `type_filter` (`"system"`|`"custom"`).

### `get_secret(key, app_slug=None)`
Returns `{key, secret_type, app, tags, value, sensitivity_level}`. `value` is `[ENCRYPTED]` for non-public secrets.

### `create_update_secret(key, value=None, secret_type=None, app_slug=None, tags=None)`
Upsert semantics. Creates if `key` doesn't exist, updates value if it does. Requires `app_slug` (falls back to app context). Tags auto-created.

### `manage_secret_types(action, ...)`
- `action="list"` → args: `type_filter`, `search`, `limit=50`.
- `action="create"` → args: `name` (regex `^[a-zA-Z0-9_-]+$`), `description` (**required**), `schema` (JSON Schema), `sensitivity_level` (default `"private"`). Sensitivity is immutable post-create.
- `action="update"` → args: `slug`, optional `name`, `description`, `schema`. System types are blocked.
- `action="delete"` → args: `slug`. System types blocked; fails if secrets of this type exist.

## Users

### `list_users(search=None, role_slug=None, is_active=True, date_from=None, date_to=None, limit=100, offset=0)`
Lists tenant users. **`is_active=True` by default** — pass `False` or `None`-equivalent to see all.

### `create_user(username, email, password=None, first_name=None, last_name=None, is_active=True, is_staff=False, attributes=None, role_slugs=None)`
Generate a password if not provided. Always pass `role_slugs` — list them first with `manage_roles(action="list")`.

### `update_user(user_id, email=None, first_name=None, last_name=None, is_active=None, is_staff=None, attributes=None)`
**Password updates not allowed.** Use a separate password-reset flow.

## User attributes schema

### `user_attributes_schema(action, schema=None)`
Tenant-wide singleton.
- `action="get"` → returns current schema.
- `action="update"` → requires `schema` (JSON Schema Draft 2020-12). **Replaces entire schema.** Requires `manage_site` cloud permission.

## Roles

### `manage_roles(action, ...)`
- `action="list"` → `include_hierarchy=True`. Returns `id`, `name`, `description`, `parent_slug`, `level`. **Note:** `slug` is not returned in list — use `name` for display and the role's `slug` from `create` responses for subsequent operations. **Exception:** Cerbos policy `roles[]` arrays match the bare role `name`, not the slug — see [`cerbos-policy-cookbook.md`](cerbos-policy-cookbook.md).
- `action="create"` → `name`, `description`, optional `parent_slug`. Returns `id`, `name`, `slug`.
- `action="bulk_create"` → `roles` (list of dicts).
- `action="delete"` → `role_slug`. Fails if role has members or child roles.

### `manage_role_assignments(action, roles, usernames, expires_at=None)`
- `action="assign"` or `"revoke"`.
- `roles` and `usernames` accept string or list. `expires_at` only on assign.

## Functions (registration)

### `manage_function(action, ...)`
- `action="list"` → optional `execution_mode` filter.
- `action="create_update"` → `name`, `execution_mode` (`"app"`|`"proxy"`|`"system"`), `code` (app mode), `webhook_url` (proxy mode), `description`, `is_active=True`, `is_public=False` (public functions run unauthenticated), `async_mode=False` (execution returns task_id), `config`, `auth_config`, `headers`, `tags`, optional `function_slug` to force update path.
- `action="get"` → `function_slug`.
- `action="delete"` → `function_slug`.

### `execute_function(function_slug, params=None, async_mode=False)`
Sync returns `{success, async: False, result, logs}`. Async returns `{success, async: True, task_id, invocation_id}`.

## Policies (Cerbos)

### `manage_policies(action, ...)`
- `action="create_update"` → `policy_data` (full policy dict). **Replaces, not merges.**
- `action="get"` → `policy_id` for single, or `name_regexp`/`scope_regexp`/`version_regexp` for list. `include_disabled=False`.
- `action="enable"` → `policy_id`.
- `action="disable"` → `policy_id`.

## Analytics

### `manage_query(action, ...)`
- `action="list"` → no args. Returns all queries for the current app.
- `action="get"` → `query_slug`.
- `action="create"` → `name`, `query_text`, `connection_type` (`"internal"`|`"external"`, default `"external"`), `secret_key` (required for external), `description`, `tags`.
- `action="update"` → `query_slug`, optional updates.
- `action="delete"` → `query_slug`.

### `execute_query(query_slug, params=None)`
Executes the stored query with Jinja2 param substitution. Returns rows.

## Raw SQL

### `execute_raw_sql(sql, params=None, auto_reflect=True, transaction_mode="auto", max_rows=1000)`
- Multi-statement supported. Separate statements with `;`.
- Parses with `SQLAnalyzer`, rejects cross-tenant refs, system schemas, view/trigger/function DDL, `DROP TABLE`.
- DDL goes through Alembic reflection if `auto_reflect=True`. DML is audited.
- `transaction_mode`: `"auto"` (default, atomic per statement), `"atomic"` (wrap all), `"manual"` (don't).
- `max_rows=0` = unlimited (dangerous).

## Meta

### `manage_tags(action, ...)`
- `action="list"` → `search`, `limit=50`.
- `action="create"` → `name`, `description=""`, `color="#6B7280"`.

### `get_ai_docs(category, topic="guide")`
Docs registry. Known combos:
- `category="policies", topic="guide"` → Cerbos policy authoring.
- `category="sdk", topic="guide"` → Python SDK (for function bodies).
- `category="users", topic="attributes"` → user attributes schema guide.
