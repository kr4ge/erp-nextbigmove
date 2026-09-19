# Creative AI local runbook

This local-first slice lets an authenticated ERP user upload a video for an
existing Creative record. ERP keeps tenant and owner scoping, extracts visual
frames locally, loads linked Meta and reconciled-order aggregates, and sends a
read-only analysis workspace to Claudebox over a signed WebSocket request.

The browser never receives the Claudebox API key or signing secret. Google
Drive ingestion is not enabled in this first slice; download the Drive video
and upload it through the ERP endpoint while testing locally.

## Quick start (everyday use)

Once the one-time setup in sections 1 to 4 is done, three terminals are all it
takes. The helper script starts Docker, Postgres, Redis, MinIO, and the gateway,
reading both secrets from `apps/api/.env` so they cannot drift apart:

```bash
# Terminal 1 — infrastructure and the AI gateway
cd /Users/frage.ai/dev/ERP-System
./scripts/creative-ai-dev.sh start

# Terminal 2 — ERP API and Creative AI worker
cd /Users/frage.ai/dev/ERP-System
npm run dev --workspace=@erp/api

# Terminal 3 — ERP web app
cd /Users/frage.ai/dev/ERP-System
npm run dev --workspace=@erp/web
```

Then open `http://localhost:3000`, sign in, and go to Video Registry.

Other commands: `./scripts/creative-ai-dev.sh status` shows what is running and
the gateway's run counters, `logs` follows the gateway log, and `stop` stops the
gateway while leaving the databases up. The sections below explain the one-time
setup and what each step does.

## 1. Prerequisites

- Local Postgres and Redis used by ERP are running.
- Docker is running.
- `ffmpeg` and `ffprobe` are available (`ffmpeg -version`).
- For the legacy host-token launch, Claude Code is logged in on this Mac.
  When using the recommended ERP UI login below, the host may remain logged out.
- Codex CLI is installed if you want Codex as a second provider. It may be
  connected later from ERP Settings; a host login is not required for that flow.
- The customized Claudebox image exists as `claudebox-local:test`.

Rebuild the image after any change under `.codex-repos/claudebox` (the
launcher script is the only file that is not baked in):

```bash
cd /Users/frage.ai/dev/ERP-System/.codex-repos/claudebox
npm test
docker build -t claudebox-local:test .
./claudebox stop && ./claudebox server   # with the exports from step 5
```

## 2. Apply the additive schema changes

From the ERP root:

```bash
cd /Users/frage.ai/dev/ERP-System
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npx prisma generate --schema=apps/api/prisma/schema.prisma
```

These migrations create `creative_ai_runs` and add the narrow Creative AI
permissions. They do not truncate or replace existing data.

## 3. Create two local secrets

Generate two different values and keep them in your password manager while
testing:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

- The first is the private Claudebox gateway key.
- The second is the shared run-signing secret.

Do not commit either value and do not put them in any `NEXT_PUBLIC_*` variable.

## 4. Configure the API `.env`

The API workspace runs with `apps/api` as its working directory, so add the
following values to `/Users/frage.ai/dev/ERP-System/apps/api/.env`, replacing
the two placeholders with the generated secrets:

```dotenv
AI_AGENT_ENABLED=true
CLAUDEBOX_WS_URL=ws://127.0.0.1:3100/ws
CLAUDEBOX_HTTP_URL=http://127.0.0.1:3100
CLAUDEBOX_API_KEY=<private-gateway-key>
AI_AGENT_SIGNING_SECRET=<shared-run-signing-secret>
CREATIVE_AI_WORKSPACE_ROOT=/Users/frage.ai/dev/ERP-System/apps/api/tmp/creative-ai
CREATIVE_AI_UPLOAD_TMP_DIR=/Users/frage.ai/dev/ERP-System/apps/api/tmp/creative-ai-uploads
CREATIVE_AI_MAX_VIDEO_MB=250
CREATIVE_AI_MAX_VIDEO_SECONDS=600
CREATIVE_AI_MODEL=sonnet
CREATIVE_AI_QUEUE_CONCURRENCY=1
PROCESS_ROLE=all
```

`PROCESS_ROLE=all` is important locally: it starts the HTTP API and the Creative
AI Bull worker in the same Nest process.

The web app has its own build-time switch. Add this to
`/Users/frage.ai/dev/ERP-System/apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_AI_AGENT_ENABLED=true
```

Both switches must be enabled locally. Production omits the public switch, so
the AI settings tab and analysis action remain hidden there even though the
implementation is present in the deployed source.

## 5. Start the signed Claudebox service

In a dedicated terminal, export the same two values used in `.env`:

```bash
cd /Users/frage.ai/dev/ERP-System/.codex-repos/claudebox
mkdir -p /Users/frage.ai/dev/ERP-System/apps/api/tmp/creative-ai
export CLAUDEBOX_IMAGE=claudebox-local:test
export CLAUDEBOX_PORT=3100
export CLAUDEBOX_API_KEY='<private-gateway-key>'
export CLAUDEBOX_RUN_SIGNING_SECRET='<shared-run-signing-secret>'
export CLAUDEBOX_WORKSPACE_HOST='/Users/frage.ai/dev/ERP-System/apps/api/tmp/creative-ai'
export CLAUDEBOX_MAX_OUTPUT_BYTES=67108864
# Keep provider credentials in the named Docker volume and manage them from ERP.
export CLAUDEBOX_AUTH_FROM_UI=1
./claudebox server
```

The launcher refuses to start without the signing secret, applies a restart
policy (`unless-stopped`), a 3 GB memory limit, a process limit, log rotation,
and the image's own health check. Tenant credentials always live in the Docker
volume `claudebox-tenant-auth`, whatever the container is called, so a restart
under a different name can no longer make tenants look disconnected.

Confirm it is local and healthy:

```bash
curl http://127.0.0.1:3100/health
docker ps --filter name=claudebox --format '{{.Names}} {{.Status}}'
```

The health response includes run counters (`started`, `completed`, `failed`,
`cancelled`, `rejected`, `lastError`). After a while `docker ps` shows the
container as `healthy`.

The workspace is mounted into the container as `/workspace:ro`. Claudebox can
read generated frames and JSON context, but cannot change ERP files.

## 5.1 Connect Claude or Codex from ERP

After the API and frontend are running, sign in as the active tenant's
**Tenant Admin**, open **Settings → AI**, and use **Connect Claude** or
**Connect Codex**. The
dialog shows a familiar one-time code and sign-in link when the provider uses
device authorization, then updates automatically.

Credentials are stored under an isolated tenant profile in the gateway's named
Docker volume, not in ERP's database and never in the browser. A tenant admin
can replace only their active tenant's account. Signed analysis requests carry
the tenant identity so the worker cannot use another tenant's credentials.

## 6. Start ERP API and worker

In another terminal:

```bash
cd /Users/frage.ai/dev/ERP-System
npm run dev --workspace=@erp/api
```

The API should listen on `http://127.0.0.1:3001/api/v1`. If port 3001 is already
in use, stop the old API process before starting this one; do not run two API
instances against the same local worker queues while testing.

## 7. Start the ERP frontend

In another terminal:

```bash
cd /Users/frage.ai/dev/ERP-System
npm run dev --workspace=@erp/web
```

Open `http://localhost:3000/video-registry` and sign in normally. The frontend
uses the existing ERP session automatically; no JWT needs to be copied for the
normal full-stack test.

## 8. Run the full-stack test in Video Registry

1. Open an enrolled creative from the tile or table view.
2. Click **Analyze creative** under **AI creative analysis**.
3. Choose the original local file: MP4, MOV, M4V, or WebM for a video
   creative, or JPG, PNG, or WebP for a static one. The upload must match the
   creative's kind; the API rejects a mismatch with a plain message.
4. Confirm the performance period. There is no free-text question: every
   run follows the same fixed method, with a lens chosen from the creative's
   performance status (Draft, Live, Winner, Fatigued, Retired). The advertising
   team can add house rules under **Settings → AI → Analysis prompt**; they are
   appended to every run and audited.
5. Click **Start analysis**.
6. Keep the dialog open to watch `Queued`, `Preparing video`, `Loading
   performance`, `Analyzing`, and `Complete`.
7. Review the result. Static creatives are scored on the same six categories
   as video, but the method differs: "hook" is what the eye lands on first and
   "story & pacing" is reading order and layout, so findings name a region of
   the image instead of a timestamp, and video engagement rates are reported
   as not applicable rather than missing. The Overview tab shows the verdict, a score per
   category, compliance flags, and the three highest-impact actions; each
   category tab (Hook, Story & pacing, Message & offer, Product & proof, Call
   to action, Performance) shows its score, verdict, timestamped evidence, and
   recommendations; the Tests tab lists every recommendation by priority.
   Runs made before this format keep their older flat layout.
8. To stop a run early, press **Cancel analysis** under the start button. A
   queued run is dropped from the queue; a running one is stopped at its next
   stage, or the model call is aborted through the gateway.

The uploaded video is deleted from the workspace as soon as frames are
extracted (its SHA-256 stays on the run). Frames and context files are purged
14 days after a run finishes (`CREATIVE_AI_WORKSPACE_RETENTION_DAYS`), and a
run that stops reporting progress is closed as failed by the worker's sweeper.

The button is shown only to users with `creative_agent.ai.use`. Creative Maker,
Creative Reviewer, and Creative Manager receive AI usage from the migration.
Tenant Admin receives `creative_agent.ai.manage` for tenant credentials and
Settings → AI, but does not receive `creative_agent.ai.use` or access to the
Creative Assets and Video Registry modules.

## 9. Optional API-only diagnostic

Use an ERP access token belonging to a user with `creative_agent.ai.use`. A
Creative user can analyze only their own VIDEO records. Creative Reviewer and
Creative Manager roles can inspect tenant-wide runs through their existing
read-all scope.

```bash
export ERP_ACCESS_TOKEN='<erp-jwt-access-token>'
export CREATIVE_ID='<existing-video-creative-uuid>'

curl -X POST http://127.0.0.1:3001/api/v1/creative-agent/ai/runs \
  -H "Authorization: Bearer ${ERP_ACCESS_TOKEN}" \
  -F "creativeId=${CREATIVE_ID}" \
  -F "startDate=2026-08-10" \
  -F "endDate=2026-09-08" \
  -F "question=Explain why this video is or is not working and propose three measurable tests." \
  -F "video=@/absolute/path/to/video.mp4"
```

The response contains the run ID and normally starts in `QUEUED`. The API never
returns the server-side source path.

## 10. Poll an API-only run

```bash
export CREATIVE_AI_RUN_ID='<run-id-from-the-create-response>'

curl http://127.0.0.1:3001/api/v1/creative-agent/ai/runs/${CREATIVE_AI_RUN_ID} \
  -H "Authorization: Bearer ${ERP_ACCESS_TOKEN}"
```

Normal stages are `QUEUED`, `PREPROCESSING`, `CONTEXT_BUILDING`, `ANALYZING`,
and `COMPLETED`. A failed run keeps a safe error message in `errorMessage`.

The result distinguishes observed visual evidence, measured performance, and
hypotheses. Null/unmeasured rates remain unknown rather than being converted to
zero. Only aggregated marketing/order metrics are included; customer and
order-level PII are not sent to Claudebox.

## 11. Audio transcription

Without a transcript the model is deaf: it judges the ad on frames plus the
script typed at enrollment, and every run carries the warning
`AUDIO_TRANSCRIPTION_NOT_CONFIGURED`. Two ways to give it ears; the service
wins when both are set.

**The Whisper service (what production runs).** A container from
`apps/whisper` running OpenAI's Whisper weights through faster-whisper, model
`small` by default. Start it once and point the API at it:

```bash
docker compose -f docker-compose.dev.yml --profile ai up -d whisper
curl -s localhost:3110/health
```

```dotenv
CREATIVE_AI_WHISPER_URL=http://127.0.0.1:3110
CREATIVE_AI_WHISPER_LANGUAGE=tl   # optional; blank lets Whisper detect
```

The first build downloads the model into the image (a few minutes). The
container answers `/health` at once and loads the model on the first request.

**A local Whisper CLI instead.** `pip install openai-whisper`, then:

```dotenv
CREATIVE_AI_WHISPER_BIN=/absolute/path/to/whisper
CREATIVE_AI_WHISPER_MODEL=small
```

Restart the API after changing `.env`. A completed transcript shows in
`video-timeline.json` as `transcript.status: COMPLETED` with timestamped
segments, and the storyboard tab quotes from it.

### Scene sampling

Preprocessing detects cuts, samples one frame a second, and tiles everything
onto contact sheets with the timestamp printed in each cell (amber for the
first frame of a scene). Full-size frames are kept for the hook and for each
scene start. The tunables, all optional:

```dotenv
CREATIVE_AI_SCENE_THRESHOLD=0.3      # cut sensitivity, 0.05..0.95
CREATIVE_AI_MAX_SCENES=40
CREATIVE_AI_MAX_GRID_FRAMES=90       # above this many seconds, sampling stretches
CREATIVE_AI_PUSH_BUDGET_BYTES=8000000 # frames + sheets pushed to the gateway
```

Scene thumbnails are stored in object storage (`creative_ai_run_frames`), so
MinIO must be up locally for the storyboard to show pictures. Warnings a run
can report from this stage: `SCENE_CUTS_TRUNCATED`, `FRAME_PUSH_BUDGET_TRIMMED`,
`FRAME_STORAGE_NOT_CONFIGURED`, `VIDEO_HAS_NO_AUDIO`, and `CHECK_*` for
claims the verifier could not support against the manifest.

## 12. Stop the local gateway

```bash
cd /Users/frage.ai/dev/ERP-System/.codex-repos/claudebox
./claudebox stop
```

Because the container has a restart policy, `docker stop` alone would let
Docker Desktop bring it back on the next daemon restart; `./claudebox stop`
removes it. Tenant credentials remain in the `claudebox-tenant-auth` volume.

Keep `AI_AGENT_ENABLED=false` whenever the local gateway is intentionally off.
