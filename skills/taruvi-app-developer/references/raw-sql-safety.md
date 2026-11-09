# Raw SQL safety

Some versions of the Taruvi MCP server offer an audited raw SQL tool as the escape hatch when other MCP operations can't express what you need. **Check the connected server's tool list first** — if there is no raw SQL tool, use schema saves for DDL, record saves/deletes for writes, and an internal analytics query for reads and aggregation. Where it exists, it's powerful, audited, and constrained — but not a substitute for the higher-level operations. Follow the tool's own description and input schema over the details below.

## Before reaching for raw SQL

Prefer, in this order:

1. Record query / save / delete operations for row-level CRUD.
2. Table schema saves for schema changes (add/drop columns, indexes, FKs).
3. Analytics queries for parameterized reads and aggregation.
4. Raw SQL — last resort, for things like conditional one-off migrations, ad-hoc maintenance, or multi-step atomic operations.

## Typical input

Check the tool's input schema; it has typically looked like:

```
raw_sql(
  sql: str,                          # single or multi-statement
  params: dict = None,               # %(name)s placeholders
  auto_reflect: bool = True,         # reflect schema changes via Alembic
  transaction_mode: str = "auto",    # "auto" | "atomic" | "manual"
  max_rows: int = 1000               # 0 = unlimited (dangerous)
) -> dict
```

Returns:

```json
{
  "success": true,
  "executed_statements": 2,
  "results": [
    {"rows": [...], "total": 5, "execution_time_ms": 12.3},
    ...
  ],
  "schema_changes": [{"operation": "ADD_COLUMN", "table": "orders", "column": "priority"}],
  "total_execution_time_ms": 45.6,
  "warnings": ["DDL committed before following DML"]
}
```

## What's blocked

The `SQLAnalyzer` + `validate_sql_security` reject:

- Cross-tenant schema references (anything outside the current tenant schema).
- System schemas (`pg_catalog`, `information_schema`, `public` when not-current-tenant).
- View/trigger/function DDL (`CREATE VIEW`, `CREATE FUNCTION`, etc.).
- `DROP TABLE` — use the table delete operation instead.
- Some rewrites that could bypass Cerbos (e.g., certain RULE/POLICY syntax).

## What's allowed (but audited)

- `SELECT` — always fine, limited by `max_rows`.
- `INSERT` / `UPDATE` / `DELETE` — audited to `alembic_revision_history`.
- `CREATE TABLE` / `ALTER TABLE ADD|DROP COLUMN` / `CREATE INDEX` — DDL, auto-reflected if `auto_reflect=True`.
- Prefer schema-level DDL through table schema saves where possible — it handles rollback and metadata sync.

## Parameters

Use `%(name)s` placeholders and pass values via `params`:

```python
raw_sql(
  sql="SELECT * FROM orders WHERE total >= %(min_total)s AND status = %(status)s",
  params={"min_total": 100, "status": "pending"}
)
```

Do **not** string-format values into the SQL. The analyzer can't sanitize injected literals, and parameterized queries use the driver's escaping.

## Transaction modes

- `"auto"` (default) — each statement runs in its own transaction. DDL commits immediately, DML commits on success.
- `"atomic"` — wraps the whole batch in one transaction. Any failure rolls back everything. **Note:** Postgres commits DDL before following DML in the same transaction by default, so mixing DDL + DML in atomic mode still has surprising semantics.
- `"manual"` — no automatic transaction wrapping. You're responsible for `BEGIN`/`COMMIT`.

## DDL + DML mixing

Avoid it. If you must:

1. Run DDL in one raw SQL call.
2. Wait for it to return successfully.
3. Run DML in a second call.

The tool will warn if it sees both in one batch. Don't ignore the warning.

## Auto-reflect

`auto_reflect=True` (default) means after DDL, the tool walks the altered schema and updates Taruvi's internal metadata (Alembic revision history, Frictionless schema cache).

## Max rows

`max_rows` caps `SELECT` result size. Default 1000. `max_rows=0` is "unlimited" — use carefully for large exports, and only after confirming with the user.

## Common mistakes

See also: Gotchas in SKILL.md for cross-cutting warnings (DDL commit behavior, tool preference hierarchy, etc.).

1. **String-formatting values into SQL.** Always use `%(name)s` + `params`.
2. **Forgetting `max_rows`.** Default is 1000; a `SELECT *` on a large table silently truncates.
3. **Assuming the audit log captures everything.** DML is audited; SELECT is not. Don't use raw SQL for sensitive reads and assume it's logged.
4. **Trying to `DROP TABLE`.** Blocked. Use the table delete operation.
5. **Running `ALTER TABLE` that drops a column, then expecting the Taruvi schema to auto-catch up.** `auto_reflect` helps but isn't infallible. Prefer table schema saves for field drops.

## When is raw SQL actually the right tool?

- Complex conditional migrations where you want procedural control.
- Bulk updates with correlated subqueries that record operations can't express.
- One-off data cleanup (`UPDATE ... SET X = Y WHERE ...`) that doesn't warrant a function.
- Ad-hoc analysis queries that you don't want to register as an `analytics_query`.
- Diagnostic reads of system-level tenant metadata (within the tenant schema).
