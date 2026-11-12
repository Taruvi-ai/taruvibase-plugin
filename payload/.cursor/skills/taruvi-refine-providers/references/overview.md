# @taruvi/refine-providers — Overview

Refine.dev data providers for Taruvi. Bridges Refine hooks (`useList`, `useOne`, `useCreate`, etc.) with the Taruvi backend via `@taruvi/sdk`.

## Installation

```bash
npm install @taruvi/refine-providers @taruvi/sdk @refinedev/core
```

## Quick Start

```tsx
import { Refine } from "@refinedev/core";
import { Client } from "@taruvi/sdk";
import {
  dataProvider,
  storageDataProvider,
  appDataProvider,
  userDataProvider,
  authProvider,
  accessControlProvider,
} from "@taruvi/refine-providers";

const client = new Client({
  apiKey: import.meta.env.VITE_TARUVI_API_KEY,
  appSlug: import.meta.env.VITE_TARUVI_APP_SLUG,
  apiUrl: import.meta.env.VITE_TARUVI_API_URL,
});

function App() {
  return (
    <Refine
      dataProvider={{
        default: dataProvider(client),
        storage: storageDataProvider(client),
        app: appDataProvider(client),
        user: userDataProvider(client),
      }}
      authProvider={authProvider(client)}
      accessControlProvider={accessControlProvider(client)}
      resources={[{ name: "posts" }]}
    >
      {/* Your app */}
    </Refine>
  );
}
```

## Provider Map

| Provider | `dataProviderName` | Reference File | Key Operations |
|---|---|---|---|
| `dataProvider` | `"default"` | `database-provider.md` | CRUD, filters, sorting, aggregation, graph edges |
| `storageDataProvider` | `"storage"` | `storage-provider.md` | Upload, download, batch delete, metadata, filters |
| `appDataProvider` | `"app"` | `app-provider.md` | Roles, settings, secrets, function execution, analytics |
| `userDataProvider` | `"user"` | `user-provider.md` | User CRUD, roles, apps |
| `authProvider` | — | `auth-provider.md` | Login/logout/register, token flow, identity, permissions |
| `accessControlProvider` | — | `access-control-provider.md` | `useCan`, `CanAccess`, prefixed ACL resources, batching |

## Key Rules

- Use `appDataProvider` + `useCustom` for function/analytics execution — not the deprecated `functionsDataProvider`.
- Graph mode activates automatically when `format`, `include`, `depth`, or `graph_types` is present in `meta`.
- `storageDataProvider` expects bucket name as the `resource` value.
- `accessControlProvider` batches `useCan` calls automatically — do not debounce manually.
- For types (`TaruviMeta`, `StorageUploadVariables`, `FunctionMeta`, etc.) see `types-and-utilities.md`.
