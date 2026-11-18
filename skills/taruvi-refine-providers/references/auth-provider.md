# Auth Provider

Redirect-based authentication using Taruvi's Web UI Flow.

## Setup

```tsx
<Refine authProvider={authProvider(client)} />
```

## Auth Flow

1. `login()` → redirects to backend `/accounts/login/`
2. User authenticates on backend
3. Backend redirects back with tokens in URL hash
4. Client extracts and stores tokens automatically

## Login

```tsx
const { mutate: login } = useLogin();
login({ callbackUrl: "/dashboard" });
// Redirects to backend login page; no direct return value
```

## Logout

```tsx
const { mutate: logout } = useLogout();
logout({ callbackUrl: "/login" });
```

## Register

```tsx
const { mutate: register } = useRegister();
register({ callbackUrl: "/welcome" });
```

## Get Current User

```tsx
const { data: user } = useGetIdentity<UserData>();
// user.username, user.email, user.first_name, user.last_name, ...
```

## Get Permissions

```tsx
const { data: permissions } = usePermissions();
// permissions.roles, permissions.permissions, permissions.groups
// permissions.is_staff, permissions.is_superuser
```

## Auth Check Behavior

- `check()` returns `{ authenticated: true }` if a session token exists, otherwise redirects to `/login`
- `onError()` returns `{ logout: true, redirectTo: "/login" }` for 401/403 (tokens already cleared by SDK interceptor). Other errors pass through.

## Parameter Types

```tsx
import type { LoginParams, LogoutParams, RegisterParams } from "@taruvi/refine-providers";

// LoginParams:   { callbackUrl?: string; username?: string; password?: string; redirect?: boolean }
// LogoutParams:  { callbackUrl?: string }
// RegisterParams:{ callbackUrl?: string }
```
