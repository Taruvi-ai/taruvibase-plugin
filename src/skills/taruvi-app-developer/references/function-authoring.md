# Function authoring — runtime contract, modes, triggers, guardrails

> MCP compatibility: legacy action-based tool examples below apply only to the
> tenant API-key MCP. For OAuth Worker calls, first read the [current tool guide](mcp-tool-quickref.md)
> and use discovered input schemas. Runtime SDK examples remain separate.

This is the canonical reference for authoring Taruvi serverless function bodies. Read this before writing any function code. For per-module SDK signatures, see [`function-sdk-reference.md`](function-sdk-reference.md). For event filters, see [`function-events.md`](function-events.md). For worked end-to-end examples, see [`function-scenarios.md`](function-scenarios.md).

## Guardrails (non-negotiable)

- Use the exact APP-mode signature: `main(params, user_data, sdk_client)`.
- Never re-authenticate the injected `sdk_client` — it's already authenticated.
- Never hardcode secret values. Read via `sdk_client.secrets.get(...)`.
- Return JSON-serializable payloads only.
- Use serverless functions for multi-resource side effects, not frontend cascades.
- Read this skill's references for SDK shapes — never invent method names, event names, or API URLs.

## Runtime contract

### APP-mode entrypoint

```python
def main(params, user_data, sdk_client):
    # params: user-supplied input dict; may include params["__function__"] metadata
    # user_data: authenticated user context (None for public functions)
    # sdk_client: pre-authenticated SyncClient — do not re-authenticate
    ...
    return {"key": "value"}   # JSON-serializable only
```

Any deviation from this signature causes an immediate `SandboxError` before any code runs.

### Injected `sdk_client` modules

All available at `sdk_client.<module>`:

- `database`
- `functions`
- `storage`
- `secrets`
- `users`
- `analytics`
- `policy`
- `app`
- `settings`

Use module-native methods. Do not invent method names. Full reference: [`function-sdk-reference.md`](function-sdk-reference.md).

### Common patterns

- Long-running tasks → `sdk_client.functions.execute(..., is_async=True)` and poll with `get_result`.
- Policy checks → `policy.check_resources(...)`; pass `principal=None` so the server resolves the principal.
- Secrets → `sdk_client.secrets.get(...)` / `list(...)`; never hardcode.

### Safety and reliability

- Use `log()` (not `print()`) for structured, leveled, queryable logging.
- Validate input `params` before any side effects.
- Keep cross-resource orchestration in functions, not frontend.

## Execution modes

| Mode | Use for | Required input |
|---|---|---|
| `app` | Custom Python logic with SDK access | `code` |
| `proxy` | Forward request to an external webhook URL | `webhook_url` |
| `system` | Internal registered platform logic | (internal registration) |

The mode must be set at creation time. Without it, the function cannot be routed and creation fails.

### Examples — `manage_function`

```python
# APP mode — custom Python logic
manage_function(
    action="create_update",
    name="process-order",
    execution_mode="app",
    code="def main(params, user_data, sdk_client):\n    return {}"
)

# PROXY mode — forward to a webhook
manage_function(
    action="create_update",
    name="notify-slack",
    execution_mode="proxy",
    webhook_url="https://hooks.slack.com/services/xxx"
)

# SYSTEM mode — registered internal function
manage_function(
    action="create_update",
    name="cleanup_logs",
    execution_mode="system"
)
```

## Trigger types

| Trigger | Use for |
|---|---|
| API | Manual or user-initiated, called from frontend |
| Event | React to row or user events (`RECORD_CREATE`, `POST_USER_CREATE`, …) |
| Schedule | Periodic / cron (e.g., `0 8 * * 1` = Monday 8am) |
| API async (`is_async=True`) | Long-running workloads — returns `task_id` immediately |
| API public (`is_public=True`) | Unauthenticated external endpoints (webhooks, payments) |

For event triggers and CEL filter expressions, see [`function-events.md`](function-events.md).

## Frontend invocation

Functions registered with API trigger are called from the Refine frontend using `appDataProvider` + `useCustom` with `meta.kind: "function"`. The contract is documented in the `taruvi-refine-providers` skill. Brief example:

```typescript
const { data } = useCustom({
  url: "calculate-total",                  // function slug
  method: "post",
  dataProviderName: "app",
  payload: { items: [1, 2, 3] },           // function input
  meta: { kind: "function" },
});
```

For long-running work, prefer async functions and polling/status UX on the frontend.

## SDK docs workflow

Before writing any APP-mode body, read in this order:

1. This file (`function-authoring.md`) — runtime contract, modes, triggers.
2. [`function-sdk-reference.md`](function-sdk-reference.md) — per-module operation patterns (`database`, `storage`, `secrets`, `users`, `analytics`, `policy`, `app`, `settings`, `functions`).
3. [`function-events.md`](function-events.md) — only if the function is event-triggered.
4. [`function-scenarios.md`](function-scenarios.md) — when you want a worked example.

Rules:

- Never write Taruvi SDK code from memory — always check the bundled references first.
- Never invent SDK method names, event names, or API URLs.
- If the references don't cover a method or behavior, stop and ask for clarification instead of guessing.
- Match examples to the runtime: Python (`sdk_client`) for function bodies, TypeScript for frontend.
