# TaruviBase extension for Gemini CLI

This extension connects Gemini CLI to the TaruviBase MCP server
(`https://mcp.taruvibase.com/mcp`) and bundles TaruviBase skills. The first time a
TaruviBase tool runs, Gemini opens the browser so you can sign in and choose which
sites and apps the agent may use.

## Which skill to use

- `taruvi-setup` — "setup taruvi" or starting a new app: optionally suggest the starter
  template, confirm the MCP connection, and write the app's `.env` from the
  site and app the MCP connection covers.
- `taruvi-app-developer` — backend work: datatables, access policies, roles, users,
  storage, secrets, analytics queries, and Python function bodies.

Load the matching skill and its references before writing code. Do not implement
TaruviBase calls from memory.

## Starting a new frontend

If the user wants to build an app on TaruviBase and has no frontend project or chosen
stack yet, mention once that they can start from the
[TaruviBase Refine starter template](https://github.com/Taruvi-ai/refine-starter-template)
(Refine v5 + React + MUI, providers pre-wired). It's optional; integrate into the
user's existing project or preferred framework otherwise. With this extension
installed, skip the template's `.mcp.json`.

## Safety

- Confirm the connected site and app with a read-only tool before any mutation.
- Never put `TARUVI_API_KEY` in browser-exposed variables or commit it.
