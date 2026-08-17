# Production API and Pancake Worker Rollout

## Purpose

This rollout keeps ERP, WMS, and STOX HTTP traffic in `erp-api-prod` while moving
heavy Pancake webhook ingestion and tenant/day reconciliation to
`erp-worker-prod`. Both containers initially run on the existing Droplet and use
the same managed PostgreSQL database and Redis queue.

No Prisma migration is required.

## Production defaults

Add these non-secret values to the production environment file, or rely on the
Compose defaults:

```dotenv
API_PROCESS_ROLE=api
WORKER_PROCESS_ROLE=worker
LOG_DEBUG_ENABLED=false

API_DATABASE_CONNECTION_LIMIT=6
API_DATABASE_POOL_TIMEOUT_SECONDS=10
WORKER_DATABASE_CONNECTION_LIMIT=3
WORKER_DATABASE_POOL_TIMEOUT_SECONDS=20

PANCAKE_WEBHOOK_PROCESSOR_CONCURRENCY=2
PANCAKE_AUTO_CANCEL_PROCESSOR_CONCURRENCY=1
PANCAKE_REPORTS_HYDRATE_PROCESSOR_CONCURRENCY=1
PANCAKE_RECONCILE_PROCESSOR_CONCURRENCY=1
PANCAKE_WEBHOOK_RECONCILE_DELAY_MS=300000
PANCAKE_WEBHOOK_RECONCILE_MIN_DELAY_MS=300000
PANCAKE_WEBHOOK_ALLOW_AUTOMATIC_FULL_RESET=false
PANCAKE_RECONCILE_QUEUE_ATTEMPTS=3
PANCAKE_RECONCILE_QUEUE_BACKOFF_MS=4000
PANCAKE_RECONCILE_QUEUE_TIMEOUT_MS=300000
```

Do not place secrets in Git. Keep the existing database, Redis, JWT, integration,
and object-storage values in the protected production environment secret.

## Before deployment

1. Record the currently deployed commit:

   ```bash
   cd /opt/erp
   git rev-parse HEAD
   ```

2. Confirm the managed PostgreSQL backup/recovery state in DigitalOcean.
3. Record ERP sales, sales-attribution, and marketing totals for one validation
   tenant on two or three recent dates.
4. Record the current queue and STOX latency baseline.
5. Confirm the production Compose file resolves:

   ```bash
   docker compose \
     -f docker-compose.prod.yml \
     -f docker-compose.prod.override.yml \
     --env-file .env.prod \
     config --quiet
   ```

## Deployment

The existing GitHub deployment workflow builds the shared `erp-api` image and
starts all Compose services. The API and worker use the same image with different
`PROCESS_ROLE` values.

After the deployment finishes:

```bash
cd /opt/erp
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.prod.override.yml \
  --env-file .env.prod \
  ps
```

Expected containers include:

- `erp-api-prod` — healthy HTTP API
- `erp-worker-prod` — running Pancake worker
- `erp-redis-prod` — healthy queue/cache

## Immediate validation

Check startup and role separation:

```bash
docker logs --since 15m erp-api-prod 2>&1 | tail -n 200
docker logs --since 15m erp-worker-prod 2>&1 | tail -n 200
```

The worker log must contain `Pancake worker running`. New `Processing Pancake
webhook` and `Processing webhook reconcile` messages must appear only in the
worker log.

Exercise one test webhook, then confirm:

- the inbound webhook returns quickly;
- the order upsert completes;
- one delayed reconcile exists for the tenant/date window;
- subsequent events in the same window are coalesced;
- the reconcile log reports `mode=incremental`;
- queue lag and waiting/active/delayed counts are logged;
- the saved ERP totals match the validation baseline after the five-minute
  reconciliation window.

Run a normal STOX basket assignment and serialized-item scan. Initial targets:

- basket assignment p95 below 5 seconds;
- serialized scan p95 below 2 seconds;
- no `P2028`, `P2034`, `40P01`, or transaction-start timeout.

## Monitoring period

Monitor for 24–48 hours before considering another Droplet:

```bash
docker stats --no-stream
docker logs --since 1h erp-worker-prod 2>&1 | \
  grep -E 'queue waiting=|Processed Pancake webhook|Processed webhook reconcile|failed'
```

Escalate if the oldest queue work is delayed by more than ten minutes, STOX p95
crosses its targets, the database reports blocking/deadlocks, or host CPU remains
above 70 percent.

## Emergency worker failback

Bull jobs remain in Redis if the dedicated worker is unavailable. To temporarily
return Pancake processing to the API:

1. Stop the worker:

   ```bash
   docker compose \
     -f docker-compose.prod.yml \
     -f docker-compose.prod.override.yml \
     --env-file .env.prod \
     stop worker
   ```

2. Set `API_PROCESS_ROLE=all` in the protected production environment.
3. Recreate only the API:

   ```bash
   docker compose \
     -f docker-compose.prod.yml \
     -f docker-compose.prod.override.yml \
     --env-file .env.prod \
     up -d --force-recreate api
   ```

Do not run the worker while the API is in `all` mode; that would create duplicate
queue consumers. After resolving the worker issue, restore `API_PROCESS_ROLE=api`,
recreate the API, and start the worker.

## Code rollback

Revert the release commit through Git, redeploy the previous known-good commit,
and verify API health. No database rollback is necessary because this rollout
does not change the Prisma schema or persist a new data format.
