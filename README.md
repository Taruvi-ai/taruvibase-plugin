# TaruviBase Agent Plugin

Official TaruviBase plugin for Claude Code, Cursor, Codex, GitHub Copilot, Gemini
CLI, Kiro, and other AI coding agents. It gives your agent:

- the TaruviBase MCP server (`https://mcp.taruvibase.com/mcp`) to manage your app's
  tables, records, functions, policies, storage, secrets, and queries
- `taruvi-app-developer` for backend work
- `taruvi-setup` to connect a project and write its `.env`

## Getting started

Install the plugin for your agent. The first time your agent uses a TaruviBase
tool, it opens your browser so you can sign in and approve the sites and apps it
may use. There is no API key to paste into MCP config.

| Agent | Install |
|---|---|
| Any supported agent | `npx plugins add Taruvi-ai/taruvibase-plugin` |
| Claude Code | `/plugin marketplace add Taruvi-ai/taruvibase-plugin`, then `/plugin install taruvi@taruvi` |
| Codex | `codex plugin marketplace add Taruvi-ai/taruvibase-plugin`, then install from the Plugins Directory |
| GitHub Copilot CLI | `copilot plugin install Taruvi-ai/taruvibase-plugin` |
| Gemini CLI | `gemini extensions install https://github.com/Taruvi-ai/taruvibase-plugin` |
| Kiro | Powers → **Add Custom Power** → **Import power from GitHub** → repository URL |

Then ask your agent:

```text
setup taruvi
```

It confirms the MCP connection and writes your app's `.env` from the values on the
app's **Settings → Connect** page in TaruviBase Console.

Starting a new web app? You can clone the
[TaruviBase Refine starter template](https://github.com/Taruvi-ai/refine-starter-template)
(Refine v5 + React + MUI, providers pre-wired), or use any framework you like.

If you already added the TaruviBase MCP server by hand, remove it after installing
the plugin so your agent doesn't load the same tools twice.

## Repository structure

See [AGENTS.md](AGENTS.md). In short: `skills/` is shared by every agent, and
each agent has a thin manifest that points at it and at the shared MCP server.

## Develop

```bash
npm test
```
