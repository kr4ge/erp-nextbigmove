# Prisma Migration Checklist

## Before Migration
- Confirm target tables/columns and expected nullability.
- Confirm index/unique changes and query impact.
- Confirm backward compatibility for running code.

## Migration Execution
- Generate a new migration file only.
- Apply migration in dev and verify schema.
- Regenerate Prisma client if needed.

## Safety
- Do not modify previously applied migration files.
- Avoid reset commands in non-local environments.
- Use forward-fix migration for correction.

## Verification
- API build passes.
- Affected write/read paths function correctly.
- No drift remains after apply.
