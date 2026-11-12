# Events and Filters

Use event triggers to react to platform changes without polling.

## Common Events

| Event | Fires When |
|---|---|
| `RECORD_CREATE` | Datatable row created |
| `RECORD_UPDATE` | Datatable row updated |
| `RECORD_DELETE` | Datatable row deleted |
| `PRE_USER_CREATE` | Before user create |
| `POST_USER_CREATE` | After user create |
| `POST_USER_UPDATE` | After user update |
| `POST_USER_DELETE` | After user delete |

## Filter Example

`event.datatable == "orders" && event.data.status == "paid"`

## Trigger Guidance

- Use event + async for post-commit cleanup and fan-out actions.
- Keep event handlers idempotent to avoid duplicate side effects.
