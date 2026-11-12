# Deploying a Taruvi frontend app

Taruvi hosts built Refine/Vite/React frontends as **Frontend Workers**. The deploy flow is: build locally → zip `dist/` → upload to Taruvi → activate the new build.

This page documents the API surface and env vars. The actual deploy script varies by project — teams typically commit a `deploy-frontend.mjs` or similar under `scripts/` in the consuming app. If the user doesn't have one, offer to scaffold one using this reference.

## Workflow

1. Confirm the project builds cleanly: `npm run build` (or `pnpm build`) produces a `dist/` folder.
2. Zip `dist/` into an archive (e.g., `build-<timestamp>.zip`).
3. Resolve or create the Frontend Worker record on Taruvi.
4. Upload the zip as the worker's new build (multipart POST or PATCH).
5. Activate the new build via `set-active-build`.

Offer a `--dry-run` mode in any scripting that validates build + zip without touching Taruvi.

## Environment variable mapping

The deploy script reads auth and routing config from the consuming app's `.env` / `.env.local`:

| Env var | Used as | Notes |
|---|---|---|
| `TARUVI_API_KEY` | `Authorization: Api-Key <value>` header | **Never log or echo.** Sensitive. |
| `TARUVI_APP_SLUG` | First-choice worker `name` + default multipart `app` field | Same slug the frontend uses at runtime |
| `TARUVI_SITE_URL` | Infer the site from the hostname when `--site` is not passed | e.g., `https://acme.taruvi.cloud` → site `acme` |
| `TARUVI_FRONTEND_WORKER_SITE` | Explicit override for the Taruvi site name | Use when the URL-inferred site is wrong |
| `TARUVI_FRONTEND_WORKER_APP` | Override for the multipart `app` field | Defaults to `TARUVI_APP_SLUG` |

## API endpoints

All requests target the Taruvi cloud API under the resolved site:

```
# List / create worker
POST https://api.taruvi.cloud/sites/<site>/api/cloud/frontend_workers/

# Detail / patch (replace the build file for an existing worker)
GET|PATCH https://api.taruvi.cloud/sites/<site>/api/cloud/frontend_workers/<worker-id-or-slug>/

# Activate a specific uploaded build
POST https://api.taruvi.cloud/sites/<site>/api/cloud/frontend_workers/<worker-id-or-slug>/set-active-build/
```

### Multipart fields

- **Create** (`POST`): `name`, `is_internal`, `app`, `file` (the zip).
- **Patch** (`PATCH`): `file` (replace the build file; other fields optional).
- **Set active build** (`POST /set-active-build/`): JSON body `{"build_uuid": "..."}`.

## Worker name selection

1. Try `TARUVI_APP_SLUG` as the worker name first.
2. Search existing workers for an exact name match — if found, PATCH it (don't create a duplicate).
3. If create fails because the name already exists, search again and PATCH.
4. If create fails because the name is invalid (too short, disallowed chars), retry with `<app-slug>-<timestamp>`.

This keeps one worker per app under the canonical slug while tolerating the race where two deploys collide on name creation.

## Safety rules

- **Never print the API key** in logs, error messages, or CI output. Redact if echoing env.
- **Stop on build failure.** Don't upload a stale `dist/` because the new build failed.
- **Don't upload if `dist/` is missing or empty.** Confirm size > some threshold (e.g., 10 KB) before zipping.
- **Delete the zip** after upload unless a `--keep-zip` flag was passed (it contains the full build).
- **Set `XDG_CONFIG_HOME` to a project-local directory** inside the build step if `refine build` or similar tooling fails on machines where home-directory config writes are blocked.

## When to hand off

If the user asks "deploy my Taruvi app" and there's no deploy script in the repo:

1. Offer to scaffold one using this reference.
2. Confirm the env vars above are set in `.env.local` or the CI secret store.
3. Run the build + upload flow.

If a deploy script already exists in the repo:

1. Read it first — don't rewrite what's there.
2. Confirm the env var names match the table above (or document the aliases).
3. Run it.

## Gotchas

1. **Unauthenticated 401 on upload** — usually a missing or stale `TARUVI_API_KEY`. The key may have been rotated. Never swap in a JWT token here; API keys are distinct.
2. **Wrong site inferred** — if `TARUVI_SITE_URL` is set to a non-standard URL, pass `--site <slug>` explicitly or override with `TARUVI_FRONTEND_WORKER_SITE`.
3. **Duplicate worker names** — retry logic above; don't manually rename unless the script fails twice.
4. **Build size limits** — if `dist/` exceeds the platform's zip size cap, remove source maps or unnecessary assets before retrying. Don't silently truncate the zip.
5. **Set-active-build silently succeeds with no users on the new build** — confirm a post-deploy HTTP check against the worker URL before declaring the deploy done.
