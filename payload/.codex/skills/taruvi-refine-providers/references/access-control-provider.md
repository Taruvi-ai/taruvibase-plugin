# Access Control Provider

Resource-based authorization using Cerbos policies. Batches multiple `useCan` calls into a single API request using DataLoader.

## Setup

```tsx
<Refine
  authProvider={authProvider(client)}
  accessControlProvider={accessControlProvider(client)}
/>
```

## Options

```tsx
accessControlProvider(client, {
  batchDelayMs: 50, // ms to wait before batching (default: 50)
});
```

## Check Permissions

Use prefixed ACL resource strings — format: `<kind>:<name>` (e.g., `datatable:employees`, `function:employee-terminate`, `query:hrms-dashboard-summary`).

```tsx
const { data } = useCan({
  resource: "datatable:posts",
  action: "update",
  params: { id: 1 },
});

if (data?.can) {
  // User can edit this post
}
```

Do **not** use `params.entityType` — pass the prefixed resource string directly.

## Action Mapping (UI -> Cerbos)

Always map UI actions to canonical Cerbos actions before checks:

| UI action | Cerbos action |
|---|---|
| `list` | `read` |
| `show` | `read` |
| `edit` | `update` |
| `create` | `create` |
| `delete` | `delete` |

Never send raw UI actions (`list`, `show`, `edit`) to `/check/resources`.

## `/check/resources` Payload Validation

When validating network payloads:

- `resource.kind` must be prefixed (`datatable:policies`), never bare (`policies`)
- action names must be canonical (`read`, `update`, `create`, `delete`, `execute`)
- `resource.kind` in request payload must exactly match the `resource` value passed in `useCan`/`CanAccess`

Invalid payload example:

```json
{
  "resource": { "kind": "policies", "id": "..." },
  "actions": ["edit", "delete"]
}
```

Valid payload example:

```json
{
  "resource": { "kind": "datatable:policies", "id": "..." },
  "actions": ["update", "delete"]
}
```

## CanAccess Component

```tsx
<CanAccess resource="datatable:posts" action="delete" params={{ id: 1 }}>
  <DeleteButton />
</CanAccess>
```

## Resource Prefixes

| Prefix | Use for |
|---|---|
| `datatable:<name>` | Datatable CRUD operations |
| `function:<slug>` | Serverless function execution |
| `query:<slug>` | Analytics query execution |

## Caching

Uses Refine's built-in TanStack Query caching:
- `staleTime`: 5 minutes
- `gcTime`: 10 minutes

DataLoader handles request batching only (its own cache is disabled).

## Default UI Behavior

- `buttons.enableAccessControl`: `true` — access control checks enabled on all buttons
- `buttons.hideIfUnauthorized`: `true` — buttons are hidden (not just disabled) when unauthorized
