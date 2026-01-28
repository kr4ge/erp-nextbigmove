# Workflow System User Guide

## Overview

The workflow system automatically fetches data from **Meta Ads** and **Pancake POS** APIs on a schedule or on-demand. It processes dates sequentially, calculates COGS, and stores insights for analytics.

---

## Quick Start

### 1. Prerequisites

Before creating workflows, ensure you have:

1. **Meta Ad Account(s)** - Set up Meta Ads integration and sync ad accounts
2. **POS Store(s)** - Set up Pancake POS integration
3. **Product COGS** - Configure COGS for POS products (for accurate order calculations)

### 2. Create Your First Workflow

**POST** `/api/workflows`

```json
{
  "name": "Daily Meta & POS Sync",
  "description": "Fetch yesterday's Meta ads and POS orders daily at 2am",
  "schedule": "0 2 * * *",
  "config": {
    "dateRange": {
      "type": "rolling",
      "offsetDays": 1
    },
    "sources": {
      "meta": { "enabled": true },
      "pos": { "enabled": true }
    },
    "rateLimit": {
      "metaDelayMs": 2000,
      "posDelayMs": 1000
    }
  }
}
```

**Response:**
```json
{
  "id": "uuid-123",
  "tenantId": "your-tenant-id",
  "name": "Daily Meta & POS Sync",
  "enabled": true,
  "schedule": "0 2 * * *",
  "config": { ... },
  "createdAt": "2024-12-02T10:00:00Z",
  "updatedAt": "2024-12-02T10:00:00Z"
}
```

---

## Date Range Types

### 1. **Rolling** (Recommended for daily sync)
Fetches data for a specific offset from today.

```json
{
  "type": "rolling",
  "offsetDays": 1  // 0 = today, 1 = yesterday, 2 = day before yesterday
}
```

**Examples:**
- `offsetDays: 0` - Today's data
- `offsetDays: 1` - Yesterday's data (most common for daily syncs)
- `offsetDays: 7` - Data from 7 days ago

### 2. **Relative** (Last N days)
Fetches data for the last N days from today.

```json
{
  "type": "relative",
  "days": 7  // Last 7 days
}
```

**Examples:**
- `days: 1` - Today only
- `days: 7` - Last 7 days (including today)
- `days: 30` - Last 30 days

### 3. **Absolute** (Specific date range)
Fetches data for a specific date range.

```json
{
  "type": "absolute",
  "since": "2024-11-01",
  "until": "2024-11-30"
}
```

Use for backfilling historical data or specific reporting periods.

---

## Workflow Configuration

### Full Configuration Example

```json
{
  "name": "Weekly Meta Ads Report",
  "description": "Fetch last week's Meta ad performance",
  "schedule": "0 3 * * 1",  // Every Monday at 3am
  "config": {
    "dateRange": {
      "type": "relative",
      "days": 7
    },
    "sources": {
      "meta": { "enabled": true },
      "pos": {
        "enabled": false  // Disable POS for this workflow
      }
    },
    "rateLimit": {
      "metaDelayMs": 2000,  // 2 seconds between Meta API calls
      "posDelayMs": 1000    // 1 second between POS API calls
    }
  }
}
```

### Configuration Options

| Field | Description |
|-------|-------------|
| `sources.meta.enabled` | Enable/disable Meta Ads fetching |
| `sources.pos.enabled` | Enable/disable POS fetching |
| `dateRange` | Shared date range applied to all enabled sources |
| `rateLimit.metaDelayMs` | Delay between Meta API calls (ms) |
| `rateLimit.posDelayMs` | Delay between POS API calls (ms) |

---

## Cron Schedule Syntax

The `schedule` field uses standard cron syntax:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
* * * * *
```

### Common Examples

| Schedule | Description |
|----------|-------------|
| `0 2 * * *` | Daily at 2:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * 0` | Every Sunday at midnight |
| `0 3 * * 1` | Every Monday at 3:00 AM |
| `0 0 1 * *` | First day of every month at midnight |
| `30 14 * * 1-5` | 2:30 PM on weekdays |

**Leave empty** (`schedule: null`) for manual-only workflows.

---

## API Endpoints

### Workflow Management

#### List All Workflows
**GET** `/api/workflows`

Returns all workflows for your tenant.

#### Get Single Workflow
**GET** `/api/workflows/:id`

#### Update Workflow
**PATCH** `/api/workflows/:id`

```json
{
  "name": "Updated Name",
  "enabled": true,
  "schedule": "0 3 * * *"
}
```

#### Delete Workflow
**DELETE** `/api/workflows/:id`

#### Enable Workflow
**POST** `/api/workflows/:id/enable`

#### Disable Workflow
**POST** `/api/workflows/:id/disable`

---

### Workflow Execution

#### Trigger Manual Execution
**POST** `/api/workflows/:id/trigger`

```json
{
  "dateRangeSince": "2024-11-01",  // Optional: override date range
  "dateRangeUntil": "2024-11-30"
}
```

**Response:**
```json
{
  "id": "execution-uuid",
  "workflowId": "workflow-uuid",
  "tenantId": "your-tenant-id",
  "status": "PENDING",
  "triggerType": "MANUAL",
  "dateRangeSince": "2024-11-01",
  "dateRangeUntil": "2024-11-30",
  "totalDays": 30,
  "daysProcessed": 0,
  "metaFetched": 0,
  "posFetched": 0,
  "errors": [],
  "createdAt": "2024-12-02T10:00:00Z"
}
```

#### List Workflow Executions
**GET** `/api/workflows/:id/executions`

Returns all execution history for a workflow.

#### Get Execution Details
**GET** `/api/workflows/:workflowId/executions/:executionId`

#### Cancel Running Execution
**POST** `/api/workflows/:workflowId/executions/:executionId/cancel`

---

## Execution Flow

### What Happens During Execution

1. **Workflow Triggered** - Manually or by schedule
2. **Execution Created** - Status: `PENDING`
3. **Date Range Calculated** - Based on config
4. **Bull Job Enqueued** - Background processing starts
5. **Status: RUNNING** - Processing begins
6. **For Each Date** (oldest → newest):
   - **Fetch Meta Ads** (if enabled)
     - For ALL Meta ad accounts in tenant
     - Fetch ad-level insights
     - Extract marketing associate
     - Upsert to `meta_ad_insights` table
   - **Fetch POS Orders** (if enabled)
     - For ALL POS stores in tenant
     - Fetch orders for the date
     - Calculate COGS from product mappings
     - Upsert to `pos_orders` table
   - **Update Progress** - `daysProcessed`, `metaFetched`, `posFetched`
7. **Status: COMPLETED** or **FAILED**

### Execution Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Waiting to start |
| `RUNNING` | Currently processing |
| `COMPLETED` | Successfully finished |
| `FAILED` | Error occurred (fail-fast) |
| `CANCELLED` | Manually cancelled |

---

## Common Use Cases

### 1. Daily Sync (Yesterday's Data)

```json
{
  "name": "Daily Sync - Yesterday",
  "schedule": "0 2 * * *",
  "config": {
    "dateRange": { "type": "rolling", "offsetDays": 1 },
    "sources": {
      "meta": { "enabled": true },
      "pos": { "enabled": true }
    }
  }
}
```

### 2. Weekly Report (Last 7 Days)

```json
{
  "name": "Weekly Report",
  "schedule": "0 3 * * 1",  // Monday 3am
  "config": {
    "dateRange": { "type": "relative", "days": 7 },
    "sources": {
      "meta": { "enabled": true },
      "pos": { "enabled": true }
    }
  }
}
```

### 3. Monthly Backfill

```json
{
  "name": "November Backfill",
  "schedule": null,  // Manual only
  "config": {
    "dateRange": {
      "type": "absolute",
      "since": "2024-11-01",
      "until": "2024-11-30"
    },
    "sources": {
      "meta": { "enabled": true },
      "pos": { "enabled": true }
    }
  }
}
```

### 4. Meta Only (No POS)

```json
{
  "name": "Meta Ads Only",
  "schedule": "0 4 * * *",
  "config": {
    "dateRange": { "type": "rolling", "offsetDays": 1 },
    "sources": {
      "meta": { "enabled": true },
      "pos": { "enabled": false }
    }
  }
}
```

---

## Error Handling

### Fail-Fast Behavior

The workflow uses **fail-fast** strategy:
- If any error occurs, the workflow **immediately stops**
- No retries (by design)
- Error details saved in `execution.errors`

### Error Response Example

```json
{
  "id": "execution-uuid",
  "status": "FAILED",
  "errors": [
    {
      "date": "2024-11-15",
      "source": "meta",
      "accountId": "123456789",
      "error": "Rate limit exceeded"
    }
  ],
  "daysProcessed": 14,  // Failed on day 15
  "totalDays": 30
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Rate limit exceeded | Too many API calls | Increase `metaDelayMs` or `posDelayMs` |
| Integration not found | Missing Meta/POS setup | Set up integrations first |
| Invalid credentials | Expired access token | Refresh Meta access token |
| No COGS configured | Missing product COGS | Configure COGS for products |

---

## Best Practices

### 1. **Start with Yesterday's Data**
Use `rolling` with `offsetDays: 1` for daily syncs. This ensures data is complete.

### 2. **Schedule During Off-Peak Hours**
Run workflows at night (2-4 AM) to avoid peak API usage.

### 3. **Use Rate Limiting**
- Meta Ads: 3000ms (3 seconds) between calls
- POS: 3000ms (3 seconds) between calls

### 4. **Monitor Executions**
Check execution history regularly for failures.

### 5. **Separate Workflows for Different Purposes**
- Daily sync workflow (rolling)
- Weekly report workflow (relative)
- Monthly backfill workflow (absolute, manual)

### 6. **Test with Small Date Ranges First**
Before running large backfills, test with 1-2 days.

---

## Data Output

### Meta Ad Insights Table

Data stored in `meta_ad_insights`:

```sql
SELECT
  date,
  account_id,
  campaign_name,
  ad_name,
  marketing_associate,  -- Extracted from ad name
  spend,
  clicks,
  link_clicks,
  impressions,
  leads,
  status
FROM meta_ad_insights
WHERE tenant_id = 'your-tenant-id'
  AND date BETWEEN '2024-11-01' AND '2024-11-30'
ORDER BY date DESC, spend DESC;
```

### POS Orders Table

Data stored in `pos_orders`:

```sql
SELECT
  date_local,
  shop_id,
  pos_order_id,
  total,
  cogs,              -- Calculated from product COGS
  total_quantity,
  mapping,           -- Extracted from note_product
  p_utm_campaign,
  p_utm_content
FROM pos_orders
WHERE tenant_id = 'your-tenant-id'
  AND date_local BETWEEN '2024-11-01' AND '2024-11-30'
ORDER BY date_local DESC;
```

---

## Monitoring & Debugging

### Check Execution Progress

**GET** `/api/workflows/:workflowId/executions/:executionId`

```json
{
  "id": "execution-uuid",
  "status": "RUNNING",
  "dateRangeSince": "2024-11-01",
  "dateRangeUntil": "2024-11-30",
  "totalDays": 30,
  "daysProcessed": 15,    // Currently on day 15
  "metaFetched": 450,     // 450 ad insights fetched
  "posFetched": 120,      // 120 orders fetched
  "startedAt": "2024-12-02T10:00:00Z",
  "errors": []
}
```

### View Application Logs

Check NestJS logs for detailed execution flow:

```
[WorkflowSchedulerService] Executing scheduled workflow abc-123
[WorkflowProcessorService] Processing date 2024-11-15 for execution xyz-456
[WorkflowProcessorService] Fetching Meta insights for account 123456789
[MetaInsightService] Upserted 15 Meta insights for account 123456789
[WorkflowProcessorService] Fetching POS orders for shop 789
[PosOrderService] Upserted 8 POS orders for shop 789
```

---

## Need Help?

### Common Questions

**Q: My workflow isn't running on schedule**
- Check if workflow is `enabled: true`
- Verify cron expression syntax
- Check application logs for errors

**Q: No data is being fetched**
- Ensure Meta ad accounts are synced: `POST /api/integrations/:id/meta/sync-accounts`
- Ensure POS stores are configured
- Check integration credentials are valid

**Q: COGS is showing as 0**
- Configure COGS for your products: `POST /api/integrations/pos-stores/:storeId/products/:productId/cogs`
- COGS must have a valid date range covering the order date

**Q: How do I re-run failed executions?**
- Trigger manually with the same date range: `POST /api/workflows/:id/trigger`
- The system uses upsert, so re-running is safe (idempotent)

---

## Next Steps

1. **Set up integrations** (Meta Ads & Pancake POS)
2. **Sync Meta ad accounts**
3. **Configure product COGS**
4. **Create your first workflow**
5. **Test with manual trigger**
6. **Enable scheduling**
7. **Monitor executions**

For technical details, see the implementation in:
- `apps/api/src/modules/workflows/`
- `apps/api/src/modules/integrations/`
