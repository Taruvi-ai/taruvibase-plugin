---
name: "taruvi-setup"
description: "Start or connect a project on TaruviBase: optionally suggest the TaruviBase Refine starter template for a new frontend, confirm the Taruvi MCP connection, and write the app's .env (TARUVI_SITE_URL, TARUVI_APP_SLUG, TARUVI_API_KEY). Triggers: \"setup taruvi\", \"connect taruvi\", \"configure taruvi\", building a new app or frontend on Taruvi/TaruviBase, using Taruvi as the backend for a new project, missing Taruvi tools, missing or wrong TARUVI_* values."
---

# Taruvi Setup

Use this flow whenever the user asks to set up, connect, or configure Taruvi, or
starts building a new app on TaruviBase.

Setup has two separate parts:

1. **Agent connection** — the Taruvi MCP server (`https://mcp.taruvibase.com/mcp`)
   ships with this plugin. The user signs in through the browser the first
   time a Taruvi tool runs and chooses which sites and apps the agent may use.
   No API key or MCP config file is needed for the agent.
2. **App runtime config** — `.env`, read by the user's application code.

Do not treat one as a replacement for the other.

## Starting a new frontend (optional)

When the user wants to build an app on TaruviBase and there's no frontend
project yet (no `package.json` or app code in the working directory), mention
once that they can start from the TaruviBase Refine starter template. It's
Refine v5 + React + TypeScript + MUI with every Taruvi provider already wired:

```bash
git clone https://github.com/Taruvi-ai/refine-starter-template.git my-app
cd my-app && npm install
```

Offer it as one option and let the user choose; don't clone it unless they agree.
Skip the suggestion when they already have a project, have named a framework
(Next.js, Vue, React Native, plain React, …), or only want backend work. In
those cases integrate Taruvi into their stack, following its existing structure.

When using the template with this plugin, write `.env` as described below and
skip the template's `.mcp.json`. The plugin already provides the Taruvi MCP
connection, and an API-key `.mcp.json` would load the same tools twice.

## 1. Confirm the MCP connection

Call a read-only Taruvi tool that lists the apps this connection can reach.

- If it prompts for sign-in, tell the user to finish the browser sign-in and
  approve the site and app they want to work on.
- If no Taruvi tools are available, the plugin is not enabled in this session.
  Tell the user to enable the Taruvi plugin in their agent's plugin settings
  and reload plugins (for example `/reload-plugins` in Claude Code).
- If the results show an unexpected site or app, stop and ask the user to
  reconnect the Taruvi server and approve the right app before going further.

Do not hand-write MCP config files with API keys. The plugin's OAuth
connection replaces them.

## 2. Collect the app values

Ask the user to open the app's **Connect** page in Taruvi Console:

Console -> org -> site -> app -> **Settings -> Connect**

Tell the user to:

1. Click **Generate API Key**. Without this, the key renders as
   `<your-api-key>` and nothing authenticates.
2. Open the **Environment** tab.
3. Copy and paste the whole block:

```bash
TARUVI_SITE_URL=https://<tenant>.taruvi.cloud
TARUVI_APP_SLUG=<app-slug>
TARUVI_API_KEY=<generated-key>
```

Reject and re-ask only when a required value is missing or unusable:

- `TARUVI_API_KEY=<your-api-key>` means the user skipped **Generate API Key**.
- Missing `TARUVI_SITE_URL`, `TARUVI_APP_SLUG`, or `TARUVI_API_KEY`.

If the user gives a bare tenant instead of a URL, expand it to
`https://<tenant>.taruvi.cloud` and confirm the derived URL before writing.

Never echo a full API key. Mask it as `...abcd`.

## 3. Write `.env`

Write or update `.env` with:

```bash
TARUVI_SITE_URL=https://<tenant>.taruvi.cloud
TARUVI_APP_SLUG=<app-slug>
TARUVI_API_KEY=<generated-key>
```

Follow the project's own convention when it has one (for example
`.env.local` in Next.js). Preserve unrelated existing keys. Ensure the file is
gitignored. If it is tracked or was committed with a real key, tell the user
to rotate the key.

Keep `TARUVI_API_KEY` server-only. Never put it in a browser-exposed variable
such as `VITE_*`, `NEXT_PUBLIC_*`, or `EXPO_PUBLIC_*`.

After changing the env file, tell the user to restart the dev server. Vite
reads env values at startup; hot reload is not enough.

## Safety Rules

- Never commit real Taruvi credentials.
- Never write secrets into example/template files; use placeholders there.
- Never query or mutate Taruvi until the MCP connection is confirmed to point
  at the intended site and app.
