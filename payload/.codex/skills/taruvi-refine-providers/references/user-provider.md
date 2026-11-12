# User Data Provider

User management: list, get, create, update, delete users via the `"user"` provider.

## Setup

```tsx
<Refine
  dataProvider={{
    default: dataProvider(client),
    user: userDataProvider(client),
  }}
/>
```

## List Users

```tsx
const { result } = useList({
  resource: "users",
  dataProviderName: "user",
  pagination: { currentPage: 1, pageSize: 10 },
  filters: [
    { field: "is_active", operator: "eq", value: true },
    { field: "search", operator: "eq", value: "john" },
  ],
  sorters: [{ field: "username", order: "asc" }],
});
// result.data → User[], result.total → number
```

**Supported filters:**

| Field | Type | Description |
|---|---|---|
| `search` | `string` | Search by username, email, or name |
| `is_active` | `boolean` | Filter by active status |
| `is_staff` | `boolean` | Filter by staff status |
| `is_superuser` | `boolean` | Filter by superuser status |
| `is_deleted` | `boolean` | Filter by deleted status |

## Get User

```tsx
// By username or ID
const { result } = useOne({ resource: "users", dataProviderName: "user", id: "john_doe" });
// result.data → { id, username, email, first_name, last_name, is_active, ... }

// Current authenticated user
const { result } = useOne({ resource: "users", dataProviderName: "user", id: "me" });
```

## Create User

```tsx
const { mutate } = useCreate();
mutate({
  resource: "users",
  dataProviderName: "user",
  values: {
    username: "jane",
    email: "jane@example.com",
    password: "...",
    confirm_password: "...",
    first_name: "Jane",
    last_name: "Doe",
  },
});
```

## Update User

```tsx
const { mutate } = useUpdate();
mutate({
  resource: "users",
  dataProviderName: "user",
  id: "jane",
  values: { first_name: "Jane", last_name: "Doe" },
});
```

## Delete User

```tsx
const { mutate } = useDelete();
mutate({ resource: "users", dataProviderName: "user", id: "jane" });
```

## Get User Roles

```tsx
const { result } = useList({
  resource: "roles",
  dataProviderName: "user",
  meta: { username: "john_doe" },
});
// result.data → [{ id, name, permissions, ... }]
```

## Get User Apps

```tsx
const { result } = useList({
  resource: "apps",
  dataProviderName: "user",
  meta: { username: "john_doe" },
});
// result.data → [{ name, slug, icon, url, display_name }]
```
