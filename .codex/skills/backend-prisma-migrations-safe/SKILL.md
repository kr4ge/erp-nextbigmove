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

## Workflow
1. Plan the change.
- Confirm nullability/default/index/unique behavior.
- Evaluate impact on existing data.

2. Create migration in dev.
- Update `schema.prisma`.
- Generate a new migration file.
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

## References
- Use [references/prisma-migration-checklist.md](references/prisma-migration-checklist.md) before finalizing.
