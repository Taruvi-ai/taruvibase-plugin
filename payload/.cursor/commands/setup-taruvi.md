---
name: taruvi-setup
description: Configure Taruvi OAuth MCP and separate application runtime settings in Cursor.
---

# Set up Taruvi

Load the `cursor-setup` skill and follow its shared setup and Cursor instructions.
Ask the user to paste the MCP URL or client configuration from Console → org →
site → app → Settings → Connect → MCP Server, with **This app** selected.
Extract environment/site/app from the URL; do not ask for slugs separately.
Configure that URL, authenticate using Cursor's MCP controls, and verify live scope.
Do not request a Taruvi API key for MCP. Runtime `.env` keys are separate.
