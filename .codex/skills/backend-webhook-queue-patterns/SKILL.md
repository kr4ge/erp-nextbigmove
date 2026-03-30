---
name: backend-webhook-queue-patterns
description: Apply reliable webhook ingestion and queue-processing patterns for ERP integrations, including raw payload persistence, idempotent upserts, relay forwarding, retry strategy, and non-blocking request handling. Use when changing webhook or async processor logic.
---

# Backend Webhook Queue Patterns

## Goal
Process external events reliably without blocking inbound webhook latency.

## Workflow
1. Ingest fast.
- Parse and minimally validate webhook payload.
- Persist raw event context needed for replay/debug.
- Return success quickly.

2. Separate synchronous vs async work.
- Keep request path for quick upsert + enqueue only.
- Push expensive external fetch/reconcile/update logic to queue processor.

3. Enforce idempotency.
- Use deterministic keys (shop/order/event identifiers).
- Upsert by stable unique keys.
- Make repeated delivery safe.

4. Add retry and failure semantics.
- Retry transient failures with bounded attempts/backoff.
- Mark terminal failures clearly.
- Avoid infinite requeue loops.

5. Keep relay independent.
- Relay forwarding failures should not corrupt core ingestion path.
- Track relay result separately for observability.

6. Reconcile with source-of-truth.
- If source emits subsequent events, prefer event-driven convergence over forced immediate polling.

## Processor Rules
- Re-read latest DB state before side effects.
- Guard against stale jobs.
- Write completion/failure metadata for each job execution.

## References
- Use [references/webhook-queue-checklist.md](references/webhook-queue-checklist.md) before finalizing.
