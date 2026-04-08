# Backend ERP Resilient Checklist

## Boundaries
- Controller only handles transport, guards, and DTO parsing.
- DTOs define explicit required vs optional fields.
- Service owns business rules.
- Processor owns long-running async side effects.

## Performance and async
- Slow external work is not left in the request path without reason.
- Expensive bulk work is queued or chunked.
- N+1 Prisma reads were avoided where practical.

## Timeout and retry
- External calls have explicit timeout budgets.
- Retries are bounded and only used for transient failures.
- Request paths do not spin on repeated retries.

## Errors and observability
- API returns typed, stable errors.
- Raw provider or DB failures are not leaked directly to clients.
- Logs include enough context to trace tenant/team/entity/job failures.

## Consistency and scope
- Tenant scope is always applied.
- Team scope is enforced where required.
- Multi-step writes use transactions or explicit consistency guards.
- Repeated job/webhook execution is idempotent or safely ignored.

## DRY and maintainability
- Repeated query filters or aggregation logic are extracted.
- Mapping logic is centralized.
- Business formulas are not duplicated across endpoints without need.

## Verification
- Run focused API type/build checks.
- Note any remaining risks, especially around retries, timeouts, and async lag.
