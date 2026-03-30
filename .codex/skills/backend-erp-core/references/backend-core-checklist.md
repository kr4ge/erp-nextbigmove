# Backend Core Checklist

## Contract
- DTO contains all new request fields.
- Validation rules match business constraints.
- Response schema stays backward-compatible unless requested.

## Scope
- Tenant scope is enforced in reads and writes.
- Team scope is enforced where feature requires it.
- Permission guards are present and correct.

## Safety
- Multi-step writes are wrapped in transaction when needed.
- Idempotency is handled for repeated queue/webhook calls.
- Retry handling exists for transient DB failures when relevant.

## Quality
- No dead code or unrelated refactors.
- No silent behavior changes.
- Build/test commands for touched workspace pass.
