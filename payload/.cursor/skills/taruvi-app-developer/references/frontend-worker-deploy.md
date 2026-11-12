# Frontend Worker Deploy

Build the project, zip `dist/`, and deploy it to Taruvi Frontend Workers using the bundled script.

## Workflow

1. Confirm the project root contains `package.json` with a `build` script that produces `dist/`.
2. Run the deploy script:

```bash
node .codex/skills/taruvi-frontend-worker-deploy/scripts/deploy-frontend-worker.mjs \
  --project-root /absolute/path/to/project
```

3. The script infers the site from `TARUVI_SITE_URL` by default. Pass `--site` only to override.
4. Use `--dry-run` to validate the build and zip flow without uploading anything.
5. If build fails due to missing tools, install project dependencies first, then retry.
6. After upload, the script sets the newest build active automatically using `TARUVI_API_KEY`.

## Environment Variable Mapping

| Env Var | Used As |
|---|---|
| `TARUVI_API_KEY` | `Authorization: Api-Key <value>` |
| `TARUVI_APP_SLUG` | Preferred worker name + default `app` multipart field |
| `TARUVI_SITE_URL` | Infer site from hostname when no explicit site is provided |
| `TARUVI_FRONTEND_WORKER_SITE` | Optional override for the Taruvi site name |
| `TARUVI_FRONTEND_WORKER_APP` | Optional override for the multipart `app` field (defaults to `TARUVI_APP_SLUG`) |

Auth is read from the project `.env` or `.env.local`.

## API Endpoints

```
# List / Create
https://api.taruvi.cloud/sites/<site>/api/cloud/frontend_workers/

# Detail / Patch
https://api.taruvi.cloud/sites/<site>/api/cloud/frontend_workers/<worker-id-or-slug>/

# Activate a build
https://api.taruvi.cloud/sites/<site>/api/cloud/frontend_workers/<worker-id-or-slug>/set-active-build/
```

**Create multipart fields:** `name`, `is_internal`, `app`, `file`

**Patch multipart fields:** `file`

**Set-active-build body:** `{ build_uuid: "..." }`

## Worker Name Selection Rules

1. Use `TARUVI_APP_SLUG` as the first-choice worker name.
2. Search the collection for an exact name match before creating a new worker.
3. If a matching worker exists, patch it (don't create a duplicate).
4. If create fails because the name already exists, search again and patch.
5. If create fails because the name is invalid, retry with `<app-slug>-<timestamp>`.

## Safety Rules

- Never print the API key in logs or responses.
- Stop if the build fails or `dist/` is missing.
- Keep the generated zip only when `--keep-zip` is passed.
- The script sets `XDG_CONFIG_HOME` inside the project during builds so `refine build` does not fail on machines where home-directory config writes are blocked.
