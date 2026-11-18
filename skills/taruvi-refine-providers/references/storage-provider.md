# Storage Data Provider

File upload, download, listing, and management via the `"storage"` data provider.

## Setup

```tsx
<Refine
  dataProvider={{
    default: dataProvider(client),
    storage: storageDataProvider(client),
  }}
/>
```

## List Files

```tsx
const { result } = useList({
  resource: "documents", // bucket name
  dataProviderName: "storage",
});
// result.data → StorageObject[], result.total → number
// Each object: { id, path, size, mimetype, visibility, metadata, created_at, ... }
```

## Get File URL

```tsx
const { result } = useOne({
  resource: "documents",
  dataProviderName: "storage",
  id: "uploads/document.pdf", // file path
});
// result.data → { id, path, url, ... } — url is the download URL
```

## Upload Files

```tsx
import type { StorageUploadVariables } from "@taruvi/refine-providers";

const { mutate, mutation } = useCreate<any, any, StorageUploadVariables>();

mutate({
  resource: "documents",
  dataProviderName: "storage",
  values: {
    files: [file1, file2],
    paths: ["file1.pdf", "file2.pdf"],     // optional, defaults to file.name
    metadatas: [{ tag: "report" }, {}],    // optional
  },
});
```

## Batch Upload

```tsx
const { mutate } = useCreateMany<any, any, StorageUploadVariables>();

mutate({
  resource: "documents",
  dataProviderName: "storage",
  values: {
    files: [file1, file2, file3],
    paths: ["report1.pdf", "report2.pdf", "report3.pdf"],
    metadatas: [{ tag: "q1" }, { tag: "q2" }, { tag: "q3" }],
  },
});
```

## Delete Files

```tsx
const { mutate } = useDeleteMany();
mutate({
  resource: "documents",
  dataProviderName: "storage",
  ids: ["path/to/file1.pdf", "path/to/file2.pdf"],
});
```

## Update File Metadata

```tsx
const { mutate } = useUpdate();
mutate({
  resource: "documents",
  dataProviderName: "storage",
  id: "uploads/document.pdf",
  values: {
    metadata: { tag: "reviewed" },
    visibility: "public",
  },
});
```

## Filter Files

```tsx
const { result } = useList({
  resource: "documents",
  dataProviderName: "storage",
  filters: [
    { field: "mimetype_category", operator: "eq", value: "image" },
    { field: "size", operator: "lte", value: 5242880 },
    { field: "visibility", operator: "eq", value: "public" },
  ],
  meta: { bucketName: "uploads" }, // override bucket name
});
```

## Custom Storage Requests

```tsx
const { data } = useCustom({
  dataProviderName: "storage",
  url: "my-bucket/some/path",
  method: "get",
});
```
