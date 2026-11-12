# Taruvi for Claude Code

This generated directory is a self-contained Claude plugin. All skills and
references are inside its root; no sibling package is required.

For local testing, load the built package:

```bash
claude --plugin-dir /absolute/path/to/payload/.claude
```

After the npm workspace install, use the project-local `.claude` directory as
the plugin root instead. Merely copying `.claude/skills` does not activate the
plugin's MCP configuration.

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

References: [manifest and userConfig](https://code.claude.com/docs/en/plugins-reference),
[MCP scopes](https://code.claude.com/docs/en/mcp).
Run `claude plugin validate /absolute/path/to/plugin` with the intended client
version as part of release testing; repository tests do not launch Claude.
