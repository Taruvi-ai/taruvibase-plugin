# Frontend Worker Deploy

Build the project, zip `dist/`, and deploy it to Taruvi Frontend Workers using the bundled script.

## Workflow

1. Read `.env` or `.env.local` to get `TARUVI_SITE_URL`, `TARUVI_API_KEY`, `TARUVI_APP_SLUG`
2. Build the app: `npm run build`
3. Zip the dist folder: `zip -r dist.zip dist/` (or use a zip tool on Windows)
4. Run the deploy script (path relative to project root):
   ```bash
   node skills/taruvi-app-developer/scripts/deploy-frontend.js "$TARUVI_SITE_URL" "$TARUVI_API_KEY" "$TARUVI_APP_SLUG"
   ```
5. Clean up: `rm -f dist.zip` (or delete manually on Windows)

## Environment Variables

| Env Var | Used As |
|---|---|
| `TARUVI_API_KEY` | `Authorization: Api-Key <value>` header. **Never log or echo.** |
| `TARUVI_APP_SLUG` | Worker name and app identifier |
| `TARUVI_SITE_URL` | Base URL for API calls |

## How the Script Works

1. Checks if `dist.zip` exists (fails if not)
2. Fetches app settings to find existing worker slug
3. If worker exists: uploads new build and activates it
4. If no worker: creates new worker with app slug as subdomain
5. Reports success with build UUID or worker slug

## Worker Name Selection

1. Uses `TARUVI_APP_SLUG` as the worker name
2. If a worker already exists for the app, it patches that worker (no duplicates)
3. New workers are created with `is_internal=true` and subdomain matching the app slug

## Safety Rules

- Never print the API key in logs or responses
- Stop if `dist.zip` is missing
- The script validates responses and reports errors clearly

## Cross-Platform

The script is written in Node.js and works on Linux, macOS, and Windows without additional dependencies.

## Alternative

If the project has `npm run deploy`, use that instead — it handles all steps automatically.
