# Webhook + Queue Checklist

## Inbound Path
- Webhook handler avoids long external calls.
- Raw event payload/context is persisted.
- Basic validation and dedupe key extraction are present.

## Async Path
- Queue job contains enough identifiers to re-read state.
- Processor is idempotent and stale-job aware.
- Retry policy is explicit and bounded.

## Reliability
- Transient DB/API failures are retried.
- Terminal failures are logged and observable.
- Locking or guard conditions prevent duplicate side effects.

## Relay
- Relay failures do not block core upsert flow.
- Relay status is tracked separately.
