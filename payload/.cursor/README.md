# Taruvi for Cursor

This generated directory is a self-contained Cursor plugin, identified by
`.cursor-plugin/plugin.json`. It includes skills, rules, an agent, commands,
and the native `mcp.json` template.

Distribute this directory as the plugin root through Cursor's documented plugin
or team-marketplace workflow. The npm installer also copies these files to a
workspace's `.cursor` directory; workspace discovery is not plugin activation,
and plugin variables require a configured plugin installation.

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

References: [plugin formats, variables, and distribution](https://cursor.com/docs/reference/plugins).
Test the installed package and optional-variable behavior in the intended Cursor
version before release; repository checks validate files, not the running client.
