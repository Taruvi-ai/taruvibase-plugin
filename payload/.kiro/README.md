# Taruvi for Kiro

This generated directory is a self-contained Power in Agent Plugins 1.0.0 format:
`plugin.json`, `skills/`, and a portable OAuth `mcp.json`. Import this directory
using **Powers → Add Custom Power → Import power from a folder**.

The portable Power provides skills and MCP. Its additional workspace files (`hooks/`,
`steering/`, `scripts/`, and `workspace-mcp.example.json`) are not automatically
activated by importing the Power. For workspace automation, run the Taruvi npm
installer in the target project; it copies these files under `.kiro`.

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

References: [Power installation](https://kiro.dev/docs/powers/installation/),
[Power format](https://kiro.dev/docs/powers/create/), [workspace hooks](https://kiro.dev/docs/hooks/).
Repository tests do not prove live client loading or authentication. Record the
Kiro IDE/CLI version and run the workspace guard cases before release.
