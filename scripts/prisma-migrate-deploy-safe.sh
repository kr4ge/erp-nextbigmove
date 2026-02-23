#!/usr/bin/env bash
set -euo pipefail

SCHEMA_PATH="./apps/api/prisma/schema.prisma"
COMPOSE_CMD=(docker compose -f docker-compose.prod.yml --env-file .env.prod)
PRISMA_CMD=("${COMPOSE_CMD[@]}" run --rm -T api npx prisma)

run_deploy() {
  "${PRISMA_CMD[@]}" migrate deploy --schema="$SCHEMA_PATH"
}

echo "Running prisma migrate deploy..."
set +e
DEPLOY_OUTPUT=$(run_deploy 2>&1)
DEPLOY_STATUS=$?
set -e
printf '%s\n' "$DEPLOY_OUTPUT"

if [[ $DEPLOY_STATUS -eq 0 ]]; then
  exit 0
fi

if ! printf '%s\n' "$DEPLOY_OUTPUT" | grep -q "Error: P3009"; then
  exit $DEPLOY_STATUS
fi

echo "Detected failed migration state (P3009). Resolving failed migrations as rolled back..."
FAILED_MIGRATIONS=$(printf '%s\n' "$DEPLOY_OUTPUT" \
  | sed -n 's/.*The `\([^`]*\)` migration started.*/\1/p' \
  | sort -u)

if [[ -z "$FAILED_MIGRATIONS" ]]; then
  echo "Could not parse failed migration names from prisma output."
  exit $DEPLOY_STATUS
fi

while IFS= read -r migration_name; do
  [[ -z "$migration_name" ]] && continue
  echo "Resolving migration: $migration_name"
  "${PRISMA_CMD[@]}" migrate resolve --rolled-back "$migration_name" --schema="$SCHEMA_PATH"
done <<< "$FAILED_MIGRATIONS"

echo "Retrying prisma migrate deploy..."
run_deploy
