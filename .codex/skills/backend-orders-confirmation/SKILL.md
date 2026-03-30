---
name: backend-orders-confirmation
description: Implement or adjust the confirmation-order backend flow including NEW-order constraints, async update queueing, in-flight locking, Pancake payload shaping, and webhook-driven state convergence. Use when changing order confirmation update behavior.
---

# Backend Orders Confirmation

## Goal
Keep confirmation updates fast for users, safe for concurrency, and consistent with webhook truth.

## Scope
- Primary files usually include:
`apps/api/src/modules/orders/*`
`apps/api/src/modules/integrations/services/pos-order.service.ts`
`apps/api/src/modules/integrations/*webhook*`

## Workflow
1. Validate update input.
- Enforce status/tag/note/payment/shipping edits through DTO shape.
- Reject illegal transitions early.

2. Enforce confirmation rules.
- Apply NEW-order guard when feature requires status `0` for editable flow.
- Preserve business rules for abandoned/void/in-flight cases.

3. Queue updates, do not block request path.
- Accept request quickly.
- Write in-flight lock/state first.
- Enqueue external update job.

4. Make queue processing idempotent.
- Re-read order row before sending external update.
- Skip/short-circuit when target state already reached.
- Handle retryable errors vs terminal errors explicitly.

5. Let webhook finalize source-of-truth state.
- External response may not equal final persisted state.
- Rely on webhook callback/upsert to converge local order state.

6. Release locks predictably.
- Clear processing state on success/failure path.
- Provide user-facing status for queued/in-progress/failed.

## Payload Discipline
- Build outbound Pancake payload from normalized internal draft state.
- Always include required existing fields when external API is replace-semantics.
- Avoid sending nullable fields unintentionally.

## References
- Use [references/orders-confirmation-checklist.md](references/orders-confirmation-checklist.md) before finalizing.
