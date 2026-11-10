# Cerbos policy cookbook

Authoring Cerbos policies for Taruvi through the MCP server's policy tools. For the canonical authoring guide, read the server's policy docs (MCP resources or docs tool) — this file is a condensed reference. The policy save tool's input schema can differ from the Cerbos-native shapes shown below; follow the tool's schema for the outer payload.

## Mental model

A Cerbos policy answers: *"Can this principal (user + roles + attributes) do this action on this resource (type + instance + attributes)?"*

Taruvi policies come in three flavors:

- **Resource policy** — rules for a specific resource type (e.g., `datatable:orders`).
- **Principal policy** — overrides for a specific user or role across resources.
- **Derived roles** — computed roles based on attributes (e.g., "owner of this record").

## Resource policy shape

```json
{
  "apiVersion": "api.cerbos.dev/v1",
  "resourcePolicy": {
    "resource": "datatable:orders",
    "version": "default",
    "rules": [
      {
        "actions": ["read"],
        "effect": "EFFECT_ALLOW",
        "roles": ["viewer", "editor"]
      },
      {
        "actions": ["update", "delete"],
        "effect": "EFFECT_ALLOW",
        "roles": ["editor"],
        "condition": {
          "match": {
            "expr": "R.attr.owner_id == P.id"
          }
        }
      }
    ]
  }
}
```

Key bits:

- `resource` — string identifier. Convention: `datatable:<table_name>` for datatables, `bucket:<slug>` for buckets, `function:<slug>` for functions, `query:<slug>` for analytics queries.
- `version` — usually `"default"`; use other versions for staged rollouts.
- `rules[]` — list of `{actions, effect, roles, condition?, derivedRoles?}`.
- `roles[]` — use each role's bare `name` (e.g. `Admin`), NOT its app-scoped slug (e.g. `hrapp-admin`). This is the one spot the "use the slug" convention doesn't apply; the slug matches nothing, so every request is denied. Get `name` from the role list or role create response.
- `condition.match.expr` — CEL expression. `P` is the principal, `R` is the resource, `request.aux` is auxiliary data.
- `effect` — `EFFECT_ALLOW` or `EFFECT_DENY`. DENY rules take precedence over ALLOW.

## Principal policy shape

```json
{
  "apiVersion": "api.cerbos.dev/v1",
  "principalPolicy": {
    "principal": "alice",
    "version": "default",
    "rules": [
      {
        "resource": "datatable:orders",
        "actions": [
          {"action": "delete", "effect": "EFFECT_DENY"}
        ]
      }
    ]
  }
}
```

Use sparingly — prefer role-based rules in resource policies.

## Derived roles

```json
{
  "apiVersion": "api.cerbos.dev/v1",
  "derivedRoles": {
    "name": "common_roles",
    "definitions": [
      {
        "name": "owner",
        "parentRoles": ["user"],
        "condition": {
          "match": {
            "expr": "R.attr.owner_id == P.id"
          }
        }
      }
    ]
  }
}
```

Reference via `derivedRoles: ["owner"]` inside a resource policy rule. Store derived role policies separately and import.

## Common patterns

### Owner can do anything

```json
{
  "actions": ["*"],
  "effect": "EFFECT_ALLOW",
  "derivedRoles": ["owner"]
}
```

### Read-only access for authenticated users

```json
{
  "actions": ["read", "list"],
  "effect": "EFFECT_ALLOW",
  "roles": ["user"]
}
```

### Tenant isolation (belt-and-suspenders)

Tenant isolation is enforced at the DB schema level, but add policy-level checks for defense-in-depth:

```json
{
  "actions": ["*"],
  "effect": "EFFECT_DENY",
  "roles": ["*"],
  "condition": {
    "match": {
      "expr": "R.attr.tenant_id != P.attr.tenant_id"
    }
  }
}
```

### Time-bounded access

```json
{
  "actions": ["read"],
  "effect": "EFFECT_ALLOW",
  "roles": ["contractor"],
  "condition": {
    "match": {
      "expr": "now() < timestamp(R.attr.access_expires_at)"
    }
  }
}
```

### Attribute-based (ABAC)

```json
{
  "actions": ["approve"],
  "effect": "EFFECT_ALLOW",
  "roles": ["manager"],
  "condition": {
    "match": {
      "all": {
        "of": [
          {"expr": "R.attr.amount <= P.attr.approval_limit"},
          {"expr": "R.attr.status == 'pending'"}
        ]
      }
    }
  }
}
```

## Applying policies

Always inspect first: read the existing policies for the resource (e.g. filter by name `datatable:orders`).

Then create or update the policy through the MCP server's policy save tool.

**Saving replaces the entire policy body.** If you want to add a rule to an existing policy, read it first, append to `rules[]`, and send the full body back.

When creating with `policy_type="resource"` and `entity_type` (e.g., `"datatable"`), the response includes `entity_actions` — the list of valid actions for that entity type. Use these to populate your `rules[].actions`.

Disable without deleting: use the policy disable operation with the policy's id. Check the tool list for whether a disabled policy can be re-enabled; if not, recreate it with a save.

## Common mistakes

See also: Gotchas in SKILL.md for cross-cutting warnings (policy replacement, etc.).

1. **Forgetting DENY precedence** — a DENY rule on `roles: ["*"]` will override every ALLOW. Put broad DENYs last and scope them narrowly.
2. **Using the wrong condition scope** — `P` vs `R` vs `request.aux` confusion. `P` = principal (the user making the request), `R` = resource (the thing being acted on).
3. **Policy ID format** — take policy ids from the policy read response; don't construct them by hand.
4. **Skipping `version`** — always set `"version": "default"` unless you're versioning on purpose.
5. **Using the role slug in `roles[]`** — Cerbos matches the bare role `name` (e.g. `Admin`), not the app-scoped slug (e.g. `hrapp-admin`) used everywhere else. The slug matches nothing, so every request is denied — silently, with no error at policy-create time. Get `name` from the role list or role create response.

## When to escalate to raw Cerbos docs

- Complex condition grammar: https://docs.cerbos.dev/cerbos/latest/policies/conditions.html
- Auxiliary data: https://docs.cerbos.dev/cerbos/latest/api/admin_api.html
- Multi-tenant policy scopes (advanced): Cerbos "scope" field

Taruvi's MCP wraps Cerbos's admin API. The policy bodies themselves follow upstream Cerbos syntax verbatim.
