---
name: backend-prisma-migrations-safe
description: Execute safe Prisma schema and migration changes for ERP environments, including drift handling, immutable applied migrations, dev/prod rollout sequence, and rollback-safe practices. Use when changing Prisma models or migration history.
---

# Backend Prisma Migrations Safe

## Goal
Ship schema changes without breaking migration history or requiring destructive resets.

## Rules
- Never edit an already-applied migration in shared environments.
- Create a new migration for every schema evolution.
- Keep schema and generated client consistent.
- Every migration must be shadow-database safe when replayed from the first migration.
- Never reference/alter a table, column, enum, or index that is only created in a later migration.

## Workflow
1. Plan the change.
- Confirm nullability/default/index/unique behavior.
- Evaluate impact on existing data.

2. Create migration in dev.
- Update `schema.prisma`.
- Generate a new migration file.
- Validate the generated SQL ordering (create before alter).
- Apply migration locally.

3. Validate behavior.
- Build API after migration.
- Test the affected queries/writes.

4. Promote to production safely.
- Use deploy-time migration command that applies pending migrations only.
- Do not use destructive reset flows on production.

## Drift Handling
- If drift is reported, inspect migration history and DB schema mismatch.
- Do not fix drift by rewriting old migration files.
- Resolve by creating forward migration or aligning DB manually with explicit SQL, then mark migration state correctly.

## Shadow DB Guardrail
- `prisma migrate dev` replays migrations on a shadow database from zero.
- If migration `N` alters an object created in migration `N+1`, dev migrate will fail with `P3006/P1014`.
- Fix pattern:
- If broken migration is not applied anywhere, make it safe/no-op and move SQL into the migration that creates the target object (or a new forward migration after creation).
- Keep resulting SQL idempotent for replay order.

## References
- Use [references/prisma-migration-checklist.md](references/prisma-migration-checklist.md) before finalizing.
