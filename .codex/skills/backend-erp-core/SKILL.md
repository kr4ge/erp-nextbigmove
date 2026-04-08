---
name: backend-erp-core
description: Implement or refactor ERP backend features in NestJS with consistent module structure, DTO validation, tenant/team scoping, transactional safety, and predictable API contracts. Use when building controllers/services/processors, adding endpoints, or stabilizing backend behavior.
---

# Backend ERP Core

## Goal
Ship backend changes that are modular, scoped correctly, and safe under concurrent traffic.

## Workflow
1. Trace the feature path before changing code.
- Identify controller, DTO, service, queue/processor, and Prisma models touched by the request.
- Keep the write scope minimal and avoid unrelated edits.

2. Keep strict boundaries.
- `controller`: request/response wiring and permission guards only.
- `dto`: validation and contract shape only.
- `service`: business rules and orchestration.
- `processor`: async side effects and retries.
- `prisma`: persistence and transaction boundaries.

3. Enforce validation and explicit contracts.
- Add DTO fields with validators for every new input.
- Keep optional vs required fields explicit.
- Return stable response shapes.

4. Enforce scoping.
- Always apply tenant scope.
- Apply team scope where required by feature permissions.
- Do not widen scope implicitly.

5. Add permission contracts deliberately.
- For new modules that require RBAC, define permission keys explicitly instead of reusing broad legacy access by default.
- Prefer CRUD-shaped permission sets when the module owns records or workflows:
  - `<module>.create`
  - `<module>.read`
  - `<module>.update`
  - `<module>.delete`
- Only add module permissions when the feature actually needs guarded access.

6. Make writes concurrency-safe.
- Use transactional updates for multi-step state changes.
- Add idempotent conditions for repeated webhook/queue executions.
- Prefer retry wrappers for transient DB errors (deadlock/serialization).

7. Preserve behavior and compatibility.
- Do not break existing payload contracts unless requested.
- Gate new behavior behind explicit request fields if needed.

8. Verify.
- Build API workspace and run focused checks for touched modules.

## Required Output
- List updated files and why each changed.
- State any contract changes.
- State verification commands run.

## References
- Use [references/backend-core-checklist.md](references/backend-core-checklist.md) before finalizing.
