# Taruvi Agents Plugin

Shared Taruvi skills and client adapters for Claude, Codex, Cursor, and Kiro.
[Agent Plugins 1.0.0](https://agent-plugins.org/specification) is the source of
truth for the portable package; vendor documentation governs native adapters.

## Distribution modes

| Package root | Format | Contents |
| --- | --- | --- |
| Repository root | Portable Agent Plugins 1.0.0 | Two product skills; OAuth MCP endpoint |
| `payload/.claude` | Claude plugin | Product, setup, and Context7 skills; native MCP template |
| `payload/.codex` | Codex compatibility plugin | Product, setup, and Context7 skills; Taruvi OAuth and Context7 MCP |
| `payload/.cursor` | Cursor plugin | Product/setup skills, rules, commands, agent, MCP template |
| `payload/.kiro` | Portable Kiro Power + workspace support files | Product/setup skills, OAuth MCP; separate workspace template, hooks, steering, scripts |

Every vendor root contains real copies of its skills and support files. Copying
one vendor directory is sufficient; no sibling directory or escaping symlink is
needed. The installer also copies shared skills/hooks into `.agents` for clients
that use that discovery location. Client-specific plugin activation remains a
separate step; copying workspace files does not activate a marketplace plugin.

Portable `mcp.json` declares the stable OAuth endpoint using the standard
`streamable-http` transport. Native adapters use each vendor's supported shape.
Clients manage OAuth discovery, consent and refresh; no Taruvi secrets are bundled.
Before app work, pin the connection with `siteId` and `appId` URL parameters.
See [OAuth migration](docs/oauth-migration.md) for setup, platform contract and
release verification. Existing local configurations are preserved on upgrade and
must be migrated explicitly.

## Install into a Taruvi template

```bash
npx @taruvi/agents-plugin install
```

The target must contain `package.json`, `src/taruviClient.ts`, `AGENTS.md`, and
`UI_Guidelines.md`. Use `--target <directory>` to select another target, or
`--allow-non-template` to explicitly bypass that check.

The installer writes `.agents`, `.claude`, `.codex`, `.cursor`, and `.kiro`
support files and updates `.gitignore`. It does not create `.env` or write
credentials. Open the agent, activate its plugin if needed, and say `setup taruvi`.

### Upgrades and local edits

- Existing MCP configuration is always preserved, including with `--force`.
  Setup merges configuration; it must not delete unrelated servers.
- Unmodified files recorded by this installer upgrade automatically.
- Modified or unmanaged support files cause a conflict before any writes.
  Review the listed paths and use `--force` to back them up and replace them.
- Backups and ownership hashes live in ignored `.taruvi-agents-plugin/`.
  Restore a backup by copying the desired file back into the project.
- Exact per-skill links and the Kiro script link emitted by the previous
  installer migrate to real directories. The legacy `.kiro/skills ->
  ../.codex/skills` folder link also migrates: existing skills and support files
  are copied before Codex updates, with conflicts handled by the same backup
  rules. Contained support links become real files; escaping, cyclic or broken
  links are rejected before writes. Other destination symlinks are refused.
- Existing files no longer shipped by the plugin are retained. Review obsolete
  hooks explicitly rather than deleting unrelated project files automatically.

The first upgrade from an installation without an ownership record may need
`--force` for changed support files. Configuration is still preserved.

## Development and validation

Edit `src/skills`, `src/hooks`, `src/shared/setup-core.md`, and `src/vendors`.
Do not edit generated `skills/` or `payload/` directly.

```bash
npm ci
npm run build:vendor-files
npm test
npm run test:package
npm run check:generated
```

Validation uses pinned official JSON Schemas, a YAML parser, semantic URL/path
checks, vendor configuration checks, and negative fixtures. Tests use fresh
temporary directories and cover reinstallation, conflicts, backups, legacy-link
migration, credential preservation, scope guards, independent vendor copies,
and the extracted npm archive. No real credentials or remote mutations are used.

`check:generated` rebuilds and fails when generated content was stale. CI runs it
before the tests on Linux/macOS with Node 18 and 22 and Python 3.10. Development
requires Node >=18, npm, Bash, Python >=3.10, and tar for archive testing.
Windows and live client loading/authentication are not certified by these tests.

## Live client release checks

Before claiming support for a specific client release, record its version and:

1. Install an isolated vendor package using that client's documented workflow.
2. Confirm both product skills, the setup skill, and local references load.
3. Configure a disposable Taruvi app and verify a harmless read targets it.
4. Test reload/reconnect, an absent optional Context7 key, and a second install.
5. For Kiro workspace hooks, test both read-only verification and blocked writes
   with a missing, wrong, changed, or disabled connection.

The Kiro guard checks local configuration and session-bound attestations. It
cannot inspect the client's live MCP connection; the agent/operator must verify
live scope before recording confirmation. Server authorization remains essential.
