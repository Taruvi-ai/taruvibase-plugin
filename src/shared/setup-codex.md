The plugin bundles a secret-free Taruvi URL. For a workspace-specific connection,
configure the active trusted project `.codex/config.toml`:

```toml
[mcp_servers.taruvi]
url = "https://mcp.taruvibase.com/mcp?siteId=<site-slug>&appId=<app-slug>"
```

Use the complete URL extracted from the pasted Console configuration in place
of the example URL; do not ask the user to fill placeholders or find slugs. Remove legacy `http_headers`
and `bearer_token_env_var` on this entry. Use `codex mcp login taruvi` (or the
actual discovered plugin server name) and complete consent in the browser.
Use `codex mcp list` to verify which entry is active; disable an unscoped duplicate.
Reload the session before verifying tools. Tokens belong to Codex's credential store.
