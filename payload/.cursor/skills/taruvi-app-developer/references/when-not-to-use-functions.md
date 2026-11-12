# When NOT to Use Functions

## Decision Rule

**If all of these are true, you do NOT need a function:**
- touches only one resource (one table, one bucket, one user operation)
- no external API calls
- no long-running background work
- browser lifecycle interruption would not corrupt state

## Decision Table

| Need | Use Instead |
|---|---|
| Single-table CRUD (create, read, update, delete) | Refine hooks — `useCreate`, `useUpdate`, `useDelete`, `useList` |
| Data listing with filters, pagination, sorting | `useList` with Taruvi data provider |
| File download / serving only | Storage provider directly |
| Login / signup / logout / session | Auth provider |
| Simple read-only KPI card from one grouped query | Database provider aggregation |
| Single storage upload with metadata | Storage provider directly |

## When a Function IS Required

Force a function when any of these apply:

- Action touches 2+ resources (DB table + storage bucket, users + DB, etc.)
- Need to call an external API using a stored secret
- Operation must complete even if the user closes the browser tab
- Reaction to a data event (`RECORD_CREATE`, `RECORD_DELETE`, etc.)
- Reaction to a user lifecycle event (`POST_USER_CREATE`, etc.)
- Background/scheduled work (cron, batch, report generation)
- Long-running task (>30s)
- Public unauthenticated endpoint
- Authorization check must gate the operation

## Key Principle

Frontend operations are unreliable — if the user navigates away mid-operation, partially completed multi-step mutations leave the database in inconsistent state. Serverless functions run server-side and complete regardless of browser state.
