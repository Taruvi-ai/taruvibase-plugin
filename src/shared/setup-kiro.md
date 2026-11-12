The Power bundles a portable `streamable-http` URL. Workspace setup uses
`.kiro/settings/mcp.json`, with native `type: "http"`, `url: <scoped URL>`,
`disabled: false` and `autoApprove: []`. Do not add auth headers. Kiro handles
OAuth discovery and dynamic client registration; complete its browser sign-in.
Importing a Power does not install workspace hooks or steering; the npm installer
provides those components. The workspace guard requires an explicit site/app-scoped
entry from the pasted Console URL. It extracts site/app slugs directly; `.env`
is optional for OAuth and existing runtime scope metadata must not conflict. Reconnect in Kiro's MCP server view,
verify with `get_sites` and `get_apps`, then record live scope for this session as
described in the preflight steering. Local checks never prove OAuth login succeeded.
