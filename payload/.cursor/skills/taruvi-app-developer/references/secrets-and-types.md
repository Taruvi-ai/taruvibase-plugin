# Secrets and secret types

Taruvi secrets are typed, encrypted, and have 2-tier inheritance.

## Type-first, value-second

Every secret has a `secret_type`. The type declares:

- **Schema** — JSON Schema the `value` must validate against.
- **Sensitivity level** — `public` (returned in clear), `private` (masked), `sensitive` (masked, extra audit).
- **Immutability** — sensitivity and core identity can't change after create.

You must create the type **before** creating a secret of that type.

## System types (pre-provisioned)

System types (category = `TYPE_SYSTEM`) cover common credentials:

- `api-key` — free-form API key string
- `oauth-client` — OAuth client_id + client_secret object
- `database-url` — DB connection string (analytics sources use these)
- `aws-credentials` — access_key_id + secret_access_key + region
- `smtp-credentials` — SMTP host + port + user + pass
- plus a handful of analytics driver types (`analytics-postgres`, `analytics-mysql`, etc.)

System types **cannot be modified or deleted**. Check what exists first:

```
manage_secret_types(action="list", type_filter="system")
```

## Creating a custom type

```
manage_secret_types(
  action="create",
  name="stripe-cred",
  description="Stripe API credentials with webhook secret",
  schema={
    "type": "object",
    "required": ["publishable_key", "secret_key"],
    "properties": {
      "publishable_key": {"type": "string", "pattern": "^pk_"},
      "secret_key": {"type": "string", "pattern": "^sk_"},
      "webhook_secret": {"type": "string"}
    }
  },
  sensitivity_level="sensitive"
)
```

- `name` must match `^[a-zA-Z0-9_-]+$`.
- `schema` is validated at secret-create/update time via `validate_with_json_schema`.
- `sensitivity_level` is **immutable** post-create.

## Creating a secret

```
create_update_secret(
  key="STRIPE_PROD",
  value={"publishable_key": "pk_live_...", "secret_key": "sk_live_...", "webhook_secret": "whsec_..."},
  secret_type="stripe-cred",
  tags=["prod", "payments"]
)
```

- Scalar values are fine too: `value="sk_live_..."` against a type whose schema is `{"type": "string"}`.
- Tags are created on-the-fly if they don't exist.
- `app_slug` falls back to the current app context.

## Reading secrets

Single:
```
get_secret(key="STRIPE_PROD")
```

Returns `{key, secret_type, app, tags, value, sensitivity_level}`. The `value` field is `"[ENCRYPTED]"` for `private` and `sensitive` secrets — you cannot decrypt via the MCP surface for non-`public` secrets.

Inside a function body (via Python SDK), the runtime decrypts transparently — that's the correct path for reading sensitive values at runtime.

Listing:
```
list_secrets(secret_type="stripe-cred", tags="prod", limit=20)
list_secrets(list_types=True)   # list types, not values
```

## 2-tier inheritance

When you call `get_secret(key="X")` inside an app context:

1. Look for `X` at **app level** (in the current app's scope).
2. Fall back to **tenant level** (shared across apps in this tenant).

Config → env → app-level secret → tenant-level secret. First match wins.

## Analytics-specific types

Analytics queries with `connection_type="external"` require a `secret_key` that points to a secret whose type is one of the analytics driver types (e.g., `analytics-postgres`, `analytics-mysql`). The `driver` field in the secret's JSON value is parsed to route the connection correctly.

Listing analytics-only secrets:
```
list_secrets(analytics_only=True)
```

## Common mistakes

See also: Gotchas in SKILL.md for cross-cutting warnings (type-first rule, sensitivity immutability, etc.).

1. **Expecting to read `sensitive` values via MCP** — masked by design. Use the Python SDK inside a function body.
2. **Duplicate `name` for types** — blocked. Types are unique by name.
3. **Deleting a type with existing secrets** — blocked by FK constraint. Delete or migrate secrets first.
4. **Forgetting `app_slug` outside an app context** — `create_update_secret` enforces app-level scope on the MCP surface. Make sure the app context is set or pass `app_slug` explicitly.
