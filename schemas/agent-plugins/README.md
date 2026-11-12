# Pinned Agent Plugins schemas

The unmodified 1.0.0 schemas were retrieved on 2026-10-23 from:

- https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
- https://agent-plugins.org/schemas/1.0.0/mcp.schema.json

The normative specification at https://agent-plugins.org/specification takes
precedence if prose and schema disagree. Validation is offline: Ajv uses these
bundled schemas, with additional filesystem and HTTP checks in
`scripts/lib/conformance.mjs`. Vendor-native manifests are validated separately;
they must not be judged using the portable manifest schema.

To upgrade, retrieve both schemas for the same specification version, review
the normative changes, update the manifest identifiers and validator together,
and run the negative fixtures and extracted-package tests. Do not silently
replace a published version with an incompatible schema.

SHA-256 of the pinned files:

```text
0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883  plugin.schema.json
6539175bfcdf43085855183e86da40ea94b166547a72b47ae9a0a390516d3acb  mcp.schema.json
```
