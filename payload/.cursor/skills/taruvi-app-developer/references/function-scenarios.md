# Scenarios

## Error Handling Pattern

```python
def main(params, user_data, sdk_client):
    required = ["order_id", "action"]
    missing = [k for k in required if k not in params]
    if missing:
        return {"success": False, "error": f"Missing: {', '.join(missing)}"}

    try:
        result = sdk_client.database.get("orders", record_id=params["order_id"])
        return {"success": True, "data": result}
    except Exception as e:
        log(f"Error: {str(e)}", level="error")
        return {"success": False, "error": str(e), "error_type": type(e).__name__}
```

---

## Scenario 1: Multi-Resource Cascade Delete

**When:** User deletes a task. Need to also delete attachments from storage + task activities.

**Wrong — frontend cascade:**
```typescript
// ❌ DON'T — unreliable, slow, race-prone
await dataProvider().deleteMany({ resource: "tasks", ids });
const attachments = await dataProvider().getList({ resource: "task_attachments", ... });
for (const a of attachments.data) {
  await storageProvider.deleteOne({ resource: "task-attachments", id: a.path });
}
await dataProvider().deleteMany({ resource: "task_attachments", ids: attachmentIds });
await dataProvider().deleteMany({ resource: "task_activities", ids: activityIds });
```

**Right — frontend does primary delete, function handles the rest:**
```typescript
// ✅ Frontend: delete tasks (single resource — OK)
await dataProvider().deleteMany!({ resource: "tasks", ids: cascadeDeleteOrder });

// ✅ Function: durable cleanup of related resources
executeFunctionAsync("cleanup-deleted-tasks", {
  task_ids: cascadeDeleteOrder,
}).catch(e => console.warn("Cleanup failed:", e));
```

```python
def main(params, user_data, sdk_client):
    task_ids = params.get("task_ids", [])
    if not task_ids:
        return {"success": True, "deleted": 0}

    for task_id in task_ids:
        attachments = sdk_client.database.from_("task_attachments") \
            .filter("task_id", "eq", task_id) \
            .populate("storage_object_id") \
            .execute()

        for att in attachments.get("data", []):
            storage_obj = att.get("storage_object_id")
            if storage_obj and storage_obj.get("path"):
                try:
                    sdk_client.storage.from_("task-attachments").delete([storage_obj["path"]])
                except Exception as e:
                    log(f"Storage delete failed: {e}", level="warning")
            sdk_client.database.delete("task_attachments", record_id=att["id"])

    for task_id in task_ids:
        activities = sdk_client.database.from_("task_activities") \
            .filter("task_id", "eq", task_id) \
            .execute()
        activity_ids = [a["id"] for a in activities.get("data", [])]
        if activity_ids:
            sdk_client.database.delete("task_activities", ids=activity_ids)

    log(f"Cleaned up attachments and activities for {len(task_ids)} tasks", level="info")
    return {"success": True, "tasks_cleaned": len(task_ids)}
```

---

## Scenario 2: Employee Onboarding (Multi-Resource Create)

**When:** Creating an employee requires: create user → create salary record → create payroll record → notify HR.

```typescript
// Frontend: create user (single resource — OK)
const result = await createUser({ resource: "users", dataProviderName: "user", values: userData });

// Function: everything else
executeFunctionAsync("onboard-employee", {
  employee_id: result.data.id,
  employee_name: fullName,
}).catch(err => console.error("Onboarding error:", err));
```

```python
def main(params, user_data, sdk_client):
    emp_id = params["employee_id"]
    emp_name = params["employee_name"]

    sdk_client.database.create("salaries", {
        "employee_id": emp_id,
        "base_salary": 0,
        "status": "pending_review"
    })

    sdk_client.database.create("payroll", {
        "employee_id": emp_id,
        "pay_period": "monthly",
        "status": "setup"
    })

    sdk_client.functions.execute("send-slack-notification", params={
        "channel": "#hr",
        "message": f"New employee onboarded: {emp_name}"
    }, is_async=True)

    return {"success": True, "employee_id": emp_id}
```

---

## Scenario 3: Scheduled Report (Cron Job)

**Trigger type:** Schedule. Cron `0 8 * * 1` = Monday 8am.

```python
def main(params, user_data, sdk_client):
    revenue = sdk_client.analytics.execute("weekly-revenue", params={
        "period": "last_7_days"
    })

    signups = sdk_client.database.from_("users") \
        .filter("created_at", "gte", params.get("start_date")) \
        .count()

    log(f"Weekly report: revenue={revenue['total']}, signups={signups}", level="info")
    return {"revenue": revenue["data"], "new_signups": signups}
```

---

## Scenario 4: React to Data Change (Event-Driven)

**Trigger:** `RECORD_CREATE` with filter `event.datatable == "orders" && event.data.status == "paid"`

```python
def main(params, user_data, sdk_client):
    order = params
    log(f"New paid order: {order.get('id')}", level="info")

    sdk_client.database.update("products", record_id=order["product_id"], data={
        "stock": order["current_stock"] - order["quantity"]
    })

    sdk_client.functions.execute("notify-fulfillment", params={
        "order_id": order["id"],
        "customer": order["customer_name"]
    }, is_async=True)

    return {"processed": True}
```

---

## Scenario 5: Call External API with Stored Secret

```python
def main(params, user_data, sdk_client):
    import requests

    api_key = sdk_client.secrets.get("OPENAI_API_KEY")
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key['value']}"},
        json={
            "model": "gpt-4",
            "messages": [{"role": "user", "content": params["prompt"]}]
        },
        timeout=30
    )
    response.raise_for_status()
    return {"reply": response.json()["choices"][0]["message"]["content"]}
```

---

## Scenario 6: User Lifecycle Hook

**Trigger:** `POST_USER_CREATE` — runs after every new user is created.

```python
def main(params, user_data, sdk_client):
    new_user = params

    sdk_client.users.assign_roles(roles=["viewer"], usernames=[new_user["username"]])

    sdk_client.database.create("profiles", {
        "user_id": new_user["id"],
        "username": new_user["username"],
        "onboarding_complete": False
    })

    sdk_client.functions.execute("send-welcome-email", params={
        "email": new_user["email"],
        "name": new_user.get("first_name", new_user["username"])
    }, is_async=True)

    return {"setup_complete": True}
```

---

## Scenario 7: Public Webhook Receiver

**Set `is_public=True`.** Accessible at `/api/public/apps/{app_slug}/functions/{slug}/execute/`:

```python
def main(params, user_data, sdk_client):
    if params.get("type") == "payment.completed":
        sdk_client.database.create("payments", {
            "external_id": params["id"],
            "amount": params["amount"],
            "status": "completed"
        })
        return {"received": True}
    return {"ignored": True}
```

---

## Scenario 8: Long-Running Task (Async)

**When:** Data import, report generation, or batch operations that take >30 seconds.

```typescript
// ✅ Fire async, get task_id, poll later
const result = await executeFunction(
  "import-10k-records",
  { file_path: "data.csv" },
  { kind: "function", async: true }
);
const taskId = result.invocation.celery_task_id;

// Poll for result
const status = await executeFunction("check-task-status", { task_id: taskId });
```
