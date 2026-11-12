# Kiro workspace setup and verification

Use the npm installer in the target Taruvi app to install `.kiro/skills`,
`.kiro/steering`, `.kiro/hooks`, and `.kiro/scripts`. These are ordinary directories
with self-contained contents. Importing the Power alone loads portable skills;
it does not activate workspace hooks or steering.

## Connection

Ask `setup taruvi` and paste the Console MCP URL or configuration from
org → site → app → Settings → Connect → MCP Server, with **This app** selected.
The agent extracts the environment/site/app and writes `.kiro/settings/mcp.json`.
No separate slug, domain or API-key question is needed. Configure `.env` only
when running the app; keep runtime credentials ignored, untracked and mode 600.
Preserve unrelated servers and settings. The example configuration is `workspace-mcp.example.json`; portable
`mcp.json` declares the OAuth Worker using portable streamable-http.

Run:

```bash
python3 .kiro/scripts/check-taruvi-setup.py --server taruvi
```

This checks enabled HTTP transport, the approved OAuth Worker `/mcp` URL, explicit siteId/appId, and
consistency with any existing runtime site/app metadata. No `.env` is needed for OAuth. It does not prove the live binding.
Reconnect the selected server after configuration changes.

## Scope guard

Before a Taruvi MCP call, the hook reads Kiro's `tool_name`, `tool_input`, and
`session_id` from stdin. It resolves the actual workspace server; a matching
user-level server alone is insufficient. It rejects malformed, disabled,
placeholder, and mismatched connections and explicit app overrides.

Before confirmation, only `get_sites` and `get_apps` may run for OAuth. Legacy API-key
connections retain their schema/documentation probes.
Use harmless site/app reads and verify the intended app context. If the response
cannot establish scope, stop instead of assuming successful authentication proves
identity. Record the observed scope using the current session ID:

```bash
python3 .kiro/scripts/mcp_scope.py --record --server taruvi \
  --session-id '<current-session-id>' \
  --observed-site-slug '<verified-site-slug>' \
  --observed-app-slug '<app-slug>'
```

The record is an explicit agent/operator attestation. It contains a configuration
fingerprint and session/server identity, never the API key. New sessions and
configuration changes invalidate it. Exit 2 blocks and reports a reason to
stderr even in quiet mode. Unexpected live results require re-verification.

The hook is a local guard, not a substitute for server-side tenant authorization.
It cannot verify the MCP client's in-memory binding or prevent an authorized
operator from recording an incorrect attestation.

## Release verification

Test missing configuration, disabled servers, wrong tenant/app/key, inherited-only
servers, unknown tool IDs, a new session, a changed configuration, and a valid
read-only probe followed by confirmation and a test mutation. Verify no real
credentials appear in logs. Also verify setup and secret hooks load in the exact
Kiro IDE/CLI release being supported; Web sessions do not execute these hooks.
