# OAuth migration

Contract reviewed at platform commit `50825726069db5dbd0646f71fc95664384e2cc02`.

## What changed

The Worker is an OAuth resource server. TaruviBase/allauth is the authorization
server. A 401 challenge points clients to protected-resource metadata; clients
handle authorization-server discovery, dynamic registration (or CIMD), PKCE,
consent and refresh. The Worker introspects access tokens and forwards the
first-party token to the platform API. The plugin needs no OAuth implementation
or secret storage of its own.

| Environment | MCP resource | Authorization/API origin |
| --- | --- | --- |
| Production | `https://mcp.taruvibase.com/mcp` | `https://api.taruvi.cloud` |
| Test | `https://test-mcp.taruvibase.com/mcp` | `https://test-api.taruvi.cloud` |

The `resource` audience is the Worker `/mcp` resource. Let the MCP client discover
and supply it; do not implement an authorization URL or token exchange in a skill.
`mcp:read` allows reads; `mcp:write` additionally allows writes. URL filters
`siteId`, `appId`, `category` and `readonly` only narrow the token's grant.
Unscoped OAuth connections can reach every site the user is allowed to access.
App-scoped connections hide site-wide tools (including user management).

Deployed Workers disable API keys. Existing site-local Knox keys do not work
against the account-level Worker API. Keep them only for the app runtime or an
explicit legacy tenant connection. Do not silently retry OAuth using those keys.

## Migration steps

1. Upgrade the plugin. Local MCP entries remain preserved, including `--force`.
2. In Console, open org → site → app → Settings → Connect → MCP Server. Select
   **This app** and paste the URL or client configuration into your agent. It
   extracts environment, siteId and appId; no separate slug question is needed.
3. Change the active Taruvi entry to the Worker URL, with URL-encoded `siteId`
   and `appId`. Remove legacy Authorization/X-App-Slug headers and manual bearer
   credentials. Disable any unscoped duplicate; do not broaden permissions.
4. Authenticate using the vendor client (Claude `/mcp`; Codex
   `codex mcp login <actual-server-name>`; Cursor/Kiro MCP authentication controls).
   Allow the client's discovery and registration flow to run. Choose consent
   appropriate to the authorized task. Reconnect after URL or account changes.
5. Verify `get_sites` and `get_apps` on that actual connection. Use tool schemas
   from the live catalogue. Runtime `.env` still needs its own API key to run the
   app; never substitute an OAuth token into browser/runtime configuration.
6. Kiro extracts scope directly from the MCP URL and follows the preflight live
   attestation procedure. OAuth-only work needs no `.env` or runtime API key;
   any existing runtime site/app metadata must agree with the URL.
   Changing accounts requires fresh verification even when the URL is unchanged.
   The local hook cannot inspect client-managed OAuth credentials or detect
   account changes automatically; server-side authorization remains essential.

Portable packages use only standard `streamable-http` and `url` fields; no vendor
OAuth objects are added to the closed portable MCP schema. Native packages use
vendor formats. Sources: [Agent Plugins](https://agent-plugins.org/specification),
[Claude MCP](https://code.claude.com/docs/en/mcp),
[Codex MCP](https://developers.openai.com/codex/mcp),
[Cursor MCP](https://cursor.com/docs/mcp),
[Kiro MCP](https://kiro.dev/docs/mcp/configuration/).

## Release verification

Automated checks validate every shipped OAuth configuration, offline schema
conformance, isolated vendor packages, scope guards and installer preservation.
They do not authenticate a real account. Before release, test each supported
client version against the deployed test environment: discovery, browser login,
read-only consent, allowed test writes, expired-token refresh, logout/revocation,
reconnect, wrong site/app and a second account. Record versions and outcomes.
A 503 introspection outage is not an invalid-token response; do not discard or
replace credentials automatically. Inspect state before retrying timed-out writes.

The platform commit itself states that real deployed-client OAuth was not yet
verified. It also records weaker authorization checks on some REST endpoints;
this plugin does not repair those platform permissions. OAuth support here is
package/configuration support, not certification of deployed authentication.
