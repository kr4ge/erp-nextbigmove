# Prisma Migration Checklist

## Before Migration
- Confirm target tables/columns and expected nullability.
- Confirm index/unique changes and query impact.
- Confirm backward compatibility for running code.

## Migration Execution
- Generate a new migration file only.
- Confirm each migration is self-contained in replay order (no ALTER of objects created later).
- Apply migration in dev and verify schema.
- Regenerate Prisma client if needed.

## Safety
- Do not modify previously applied migration files.
- Avoid reset commands in non-local environments.
- Use forward-fix migration for correction.
- Guard against shadow DB failures (`P3006/P1014`) by ensuring create-before-alter ordering.

## Verification
- API build passes.
- Affected write/read paths function correctly.
- No drift remains after apply.
