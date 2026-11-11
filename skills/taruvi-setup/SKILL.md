---
name: "taruvi-setup"
description: "Start or connect a project on TaruviBase: optionally suggest the TaruviBase Refine starter template for a new frontend, confirm the Taruvi MCP connection, and write the app's .env with the site URL and app slug taken from the MCP connection (TARUVI_SITE_URL, TARUVI_APP_SLUG; TARUVI_API_KEY only for server-side code). Triggers: \"setup taruvi\", \"connect taruvi\", \"configure taruvi\", building a new app or frontend on Taruvi/TaruviBase, using Taruvi as the backend for a new project, missing Taruvi tools, missing or wrong TARUVI_* values."
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

Call a read-only Taruvi tool that lists the sites this connection covers.

- If it prompts for sign-in, tell the user to finish the browser sign-in and
  approve the site and app they want to work on.
- If no Taruvi tools are available, the plugin is not enabled in this session.
  Tell the user to enable the Taruvi plugin in their agent's plugin settings
  and reload plugins (for example `/reload-plugins` in Claude Code).

Do not hand-write MCP config files with API keys. The plugin's OAuth
connection replaces them.

## 2. Pick the site and app from the MCP

Get the app's values from the MCP connection. Don't ask the user to copy them
from Console.

1. **Site.** List the sites the connection covers. If there's exactly one, use
   it. If there are several, show their names and primary domains and ask the
   user which one; don't guess.
2. **App.** List the apps in that site. If there's exactly one, use it.
   Otherwise show their names and ask which one. If the user names an app,
   match it against the list instead of trusting the spelling.
3. **Confirm** in one line before writing, for example:
   `Site: acme (https://acme.taruvibase.cloud) · App: crm`.

Derive the values:

- `TARUVI_SITE_URL` = `https://` + the site's **primary domain**, exactly as the
  MCP returns it. Domains differ between sites (`*.taruvibase.cloud`,
  `*.taruvi.cloud`, custom domains), so never build the URL from the site slug.
- `TARUVI_APP_SLUG` = the app's **slug** (not its display name).

If the site or app the user wants isn't in the lists, the connection wasn't
approved for it. Ask the user to reconnect the Taruvi server and approve that
site and app; don't fall back to guessed values.

### API key: only for server-side code

The MCP connection can't create API keys, and the browser app doesn't need one;
the frontend client needs only the site URL and app slug. Ask for
`TARUVI_API_KEY` only when the project has server-side code that calls Taruvi
(a backend, SSR routes, scripts, or CI jobs). Then tell the user to open
Console -> org -> site -> app -> **Settings -> Connect**, click
**Generate API Key**, and paste just the key. A value of `<your-api-key>` means
they skipped **Generate API Key**. Never echo a full API key; mask it as
`...abcd`.

## 3. Write `.env`

Write or update `.env` with:

```bash
TARUVI_SITE_URL=https://<primary-domain>
TARUVI_APP_SLUG=<app-slug>
# Only when server-side code needs it:
TARUVI_API_KEY=<generated-key>
```

Follow the project's own convention when it has one: its existing variable
names and prefixes (for example `VITE_` in Vite or `NEXT_PUBLIC_` in Next.js
for the URL and slug), and `.env.local` in Next.js. Preserve unrelated existing
keys. Ensure the file is gitignored. If it is tracked or was committed with a
real key, tell the user to rotate the key.

Keep `TARUVI_API_KEY` server-only. Never put it in a browser-exposed variable
such as `VITE_*`, `NEXT_PUBLIC_*`, or `EXPO_PUBLIC_*`.

After changing the env file, tell the user to restart the dev server. Vite
reads env values at startup; hot reload is not enough.

## Safety Rules

- Never commit real Taruvi credentials.
- Never write secrets into example/template files; use placeholders there.
- Never query or mutate Taruvi until the MCP connection is confirmed to point
  at the intended site and app.
