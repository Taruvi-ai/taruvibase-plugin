Use a remote entry with only `url: <scoped URL>` in the active `mcp.json`.
Workspace configuration belongs in `.cursor/mcp.json`. Taruvi no longer requires
plugin variables for tenant, API key or app. Authenticate through Cursor's MCP
server controls and reconnect after changes. Dynamic registration is supported;
do not invent static `auth.CLIENT_ID` or `auth.CLIENT_SECRET` values. Context7's
optional configuration remains independent.
