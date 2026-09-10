# Creative AI local runbook

This local-first slice lets an authenticated ERP user upload a video for an
existing Creative record. ERP keeps tenant and owner scoping, extracts visual
frames locally, loads linked Meta and reconciled-order aggregates, and sends a
read-only analysis workspace to Claudebox over a signed WebSocket request.

The browser never receives the Claudebox API key or signing secret. Google
Drive ingestion is not enabled in this first slice; download the Drive video
and upload it through the ERP endpoint while testing locally.

## 1. Prerequisites

- Local Postgres and Redis used by ERP are running.
- Docker is running.
- `ffmpeg` and `ffprobe` are available (`ffmpeg -version`).
- For the legacy host-token launch, Claude Code is logged in on this Mac.
  When using the recommended ERP UI login below, the host may remain logged out.
- Codex CLI is installed if you want Codex as a second provider. It may be
  connected later from ERP Settings; a host login is not required for that flow.
- The customized Claudebox image exists as `claudebox-local:test`.

If the image needs to be rebuilt:

```bash
cd /Users/frage.ai/dev/ERP-System/.codex-repos/claudebox
docker build -t claudebox-local:test .
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
export CLAUDEBOX_NAME=claudebox-erp
export CLAUDEBOX_PORT=3100
export CLAUDEBOX_API_KEY='<private-gateway-key>'
export CLAUDEBOX_RUN_SIGNING_SECRET='<shared-run-signing-secret>'
export CLAUDEBOX_WORKSPACE_HOST='/Users/frage.ai/dev/ERP-System/apps/api/tmp/creative-ai'
export CLAUDEBOX_MAX_OUTPUT_BYTES=67108864
# Keep provider credentials in named Docker volumes and manage them from ERP.
export CLAUDEBOX_AUTH_FROM_UI=1
./claudebox server
```

Confirm it is local and healthy:

```bash
curl http://127.0.0.1:3100/health
```

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

1. Open an enrolled video from the tile or table view.
2. Click **Analyze video** under **Creative AI analysis**.
3. Choose the original local MP4, MOV, M4V, or WebM file.
4. Confirm the performance period and edit the analysis question if needed.
5. Click **Start video analysis**.
6. Keep the dialog open to watch `Queued`, `Preparing video`, `Loading
   performance`, `Analyzing`, and `Complete`.
7. Review the verdict, evidence timeline, risks, and recommended tests.

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

## 11. Optional local audio transcription

Visual analysis works without Whisper. If `CREATIVE_AI_WHISPER_BIN` is blank,
the run explicitly reports `AUDIO_TRANSCRIPTION_NOT_CONFIGURED` and uses the
registered Creative script as context.

After installing the local Whisper CLI, set its executable path, for example:

```dotenv
CREATIVE_AI_WHISPER_BIN=/absolute/path/to/whisper
CREATIVE_AI_WHISPER_MODEL=base
```

Restart ERP after changing `.env`.

## 12. Stop the local gateway

```bash
cd /Users/frage.ai/dev/ERP-System/.codex-repos/claudebox
CLAUDEBOX_NAME=claudebox-erp ./claudebox stop
```

Keep `AI_AGENT_ENABLED=false` whenever the local gateway is intentionally off.
