# Backend Export

Export backend configuration to `.taruvi-backend/` for version control.

## When to use

- User says "export backend", "backup app config", "sync backend to repo"
- Before major changes to preserve a restore point
- To version control backend configuration alongside frontend code

## Steps

1. Read `.env` or `.env.local` to get `TARUVI_SITE_URL`, `TARUVI_API_KEY`, `TARUVI_APP_SLUG`
2. Run the export script (path relative to project root):
   ```bash
   node skills/taruvi-app-developer/scripts/export-backend.js "$TARUVI_SITE_URL" "$TARUVI_API_KEY" "$TARUVI_APP_SLUG"
   ```
3. Tell user to commit the `.taruvi-backend/` folder

## Cross-platform

The script is written in Node.js and works on Linux, macOS, and Windows without additional dependencies.

## What gets exported

The script exports:
- App roles
- Datatables (schemas)
- Functions
- Events
- Widgets
- Secrets (metadata only, not values)
- Policies
- Analytics queries
- Storage bucket configs

## Output structure

```
.taruvi-backend/
├── app.json           # App metadata
├── datatables/        # Table schemas
├── functions/         # Function code and config
├── policies/          # Cerbos policies
├── roles/             # Role definitions
└── ...
```
