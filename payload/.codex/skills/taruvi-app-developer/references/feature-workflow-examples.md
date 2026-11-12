# Feature workflow examples

> MCP compatibility: legacy action-based tool examples below apply only to the
> tenant API-key MCP. For OAuth Worker calls, first read the [current tool guide](mcp-tool-quickref.md)
> and use discovered input schemas. Runtime SDK examples remain separate.

Three worked examples showing the full cross-layer workflow. Use these as templates.

## Example 1: Add a comments feature to a blog app

**Spec**: Users can comment on blog posts. Comments belong to posts. Author of a comment can edit/delete their own. Any logged-in user can create a comment. Nobody can read unapproved comments except staff.

### Plan

```
Backend (MCP):
- Datatables:
  - NEW: comments (id, post_id FK→posts, author_id FK→authors, body, approved:boolean, created_at)
- Policies:
  - NEW: policy for resource "datatable:comments":
    - read/list: role "user" if R.attr.approved == true; role "staff" always
    - create: role "user"
    - update/delete: derivedRole "owner" (author_id == P.id)
- Roles: no changes
- Functions: none
- Secrets: none

Functions:
- None

Frontend (Refine):
- Resources to add to resources[]:
  - { name: "comments" }
- Pages:
  - comments list (embedded in post show page, filtered by post_id)
  - comments create form (inline on post show)
- Access control:
  - useCan for "delete" action on each comment row
  - meta.allowedActions: ["update", "delete"] on list query

Verification:
- Create comment as user — shows up after approval
- Delete someone else's comment — 403
- Staff sees unapproved comments
```

### Execute

**Step 1: backend** (delegate to `taruvi-app-developer`).

1. Inspect existing `posts` and `authors` schemas:
   ```
   get_datatable_schema(table_name="posts")
   get_datatable_schema(table_name="authors")
   ```

2. Create the `comments` table (include existing tables in the datapackage only if modifying; otherwise a standalone resource is fine):
   ```
   create_update_schema(datapackage={
     "resources": [
       {
         "name": "comments",
         "schema": {
           "fields": [
             {"name": "id", "type": "integer", "constraints": {"required": true}},
             {"name": "post_id", "type": "integer", "constraints": {"required": true}},
             {"name": "author_id", "type": "integer", "constraints": {"required": true}},
             {"name": "body", "type": "string", "constraints": {"required": true}},
             {"name": "approved", "type": "boolean"},
             {"name": "created_at", "type": "datetime", "constraints": {"required": true}}
           ],
           "primaryKey": ["id"],
           "foreignKeys": [
             {"fields": ["post_id"], "reference": {"resource": "posts", "fields": ["id"]}},
             {"fields": ["author_id"], "reference": {"resource": "authors", "fields": ["id"]}}
           ],
           "indexes": [
             {"fields": ["post_id", "approved"]},
             {"fields": ["author_id"]}
           ]
         }
       }
     ]
   })
   ```

3. Create the policy:
   ```
   manage_policies(action="create_update", policy_data={
     "apiVersion": "api.cerbos.dev/v1",
     "resourcePolicy": {
       "resource": "datatable:comments",
       "version": "default",
       "rules": [
         {
           "actions": ["read", "list"],
           "effect": "EFFECT_ALLOW",
           "roles": ["user"],
           "condition": {"match": {"expr": "R.attr.approved == true"}}
         },
         {
           "actions": ["read", "list"],
           "effect": "EFFECT_ALLOW",
           "roles": ["staff"]
         },
         {
           "actions": ["create"],
           "effect": "EFFECT_ALLOW",
           "roles": ["user"]
         },
         {
           "actions": ["update", "delete"],
           "effect": "EFFECT_ALLOW",
           "roles": ["user"],
           "condition": {"match": {"expr": "R.attr.author_id == P.id"}}
         }
       ]
     }
   })
   ```

**Step 2: frontend** (delegate to `taruvi-refine-providers`).

Add `{ name: "comments" }` to `resources[]` in `App.tsx`. Then create `src/pages/comments/list.tsx` with `useList({ resource: "comments", filters: [{ field: "post_id", operator: "eq", value: postId }], meta: { allowedActions: ["update", "delete"] } })`. Embed in post show.

For the create form, use `useCreate` with `meta: { /* no special meta */ }`. Author_id auto-set by the backend.

For per-row delete: check `comment._allowed_actions.includes("delete")`.

**Step 3: verify**. Open the app, create a comment, confirm policy gating.

---

## Example 2: Add a scheduled function that expires old sessions

**Spec**: Daily, delete session rows where `expires_at < now() - 7 days`. Schedule via cron.

### Plan

```
Backend (MCP):
- Datatables:
  - No changes (sessions table already exists)
- Policies:
  - No changes
- Roles:
  - No changes
- Functions:
  - NEW: cleanup-expired-sessions (execution_mode=app, is_active=true)
- Secrets:
  - Already exists: SCHEDULER_SERVICE_KEY

Functions:
- Body for cleanup-expired-sessions (Python)

Frontend (Refine):
- No changes

Verification:
- Manually invoke cleanup-expired-sessions — confirms logic
- Schedule via cron (outside this MCP surface)
```

### Execute

**Step 1: register function metadata** (`taruvi-app-developer`):

```
manage_function(action="create_update",
  name="cleanup-expired-sessions",
  execution_mode="app",
  code="<placeholder>",  # will overwrite in step 2
  description="Daily cleanup of expired session rows",
  is_active=True,
  async_mode=False,
)
```

**Step 2: write body** (`taruvi-app-developer`, function-authoring section):

Use the scheduled-cleanup pattern from [`function-scenarios.md`](function-scenarios.md). Adapt:

```python
from datetime import datetime, timedelta, timezone

def main(params, user_data, sdk_client):
    service_key = sdk_client.secrets.get("SCHEDULER_SERVICE_KEY")["value"]
    admin_client = sdk_client.auth.signInWithToken(
        token=service_key,
        token_type="api_key",
    )

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    result = (admin_client.database
        .from_("sessions")
        .filter("expires_at", "lt", cutoff)
        .deleteFiltered()
        .execute()
    )

    deleted = result.get("deleted_count", 0)
    log("info", "Expired sessions cleaned", count=deleted, cutoff=cutoff)

    return {"status": "ok", "deleted": deleted}
```

**Step 3: re-register with real body** (back to `taruvi-app-developer`):

```
manage_function(action="create_update",
  function_slug="cleanup-expired-sessions",
  code=<body-above>,
)
```

**Step 4: test** (`taruvi-app-developer`):

```
execute_function(function_slug="cleanup-expired-sessions", params={}, async_mode=False)
```

Check the response for `deleted: N`. If it errors, read the `logs` in the response.

**Step 5: schedule**. Taruvi's MCP doesn't schedule — use Django-admin cron or a `django-celery-beat` periodic task added via Django admin. Document in the app's `AGENTS.md`.

---

## Example 3: Add a file-upload page for user avatars

**Spec**: Users can upload an avatar image. Only the user can update their own. Stored in a private bucket `user-avatars`. Max 2MB.

### Plan

```
Backend (MCP):
- Datatables:
  - MODIFY: users (add avatar_path: string nullable)
- Storage:
  - NEW bucket: user-avatars (visibility=private, app_category=assets, max_size_bytes=2097152)
- Policies:
  - MODIFY: datatable:users — add update action scoped to owner only
  - NEW: bucket:user-avatars — user can read/write own prefix
- Functions:
  - None (direct upload via SDK)
- Secrets:
  - None

Frontend (Refine):
- Components:
  - AvatarUpload component using useCreate on storage provider
  - Avatar display reading from users.avatar_path

Verification:
- Upload via UI
- Attempt to upload for another user (should 403)
- Confirm avatar renders in profile
```

### Execute

**Step 1: modify `users` schema** (`taruvi-app-developer`):

```
get_datatable_schema(table_name="users")   # inspect current
# ... preserve all existing fields + add avatar_path
create_update_schema(datapackage={
  "resources": [
    {
      "name": "users",
      "schema": {
        "fields": [
          <all existing fields preserved>,
          {"name": "avatar_path", "type": "string", "constraints": {"maxLength": 500}}
        ],
        "primaryKey": ["id"]
      }
    }
  ]
})
```

**Step 2: create bucket** (`taruvi-app-developer`):

```
manage_storage(action="create_bucket",
  name="user-avatars",
  visibility="private",
  app_category="assets",
  max_size_bytes=2097152,
)
```

**Step 3: update policies** (`taruvi-app-developer`):

Get current `datatable:users` policy, append an update rule:

```
manage_policies(action="get", policy_id="datatable:users:default")
# modify rules in place, then:
manage_policies(action="create_update", policy_data={...existing with new rule...})
```

Create `bucket:user-avatars` policy:

```
manage_policies(action="create_update", policy_data={
  "apiVersion": "api.cerbos.dev/v1",
  "resourcePolicy": {
    "resource": "bucket:user-avatars",
    "version": "default",
    "rules": [
      {
        "actions": ["read", "write"],
        "effect": "EFFECT_ALLOW",
        "roles": ["user"],
        "condition": {"match": {"expr": "R.attr.path.startsWith(string(P.id) + '/')"}}
      },
      {
        "actions": ["read"],
        "effect": "EFFECT_ALLOW",
        "roles": ["staff"]
      }
    ]
  }
})
```

**Step 4: build upload UI** (`taruvi-refine-providers`):

```tsx
import { useCreate, useUpdate, useGetIdentity } from "@refinedev/core";

function AvatarUpload() {
  const { data: identity } = useGetIdentity();
  const { mutate: upload } = useCreate();
  const { mutate: updateUser } = useUpdate();

  const handleFile = (file: File) => {
    upload({
      dataProviderName: "storage",
      resource: "user-avatars",
      values: {
        files: [file],
        paths: [`${identity.id}/avatar.${file.name.split(".").pop()}`],
      },
    }, {
      onSuccess: ({ data }) => {
        updateUser({
          resource: "users",
          id: identity.id,
          values: { avatar_path: data.path },
        });
      },
    });
  };

  return <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files![0])} />;
}
```

**Step 5: verify**.

- Upload your own avatar → works.
- Upload to `other_user_id/` → 403 (policy blocks).
- Profile page renders avatar from `users.avatar_path` via storage download.

## Pattern takeaways

1. **Always inspect before modifying.** `get_datatable_schema`, `manage_policies(action="get")` before any change to existing resources.
2. **Plan first, execute in order.** Schema → storage buckets → policies → function metadata → function bodies → frontend.
3. **Policies for new resources before first write.** A missing policy 403s the first insert.
4. **Keep the plan scoped.** Don't bundle unrelated changes into one feature rollout.
5. **Update AGENTS.md after**. Document new entity vocabulary (comments, sessions, avatars) so the next agent session has the right context.
