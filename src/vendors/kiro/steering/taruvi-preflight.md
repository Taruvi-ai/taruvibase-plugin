# Taruvi preflight (mandatory)

For any task involving Taruvi, Refine + Taruvi, `@taruvi/sdk`, or `@taruvi/refine-providers`:

1. Load the **`taruvi-app-developer`** skill first — it routes you to the right module skills.
2. Load **`taruvi-refine-providers`** for any frontend/provider work.
3. Follow the skill's routing step to load relevant reference docs before writing code.

Do not implement from memory. Do not treat prior knowledge as sufficient.

## Division of labour

| Work | Skill |
|---|---|
| Schema, policies, roles, functions, secrets, analytics via MCP | `taruvi-app-developer` |
| Refine UI with data / storage / app / user / auth / access-control providers | `taruvi-refine-providers` |

## User data access rule (mandatory)

Taruvi already provides built-in user management (users, roles, auth).

- **Never** create custom user/auth datatables (`users`, `auth_users`, `user_roles`, `passwords`, `sessions`) to replace platform identity.
- **Never** access `auth_user` through datatable routes from frontend code (e.g. `datatables/auth_user/data`).
- **Never** use `resource: "auth_user"` in Refine hooks/components.
- Always access users via the `user` provider (`dataProviderName: "user"`, `resource: "users"`).
- Manage users/roles through the dedicated user/app APIs and MCP tools (`list_users`, `create_user`, `update_user`, `manage_roles`, `manage_role_assignments`) — not manual SQL CRUD on identity data.
- If user identity data is not available to the current role, degrade gracefully in the UI (no crashing, no retry spam).

## Confirm live scope before mutations

The workspace MCP entry uses the URL pasted from Console → org → site → app →
Settings → Connect → MCP Server (**This app**). Extract siteId/appId automatically;
do not ask the user for slugs. OAuth needs no `.env` or runtime domain. If existing
runtime site/app metadata conflicts with the URL, resolve the mismatch first. Disabled, inherited-only, placeholder, and mismatched
connections are blocked. The hook resolves the actual called server from the
Kiro event's `tool_name` and binds confirmation to its `session_id`.

The guard permits only `get_sites` and `get_apps` for OAuth (legacy API-key connections use
`get_datatable_schema` and `get_ai_docs`) before live
confirmation. Use harmless site/app reads on the selected workspace server and
compare the response with known app context. If the response cannot establish
the intended tenant/app, stop; do not infer scope just from working credentials.
Reconnect if the active connection predates a configuration change.

After observing the correct live scope, record that evidence with the current
hook session ID and actual server name:

```bash
python3 .kiro/scripts/mcp_scope.py --record --server taruvi \
  --session-id '<current-session-id>' \
  --observed-site-slug '<verified-site-slug>' \
  --observed-app-slug '<app-slug>'
```

This is an agent/operator attestation, not an automated remote identity check.
Do not record it to silence a warning or invent a session ID. The script cannot
inspect the client's live binding. A new session, changed credentials or scope,
or a different server requires fresh verification. Unexpected tool results
invalidate the attestation: stop mutations and reconnect/verify again.

Exit 0 permits the checked call; exit 2 blocks with a diagnostic on stderr,
even with `--quiet`. To inspect configuration without live confirmation, run
`python3 .kiro/scripts/check-taruvi-setup.py --server taruvi`.

## MCP first, runtime configuration when needed

Taruvi MCP setup starts with the Console MCP URL/configuration. The agent reads
siteId and appId from it automatically. OAuth does not require `.env`. Running
the Refine app separately needs runtime configuration.

| File | Connects | Read by |
|---|---|---|
| `.kiro/settings/mcp.json` | the agent → platform | Kiro MCP client |
| `.env` | the running app → platform | `vite.config.ts` → `__TARUVI_*__` globals |

`python3 .kiro/scripts/check-taruvi-setup.py` validates MCP scope and checks for
conflicts with runtime site/app metadata when present. It does not validate the
runtime API key for OAuth connections.

Before building or debugging app features, confirm `.env` exists with `TARUVI_SITE_URL`,
`TARUVI_APP_SLUG`, and `TARUVI_API_KEY` populated. If it's missing, `src/taruviClient.ts` throws
"Missing required environment variable" at startup and every page fails — this is a config
problem, not a code bug, so don't try to fix it in source.

Two traps:

- `TARUVI_SITE_URL` is the **full URL** (`https://<tenant>.taruvi.cloud`); MCP config uses the
  **verified site slug** in `siteId`, plus `appId`; do not derive the slug from a domain.
- Vite bakes these in at build time, so **restart the dev server** after editing `.env`. Hot
  reload will not pick it up.

To set either up, run the `kiro-setup` skill ("setup taruvi") rather than hand-editing. Runtime files
may hold credentials: keep them gitignored, never commit them, and never paste key values into
chat or source.

## MCP over raw SQL

Prefer the current OAuth MCP tool catalogue. The Worker has no raw SQL tool;
do not use legacy `execute_raw_sql` or bypass policies to emulate missing tools.

## New entities

Every new entity needs a Cerbos policy **before its first write**.
