# Orders Confirmation Checklist

## Guards
- Editable path for NEW-only logic is enforced where required.
- Team and tenant access checks are enforced.

## Queue
- Request path enqueues job and returns quickly.
- In-flight lock/state is written before enqueue.
- Duplicate clicks/requests do not flood queue.

## External Update
- Outbound payload includes required persisted fields.
- Existing tags/items/shipping fields are preserved when API expects full set.
- Retryable vs non-retryable errors are separated.

## Webhook Convergence
- Local state expects webhook callback to finalize.
- Failure path unlocks or times out safely.

## Observability
- Clear messages for queued/in-progress/success/failure.
- Logs include shop/order identifiers for traceability.
