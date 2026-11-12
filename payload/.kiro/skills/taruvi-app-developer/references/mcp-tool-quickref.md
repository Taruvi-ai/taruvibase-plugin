# OAuth Worker MCP tools

Contract: platform commit `50825726069db5dbd0646f71fc95664384e2cc02`.
Use the live tool catalogue for exact input schemas; legacy action-based tool
signatures are not interchangeable with these tools.

Authenticate through the client at `https://mcp.taruvibase.com/mcp` (test:
`https://test-mcp.taruvibase.com/mcp`). Pin app work using verified `siteId` and
`appId` URL parameters. No API-key or X-App-Slug headers. `site_id` and `app_id`
tool arguments are slugs and must match the intended scope; omit only when the
connection uniquely determines them. Confirm with `get_sites` and `get_apps`.

| Work | Current tools |
| --- | --- |
| Sites/apps | get_organizations, get_sites, create_sites, update_sites, get_apps, create_apps, update_apps |
| Schema | get_tables, save_tables, delete_tables |
| Records/edges | get_records, save_records, delete_records, get_edges, create_edges, delete_edges |
| Functions | get_functions, save_functions, delete_functions, run_functions, get_function_results |
| Storage | get_buckets, create_buckets, get_objects |
| Users/roles | get_users, create_users, update_users, get_user_attribute_schema, save_user_attribute_schema, get_roles, create_roles, delete_roles, assign_roles, revoke_roles |
| Policies | get_policies, save_policies, disable_policies |
| Secrets | get_secrets, save_secrets, get_secret_types, create_secret_types, update_secret_types, delete_secret_types |
| Analytics | get_queries, create_queries, update_queries, delete_queries, run_queries |
| Events | get_event_subscribers, subscribe_functions, unsubscribe_functions |
| Bug reports | report_bug (sends an external message; requires authorization) |

Reads generally list when ids are omitted, or return found/not_found for given
ids. Writes commonly accept lists and return summary/succeeded/failed. Inspect
partial failures; never blindly replay the whole batch. Timeouts can leave
applied writes, so re-read before retrying. Consult each tool's actual schema.

`save_tables` replaces complete schemas: fields omitted are dropped with data.
Read first and preserve fields. `delete_records` takes ids, not filter deletes,
with at most 200 ids. Paginated data offsets must be multiples of limits.
`run_functions` and `run_queries` allow at most 10 runs per call. Site-wide user
operations require a whole-site grant; do not silently broaden an app connection.
There is no raw SQL, storage quota, bucket deletion, or generic manage_* tool.
Documentation is exposed as `taruvi://docs/{path}` MCP resources, not get_ai_docs.
Use resource discovery and read only returned URIs.

The other references retain platform/runtime concepts and some legacy MCP
examples. Their old tool invocations apply only to an explicit legacy tenant
connection; adapt workflows using current schemas, never mechanically rename
arguments or invent replacements for unsupported operations. See
[legacy quick reference](legacy-mcp-tool-quickref.md) only for such connections.
