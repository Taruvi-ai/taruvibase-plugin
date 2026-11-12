# AGENTS.md

This repository is the TaruviBase plugin for Claude Code, Cursor, Codex, GitHub
Copilot, Gemini CLI, Kiro, VS Code (Open Plugin), and other Agent Plugins hosts.
It follows the shared multi-vendor layout used by
[supabase-plugin](https://github.com/supabase-community/supabase-plugin).

## Layout

- `skills/` — the only copy of the skills. Every vendor manifest points here.
  - `taruvi-app-developer` is synced from its
    source of truth, [Taruvi-ai/taruvi-skills](https://github.com/Taruvi-ai/taruvi-skills).
    `skills/.taruvi-skills-commit` records the synced commit.
  - `taruvi-setup` is owned by this repo.
- `plugin.json` + `mcp.json` — portable [Agent Plugins 1.0](https://agent-plugins.org)
  package. Kiro powers and Codex read these. `extensions.com.openai` holds Codex
  presentation fields.
- `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` — Claude Code.
- `.cursor-plugin/plugin.json` — Cursor.
- `.github/plugin/plugin.json` — GitHub Copilot.
- `.plugin/plugin.json` — vendor-neutral [Open Plugin](https://open-plugins.com/) (VS Code).
- `.agents/plugins/marketplace.json` — Codex marketplace entry.
- `gemini-extension.json` + `TARUVI.md` — Gemini CLI extension.
- `agents/<vendor>/` — vendor-specific MCP config files.

Every MCP config points at the same OAuth server, `https://mcp.taruvibase.com/mcp`,
with no keys or headers. Users sign in through the browser on first use.

## Commands

```bash
npm test                                            # validate every manifest and skill
bash scripts/sync-skills.sh [ref]                   # pull skills from taruvi-skills
npx claude plugin validate .claude-plugin/plugin.json
```

## Editing rules

- Keep `skills/` as real files. Do not replace it with a symlink or submodule.
- Do not edit `skills/taruvi-app-developer`
  here. Change it in `Taruvi-ai/taruvi-skills`, then run
  `bash scripts/sync-skills.sh` (or the **Sync skills** workflow, which also runs
  daily and opens a PR).
- Keep the plugin name `taruvi` and the version identical in every manifest;
  `npm test` fails when they drift.
- Never add API keys, tenant URLs, or other secrets to any manifest or MCP config.
- When changing descriptions or keywords, update every `plugin.json` together.
- Before adding or changing a vendor adapter, read that vendor's official plugin
  documentation and add only the files it requires.
