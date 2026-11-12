# Environment variable setup (consuming Taruvi apps)

Every Taruvi app needs at least three environment variables to connect to the platform. Framework conventions determine the prefix.

## Core three

| Variable (Vite) | Variable (CRA) | Variable (Next.js) | Purpose |
|---|---|---|---|
| `VITE_TARUVI_API_URL` | `REACT_APP_TARUVI_API_URL` | `NEXT_PUBLIC_TARUVI_API_URL` | Taruvi API base, e.g. `https://acme.taruvi.cloud` |
| `VITE_TARUVI_API_KEY` | `REACT_APP_TARUVI_API_KEY` | `NEXT_PUBLIC_TARUVI_API_KEY` | Site/app identifier (not a secret by itself) |
| `VITE_TARUVI_APP_SLUG` | `REACT_APP_TARUVI_APP_SLUG` | `NEXT_PUBLIC_TARUVI_APP_SLUG` | App slug within the tenant |

(Use the prefix matching your framework. All three are baked into the client bundle and are **not** secrets.)

## Optional

| Variable | Purpose |
|---|---|
| `<PREFIX>_TARUVI_DESK_URL` | Override the login/signup redirect base (defaults to `API_URL`) |
| `<PREFIX>_TARUVI_DEFAULT_CALLBACK` | Post-login default return URL |

## For function runtime (server-side)

When writing Taruvi function bodies, the runtime injects:

| Variable | Purpose |
|---|---|
| `TARUVI_FUNCTION_RUNTIME` | Always `"true"` inside a function runtime |
| `TARUVI_TENANT` | Tenant slug this function belongs to |
| `TARUVI_API_URL` | API URL (no framework prefix) |
| `TARUVI_APP_SLUG` | App slug |

You don't set these — the runtime does. They're there for the Python SDK's auto-detection.

## `.env.example` template

```bash
# Taruvi connection
VITE_TARUVI_API_URL=https://your-tenant.taruvi.cloud
VITE_TARUVI_API_KEY=your-site-key-here
VITE_TARUVI_APP_SLUG=your-app-slug

# Optional
# VITE_TARUVI_DESK_URL=https://your-tenant.taruvi.cloud
# VITE_TARUVI_DEFAULT_CALLBACK=/dashboard

# Local dev only — if running against a non-standard tenant
# TARUVI_X_TENANT_HEADER=your-tenant
```

Commit `.env.example` with dummy values. Never commit `.env.local` / `.env` with real values.

## Local dev against a specific tenant

If the tenant doesn't resolve via subdomain in your dev environment, pass `X-Tenant` header via a dev proxy:

**Vite `vite.config.ts`**:
```typescript
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        headers: {
          "X-Tenant": "your-tenant-slug",
        },
      },
    },
  },
});
```

Then use a relative `VITE_TARUVI_API_URL=""` or `/` and let the proxy route.

## CI/production

In CI, set the envs in your pipeline config. For production:

- Vite: inject at build time (`VITE_` vars are baked into the bundle).
- Next.js: `NEXT_PUBLIC_*` vars at build, server-only vars at runtime.
- Docker: pass via `--env-file .env.production` or orchestrator (Kubernetes ConfigMap).

## Secrets that SHOULDN'T be env vars

Session tokens, user credentials, service JWTs — never put these in env. They belong in Taruvi secrets (via MCP) or fetched at runtime.

An exception: an initial setup token or bootstrap credential that your CI uses for deploy-time provisioning. Pass via CI-only env, not in the runtime app.
