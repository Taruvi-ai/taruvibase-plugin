Use a native HTTP entry (`type: "http"`, `url: <scoped URL>`) with no auth headers.
A loaded plugin reads `.mcp.json` inside its plugin root. Without plugin loading,
project MCP entries belong in project-root `.mcp.json`, not `.claude/.mcp.json`.
Use `/mcp` to authenticate the actual loaded Taruvi server. Reload the plugin or
restart after changing its URL. Avoid keeping both scoped and unscoped copies active.
