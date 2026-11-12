# Taruvi for Codex

This generated directory is a self-contained Codex compatibility plugin. It
contains `.codex-plugin/plugin.json`, `.mcp.json`, and all referenced skills.
The compatibility format remains supported; the repository root separately
provides a portable Agent Plugins package.

Add this built directory to a local/repository marketplace using the documented
Codex plugin workflow, then enable it. Copying `.codex` workspace files alone is
not the same as installing/enabling the plugin. Shared workspace skills are also
installed in `.agents/skills`, including `codex-setup` so OAuth setup is
discoverable without plugin activation. If automatic selection is missed, invoke
`$codex-setup` explicitly.

Ask `setup taruvi` and follow the bundled setup skill. Taruvi uses browser OAuth
at `https://mcp.taruvibase.com/mcp`; no Taruvi API-key fields are required.
In Console, open org → site → app → Settings → Connect → MCP Server. Select
**This app** and paste the URL or client configuration into the agent. It extracts
the environment, site and app automatically; you do not need to find a slug. Reconnect, sign in using the client's MCP controls, and verify
`get_sites` and `get_apps` against the intended Console site and app.
Runtime API keys remain in the app's ignored `.env`, separate from MCP OAuth.
The installer preserves existing local MCP settings even with `--force`: migrate
the Taruvi entry explicitly and remove its legacy auth and app headers.
Context7 configuration is independent. Live login and refresh need client testing.

Reference: [OpenAI plugin packaging and installation](https://developers.openai.com/plugins/build/plugins).
Repository tests validate isolated package contents. Live Codex loading and MCP
authentication must be checked with the client version used for release.
