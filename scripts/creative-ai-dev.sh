#!/usr/bin/env bash
# Start, stop, or check the local Creative AI stack (Claudebox gateway only).
#
#   ./scripts/creative-ai-dev.sh start    start Docker services + the gateway
#   ./scripts/creative-ai-dev.sh status   show what is running
#   ./scripts/creative-ai-dev.sh stop     stop the gateway (leaves Postgres/Redis up)
#   ./scripts/creative-ai-dev.sh logs     follow the gateway log
#
# The ERP API and web app are NOT started here; run them in their own terminals
# so you can watch their output:
#   npm run dev --workspace=@erp/api
#   npm run dev --workspace=@erp/web
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATEWAY="$ROOT/.codex-repos/claudebox"
API_ENV="$ROOT/apps/api/.env"

log() { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!!\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31mERROR\033[0m %s\n' "$*" >&2; exit 1; }

envval() { grep -E "^$1=" "$API_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }

load_gateway_env() {
  [ -f "$API_ENV" ] || die "apps/api/.env not found. Copy .env.example and fill in the Creative AI values."

  # The gateway and the API must agree on both secrets, so read them from the
  # API's own .env rather than keeping a second copy.
  export CLAUDEBOX_API_KEY="$(envval CLAUDEBOX_API_KEY)"
  export CLAUDEBOX_RUN_SIGNING_SECRET="$(envval AI_AGENT_SIGNING_SECRET)"
  export CLAUDEBOX_WORKSPACE_HOST="$(envval CREATIVE_AI_WORKSPACE_ROOT)"

  [ -n "$CLAUDEBOX_API_KEY" ] || die "CLAUDEBOX_API_KEY is missing from apps/api/.env"
  [ -n "$CLAUDEBOX_RUN_SIGNING_SECRET" ] || die "AI_AGENT_SIGNING_SECRET is missing from apps/api/.env"
  [ -n "$CLAUDEBOX_WORKSPACE_HOST" ] || die "CREATIVE_AI_WORKSPACE_ROOT is missing from apps/api/.env"
  mkdir -p "$CLAUDEBOX_WORKSPACE_HOST"

  export CLAUDEBOX_IMAGE="${CLAUDEBOX_IMAGE:-claudebox-local:test}"
  export CLAUDEBOX_PORT="${CLAUDEBOX_PORT:-3100}"
  export CLAUDEBOX_AUTH_FROM_UI=1
  export CLAUDEBOX_MAX_OUTPUT_BYTES="${CLAUDEBOX_MAX_OUTPUT_BYTES:-67108864}"
}

cmd_start() {
  command -v docker >/dev/null 2>&1 || die "Docker not found. Install Docker Desktop."
  if ! docker info >/dev/null 2>&1; then
    log "Docker is not running. Starting Docker Desktop..."
    open -a Docker 2>/dev/null || die "Could not start Docker Desktop. Start it manually."
    for _ in $(seq 1 60); do
      docker info >/dev/null 2>&1 && break
      sleep 2
    done
    docker info >/dev/null 2>&1 || die "Docker did not start within two minutes."
  fi

  log "Starting Postgres, Redis, and MinIO"
  docker compose -f "$ROOT/docker-compose.dev.yml" up -d postgres redis minio >/dev/null
  for _ in $(seq 1 45); do
    pg=$(docker inspect -f '{{.State.Health.Status}}' erp-postgres 2>/dev/null || echo none)
    rd=$(docker inspect -f '{{.State.Health.Status}}' erp-redis 2>/dev/null || echo none)
    [ "$pg" = healthy ] && [ "$rd" = healthy ] && break
    sleep 2
  done
  [ "${pg:-}" = healthy ] || die "Postgres did not become healthy."
  [ "${rd:-}" = healthy ] || die "Redis did not become healthy."

  # The dev database lives on the Postgres 18 volume. Catch a compose file that
  # was reverted to the old image, which would silently open a stale database.
  local image
  image=$(docker inspect -f '{{.Config.Image}}' erp-postgres)
  case "$image" in
    postgres:18*) : ;;
    *) warn "erp-postgres is running $image, expected postgres:18-alpine. Check docker-compose.dev.yml before trusting the data." ;;
  esac

  load_gateway_env
  docker image inspect "$CLAUDEBOX_IMAGE" >/dev/null 2>&1 \
    || die "Image $CLAUDEBOX_IMAGE not found. Build it: cd .codex-repos/claudebox && docker build -t claudebox-local:test ."

  log "Starting the Claudebox gateway on 127.0.0.1:$CLAUDEBOX_PORT"
  (cd "$GATEWAY" && ./claudebox server >/dev/null)

  for _ in $(seq 1 30); do
    curl -fsS -m 3 "http://127.0.0.1:$CLAUDEBOX_PORT/health" >/dev/null 2>&1 && break
    sleep 2
  done
  curl -fsS -m 3 "http://127.0.0.1:$CLAUDEBOX_PORT/health" >/dev/null 2>&1 \
    || die "The gateway did not answer. Check: cd .codex-repos/claudebox && ./claudebox logs"

  cmd_status
  cat <<'NEXT'

Now open two more terminals:

  Terminal 2:  cd /Users/frage.ai/dev/ERP-System && npm run dev --workspace=@erp/api
  Terminal 3:  cd /Users/frage.ai/dev/ERP-System && npm run dev --workspace=@erp/web

Then sign in at http://localhost:3000 and open Video Registry.
NEXT
}

cmd_status() {
  printf '\n'
  log "Docker services"
  docker ps --filter name=erp- --filter name=claudebox \
    --format '    {{.Names}}  {{.Status}}  {{.Ports}}' 2>/dev/null || true

  printf '\n'
  log "Claudebox gateway"
  local port="${CLAUDEBOX_PORT:-3100}"
  if curl -fsS -m 3 "http://127.0.0.1:$port/health" 2>/dev/null | \
      node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);
        console.log("    health: "+j.status+"  active: "+j.activeRequests+"  signed runs required: "+j.signedRunsRequired);
        console.log("    runs: started "+j.runs.started+", completed "+j.runs.completed+", failed "+j.runs.failed+", cancelled "+j.runs.cancelled);
        if (j.runs.lastError) console.log("    last error: "+j.runs.lastError);})'; then :; else
    echo "    not answering on 127.0.0.1:$port"
  fi

  printf '\n'
  log "ERP processes"
  if curl -fsS -o /dev/null -m 3 "http://127.0.0.1:3001/api/v1/creative-agent/ai/config" 2>/dev/null; then
    echo "    API      http://127.0.0.1:3001  (unexpected: AI config answered without a token)"
  elif curl -s -o /dev/null -w '%{http_code}' -m 3 "http://127.0.0.1:3001/api/v1/creative-agent/ai/config" 2>/dev/null | grep -q 401; then
    echo "    API      http://127.0.0.1:3001  running"
  else
    echo "    API      not running   ->  npm run dev --workspace=@erp/api"
  fi
  if curl -s -o /dev/null -m 5 "http://127.0.0.1:3000/" 2>/dev/null; then
    echo "    Web      http://localhost:3000  running"
  else
    echo "    Web      not running   ->  npm run dev --workspace=@erp/web"
  fi
  printf '\n'
}

cmd_stop() {
  load_gateway_env
  log "Stopping the Claudebox gateway (Postgres, Redis, and MinIO stay up)"
  (cd "$GATEWAY" && ./claudebox stop)
}

cmd_logs() {
  docker logs -f --tail 50 "${CLAUDEBOX_NAME:-claudebox}"
}

case "${1:-status}" in
  start)  cmd_start ;;
  status) load_gateway_env 2>/dev/null || true; cmd_status ;;
  stop)   cmd_stop ;;
  logs)   cmd_logs ;;
  *)      die "Usage: $0 {start|status|stop|logs}" ;;
esac
