---
name: backend-erp-resilient
description: Implement or refactor ERP backend features in NestJS with modular controller/DTO/service/processor boundaries, async offloading for long-running work, timeout-aware external I/O, structured error handling, DRY helper extraction, and tenant/team scoped contracts. Use when building APIs, processors, integrations, or stabilizing slow or failure-prone backend behavior.
---

# Backend ERP Resilient

## Goal
Ship backend changes that stay fast in the request path, move expensive work async, fail predictably, and remain modular under tenant and team scoping.

## Workflow
1. Trace the full backend path before changing code.
- Identify controller, DTO, service, processor/queue, Prisma models, and any external providers touched by the request.
- Keep the write scope minimal and avoid mixing transport, business logic, and persistence concerns.

2. Keep request handlers thin and bounded.
- `controller`: routing, guards, DTO validation, response shape only.
- `dto`: explicit inputs and validators only.
- `service`: business rules, orchestration, and transaction boundaries.
- `processor`: retries, long-running jobs, reconciliation, and non-blocking side effects.
- Return quickly from request paths when work can safely continue async.

3. Be async-first for expensive or failure-prone work.
- Push external sync, reconciliation, bulk updates, and slow fan-out logic to queues/processors.
- Prefer enqueue + status tracking over blocking API requests.
- Re-read latest DB state inside processors before side effects.

4. Enforce timeout and retry discipline.
- Every external I/O path must have an explicit timeout budget.
- Do not let third-party calls hang indefinitely.
- Retry only transient failures and only in safe/idempotent paths.
- Keep retries bounded and observable.

5. Normalize errors and logging.
- Throw typed Nest exceptions for client-facing errors.
- Do not leak raw provider or Prisma errors directly to the API response.
- Log with request IDs, tenant IDs, team IDs, entity IDs, and job IDs when available.
- Prefer stable error messages and explicit failure reasons.

6. Keep code DRY and modular.
- Extract repeated Prisma `where` clauses, payload mappers, date helpers, status guards, and aggregation logic.
- Prefer private helpers, module utils, or shared services over duplicated inline logic.
- Keep one source of truth for contract mapping and business calculations.

7. Protect scope and consistency.
- Always enforce tenant scope.
- Apply team scope deliberately and never widen access implicitly.
- Use transactions for multi-step writes and status transitions.
- Make repeated executions idempotent where webhooks, jobs, or retries can happen.

8. Add permission contracts for new modules.
- When a new backend module needs RBAC, define explicit permission keys up front instead of relying on broad catch-all permissions.
- Prefer CRUD-shaped permission families for record-owning modules:
  - `<module>.create`
  - `<module>.read`
  - `<module>.update`
  - `<module>.delete`
- Add only the permission surface the module truly needs.

9. Verify before finishing.
- Run focused API type/build checks for touched modules.
- Call out contract changes, timeout assumptions, and async boundaries explicitly.

## Default Patterns
- Request path should prefer: validate -> check scope -> minimal write/upsert -> enqueue async work -> return stable response.
- Long-running jobs should prefer: load latest state -> guard against stale work -> execute side effects -> persist completion/failure metadata.
- Shared business rules should live in one service/helper path, not be recomputed differently across controllers or processors.

## Required Output
- List updated files and why each changed.
- State any API contract changes.
- State what was kept synchronous vs moved async.
- State timeout/retry assumptions added or preserved.
- State verification commands run.

## References
- Use [references/backend-resilient-checklist.md](references/backend-resilient-checklist.md) before finalizing.
