# Integration pitfalls

> MCP compatibility: legacy action-based tool examples below apply only to the
> tenant API-key MCP. For OAuth Worker calls, first read the [current tool guide](mcp-tool-quickref.md)
> and use discovered input schemas. Runtime SDK examples remain separate.

Gotchas that bite when features cross the MCP / function / frontend boundary. If you hit one of these, fix it and consider adding to this file.

## Policy ordering

**Symptom**: first insert to a new table returns 403 Forbidden.

**Cause**: Cerbos policy wasn't created (or was disabled) before the table's first write.

**Fix**: Always provision policies **after** table creation and **before** any write. Verify with:

```
manage_policies(action="get", name_regexp="^datatable:<name>$")
```

If empty, create the policy before the first insert.

## PK column mismatch

**Symptom**: Refine `useOne`, `useUpdate`, or `useDelete` hits 404 despite the row existing.

**Cause**: The datatable's Frictionless `primaryKey` is not `["id"]`, but the Refine hook uses the default `idColumnName: "id"`.

**Fix**: Either pass `meta: { idColumnName: "<actual_pk>" }` on every hook, or add `id` as a surrogate PK to the schema:

```json
{
  "fields": [..., {"name": "id", "type": "integer", "constraints": {"required": true}}],
  "primaryKey": ["id"]
}
```

## Function metadata vs function body divergence

**Symptom**: `manage_function(action="create_update", code="<body>")` succeeds but calling `execute_function` still runs old code.

**Cause**: Taruvi compiles/caches function bodies. Metadata and code updates go through the same call but the runtime may need a moment to pick up the change. Alternatively, you might be looking at a cached proxy response in dev.

**Fix**:
1. Confirm the update: `manage_function(action="get", function_slug="<slug>")` — the `code` field should match what you sent.
2. Give it ~2 seconds and retry.
3. If still stale, check `is_active=True` — an inactive function won't re-deploy.

## Async function + Refine `useCustom`

**Symptom**: Refine `useCustom` with `meta.kind: "function"` on an async function returns a task_id, not the result. UI breaks or shows the task_id as data.

**Cause**: Refine expects a sync response. Async functions return immediately with a task_id for later polling.

**Fix**:
- Keep the function sync if it fits the latency budget (return within 30s).
- Or, write a polling wrapper in the Refine page: `useCustom` to kick off, then `useCustom` with `queryOptions.refetchInterval` to poll for the result via a separate function.
- Or, provide an HTTP endpoint that proxies — out of scope for Taruvi MCP.

## Env var prefix mismatch

**Symptom**: `process.env.TARUVI_API_URL` is undefined at runtime in the frontend.

**Cause**: Framework requires a specific prefix to expose env vars to the browser. Vite wants `VITE_*`, CRA wants `REACT_APP_*`, Next.js wants `NEXT_PUBLIC_*` for browser-accessible vars.

**Fix**: Use the right prefix. See [env-setup.md](env-setup.md). In code, access via `import.meta.env.VITE_TARUVI_API_URL` (Vite) or `process.env.REACT_APP_TARUVI_API_URL` (CRA / Next.js).

## JWT expiry → silent auth failure

**Symptom**: Refine user is "logged in" but every API call returns 401 → they get redirected to login constantly.

**Cause**: JWT expired. Default Taruvi Refine flow doesn't silently refresh; `authProvider.onError` logs the user out on first 401.

**Fix (short-term)**: Live with the redirect. Prompt the user to log back in.

**Fix (longer-term)**: Add refresh-token flow. The SDK supports `auth.refreshToken()` but you need to wire it into the `authProvider.onError` — intercept 401 once, try refresh, only logout if refresh also fails. Not in the default `@taruvi/refine-providers` — custom work.

## `_cachedUser` staleness

**Symptom**: Admin revokes a user's role, but `useCan` still shows the old permissions until the user refreshes.

**Cause**: `authProvider.getIdentity()` caches the user to a module-level `_cachedUser`. `getPermissions()` reuses this cache. The cache only clears on `logout()`.

**Fix (manual)**: After a role change, force the affected user to log out and back in.

**Fix (automatic)**: Invalidate the TanStack Query cache for identity and access-control queries:

```typescript
queryClient.invalidateQueries({ queryKey: ["identity"] });
queryClient.invalidateQueries({ queryKey: ["access-control"] });
```

And re-fetch identity: `useGetIdentity({ queryOptions: { refetchOnMount: "always" } })`.

## 401 vs 403 confusion

**Symptom**: User with no access to a resource gets redirected to login (wrong); or user with a bad token sees a "No access" page (also wrong).

**Cause**: 401 means "not authenticated" (no/bad token); 403 means "authenticated but not allowed." `authProvider.onError` handles them differently:

- 401 → logout + redirect.
- 403 → surface error (no logout).

If you see 401 where you expected 403, check whether the server is misidentifying the auth state. Likely a token validity issue, not a policy issue.

## Storage bucket visibility

**Symptom**: Uploaded file accessible via direct URL even to anonymous users.

**Cause**: Bucket created with `visibility="public"`. Public buckets don't apply Cerbos policies for read.

**Fix**: Use `visibility="private"` and always serve files via authenticated download URLs (the SDK's `storage.from(...).download(path)` handles this).

## `meta.populate` doesn't work with aggregate

**Symptom**: `useList` with both `meta.populate` and `meta.aggregate` returns rows without populated relations.

**Cause**: Aggregate queries don't populate FKs. The result shape is aggregated rows, not entity rows.

**Fix**: Choose one or the other. For a dashboard with both aggregates and detail data, run two queries.

## Bulk update without `idColumnName`

**Symptom**: `updateMany` silently no-ops or updates the wrong rows.

**Cause**: Taruvi's `bulkUpdate` needs to know which field maps each `id` in the request to a row. If PK isn't `"id"` and you don't pass `meta.idColumnName`, the mapping is wrong.

**Fix**: Always pass `meta.idColumnName` when the PK isn't `"id"`:

```typescript
useUpdateMany({
  resource: "user_profiles",
  ids: [1, 2, 3],
  values: { status: "active" },
  meta: { idColumnName: "user_id" },
});
```

## Tenant schema and Celery tasks

**Symptom**: A Celery-backed Taruvi function can't find rows that exist in the tenant DB. Query returns empty.

**Cause**: The Celery worker didn't enter the right tenant schema. Functions running through the Taruvi runtime handle this automatically, but direct Celery tasks (e.g., custom tasks added outside the function system) won't.

**Fix**: In a custom Celery task, wrap DB ops in `with schema_context(tenant_slug): ...`. In a Taruvi function body, this is automatic — see [`function-authoring.md`](function-authoring.md).

## Foreign key to a table not yet materialized

**Symptom**: `create_update_schema` fails with "foreign key references resource X which does not exist."

**Cause**: In a multi-resource datapackage, resources with FKs to other resources in the same package must come **after** their targets.

**Fix**: Order `resources[]` so referenced tables come first. Or submit in two separate `create_update_schema` calls.

## Generic add-to-this-list note

When you discover a new integration pitfall, add it here with:

1. Symptom (what the user/agent sees)
2. Cause (what's actually happening)
3. Fix (what to do)

Short-circuit the next agent.
