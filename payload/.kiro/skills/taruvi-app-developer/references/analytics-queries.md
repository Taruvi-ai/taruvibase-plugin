# Analytics queries

Analytics queries are named, parameterized SQL statements stored as first-class Taruvi resources. They can be executed on demand, cached, and consumed by Refine via the `app` data provider, or by a function body via `sdk_client.analytics.execute(...)`.

**Default to the datatable provider, not this.** `useList` with `meta.aggregate` + `meta.groupBy` (and `meta.populate` for related fields) — or `sdk_client.database.from_(...).aggregate(...).group_by(...)` from a function — covers single-table metrics and most cross-table cases on Taruvi datatables without registering anything.

**Use an analytics query only when one of these is true:**

- The source is an **external database** (Postgres, MySQL, Redshift, Elasticsearch, ClickHouse) — `connection_type="external"` plus a credential secret.
- The SQL genuinely cannot be expressed via the datatable provider — multi-table joins with grouped aggregation, window functions (`OVER`, `PARTITION BY`, `ROW_NUMBER`), recursive CTEs, complex Jinja-driven conditional filters.
- The query is reused across many places and benefits from a named, parameterized, cacheable contract.

If neither applies, build it on the datatable provider. Registering and maintaining an analytics query is more moving parts (a separate resource, a Cerbos `query:<slug>` policy, a coordinated update when columns change) — pay that cost only when it's earning its keep.

## Registering a query

### Internal (against tenant DB)

```
manage_query(
  action="create",
  name="daily-revenue",
  description="Total revenue per day over a date range",
  query_text="""
    SELECT DATE(created_at) AS day, SUM(total) AS revenue
    FROM orders
    WHERE created_at BETWEEN {{ start_date }} AND {{ end_date }}
      AND status = 'completed'
    GROUP BY day
    ORDER BY day DESC
  """,
  connection_type="internal",
  tags=["reporting", "finance"]
)
```

### External (against a separate database)

```
manage_query(
  action="create",
  name="crm-accounts",
  query_text="SELECT id, name FROM accounts WHERE tier = {{ tier }}",
  connection_type="external",
  secret_key="CRM_DATABASE_URL",
  tags=["crm"]
)
```

External queries require a `secret_key` that points to an analytics-typed secret (`analytics-postgres`, `analytics-mysql`, etc.). Create the secret first — see [secrets-and-types.md](secrets-and-types.md).

**Supported external databases:** PostgreSQL, MySQL, Amazon Redshift, Elasticsearch, ClickHouse.

## Jinja2 parameters

Query text is rendered via Jinja2 at execution time:

- `{{ param_name }}` — escaped variable substitution.
- `{% if ... %}` — conditional blocks for optional filters.
- `{{ param_name | default("fallback") }}` — filter-based defaults.

Example with conditional filter:

```sql
SELECT * FROM orders
WHERE created_at >= {{ start_date }}
{% if customer_id %}
  AND customer_id = {{ customer_id }}
{% endif %}
ORDER BY created_at DESC
LIMIT {{ limit | default(100) }}
```

Execution:

```
execute_query(query_slug="daily-revenue", params={"start_date": "2026-04-01", "end_date": "2026-04-17"})
```

Returns `{success, data, total, execution_key}`.

## Managing queries

```
manage_query(action="list", search="revenue", limit=50)
manage_query(action="get", query_slug="daily-revenue")
manage_query(action="update", query_slug="daily-revenue", query_text="...", description="...")
manage_query(action="delete", query_slug="daily-revenue")
```

Updates preserve the slug; only mutable fields (text, description, tags, connection) change.

## When to use an analytics query vs raw SQL

| Use analytics query when... | Use raw SQL when... |
|---|---|
| The query is named and reused | One-off or exploratory |
| You want param templating | You don't need parameters or have simple literals |
| Consumers need Refine access | MCP-only execution |
| The query has a long-lived contract | You're doing a one-time migration |
| External DB source | Cross-tenant (which is blocked anyway) |

## Consumption paths

- **MCP**: `execute_query(query_slug, params)` — for agents and back-end scripts.
- **Refine frontend**: `useCustom` with `meta.kind: "analytics"` via the `app` data provider. See the `taruvi-refine-providers` skill.
- **Python SDK (function body)**: `client.analytics.execute(query_slug, params)`. See [`function-sdk-reference.md`](function-sdk-reference.md).

## Common mistakes

1. **External query without a matching analytics secret.** Creates but fails at execute time. Create the secret first.
2. **Inline parameter literals.** Always use Jinja2 `{{ name }}` — the executor handles escaping.
3. **Very expensive queries with no `LIMIT`.** Add a `{{ limit | default(100) }}` safeguard.
4. **Updating a query in use.** Consumers reference by slug — updating doesn't break them, but a change in column shape will. Coordinate schema changes with frontend updates.
5. **Confusing `manage_query` and `execute_query`.** `manage_query` is the metadata surface (create/update/delete the definition); `execute_query` runs the query.
