# Creative AI production rollout

Creative AI runs through Claudebox, a sandboxed Claude Code gateway that uses
each tenant's own Claude subscription. Tenant admins connect their account from
Settings → AI; credentials live in a Docker volume on the gateway host, never in
the database and never in the browser.

**Deployment shape: a second droplet.** The gateway image is 2.84 GB and a run
can use up to 3 GB of memory. The existing ERP droplet is 2 vCPU / 4 GB and
already carries api, worker, web, admin, redis and caddy with no memory limits,
so the gateway does not fit there. It also holds tenant Claude credentials,
which are better kept off the host serving public web traffic.

```
Droplet A (existing, 4 GB)          Droplet B (new, 2 GB)
  api, worker, web, admin             claudebox
  redis, caddy                        tenant credentials volume
        |                                   |
        +--------- VPC private network -----+
              wss/ws to 10.x.x.x:3000 (signed run tokens)
                          |
                    object storage
              (frames handed over between hosts)
```

**No new database.** The gateway contains no database code. Every Creative AI
table is already in the managed Postgres and its migrations run in the normal
deploy step.

---

## 1. Publish the gateway image (required first)

The fork in `.codex-repos/claudebox` still points at the original author and has
uncommitted changes, so nothing but your laptop can build it today.

```bash
cd .codex-repos/claudebox
git remote set-url origin git@github.com:<your-org>/claudebox.git
git add -A
git commit -m "feat: ERP gateway"
git push -u origin main
```

Its workflow then tests, smoke-tests in mock mode, and publishes
`ghcr.io/<your-org>/claudebox`. Make the package public, or run
`docker login ghcr.io` once on droplet B with a read token.

Record the published digest; pin that rather than `:latest`.

## 2. Create droplet B

- **Size:** Basic, 2 vCPU / 2 GB RAM / 50 GB disk (about $18/month). The image
  is 2.84 GB, the gateway idles near 50 MB, and one analysis peaks near 300 MB.
  2 GB is comfortable for `CLAUDEBOX_MAX_CONCURRENT=2`.
- **Region:** the same region as droplet A, so they share a VPC.
- **Networking:** enable the VPC both droplets share. Note droplet B's private
  IP (`10.x.x.x`).
- **Firewall:** allow inbound TCP 3000 **only** from droplet A's private IP.
  The gateway must never be reachable from the public internet.

Install Docker, then create the file below at `/opt/claudebox/compose.yml`.

## 3. Droplet B: the gateway service

```yaml
services:
  claudebox:
    image: ghcr.io/<your-org>/claudebox@sha256:<digest>
    container_name: erp-claudebox-prod
    cap_add: [NET_ADMIN]
    security_opt: [no-new-privileges:true]
    ports:
      # Bind to the private interface only, never 0.0.0.0.
      - "10.x.x.x:3000:3000"
    environment:
      CLAUDEBOX_API_KEY: ${CLAUDEBOX_API_KEY}
      CLAUDEBOX_RUN_SIGNING_SECRET: ${AI_AGENT_SIGNING_SECRET}
      CLAUDEBOX_PROCESS_TIMEOUT_MS: "3900000"
      MAX_CONCURRENT: "2"
      CLAUDEBOX_FIREWALL_REFRESH_SECONDS: "900"
    volumes:
      - claudebox_workspace:/workspace:ro
      - claudebox_tenant_auth:/home/claude/.erp-ai-auth
    mem_limit: 1500m
    pids_limit: 256
    restart: unless-stopped
    logging:
      driver: json-file
      options: { max-size: "20m", max-file: "5" }

volumes:
  claudebox_workspace:
  claudebox_tenant_auth:
```

Start it with the two secrets in `/opt/claudebox/.env`:

```bash
cd /opt/claudebox && docker compose up -d && curl -s localhost:3000/health
```

## 4. Handing frames between the droplets

This is the one piece the same-droplet design did not need. The worker extracts
frames on droplet A; the gateway reads them on droplet B. They cannot share a
volume, so the files travel through the object storage you already run.

**Not yet implemented.** The worker currently writes frames to a local volume
and the gateway reads that volume. Splitting the hosts needs:

1. the worker to upload the prepared run folder (frames plus the two JSON
   context files, about 4 MB per video run) to object storage after
   preprocessing;
2. the gateway to fetch that folder into `/workspace/<tenant>/<run>` before the
   model call, and delete it afterwards;
3. `allowed-domains.txt` in the gateway image to include the object-storage
   host, since egress is deny-by-default.

Until that exists, droplet B cannot see the frames. Options:

- **Do step 4 first** (roughly a day's work), then deploy as above.
- **Or deploy on droplet A after resizing it** to 8 GB (about $24/month more),
  which needs no code change at all: set `COMPOSE_PROFILES=ai` and redeploy.

Resizing droplet A is the cheaper and faster route to a working production
feature. The two-droplet split is the better end state.

## 5. Droplet A: environment

Add to the protected production environment file:

```dotenv
AI_AGENT_ENABLED=true
NEXT_PUBLIC_AI_AGENT_ENABLED=true

# Same-droplet deployment only:
# COMPOSE_PROFILES=ai
# CLAUDEBOX_IMAGE=ghcr.io/<your-org>/claudebox@sha256:<digest>

# Two-droplet deployment: point at droplet B's private IP.
CLAUDEBOX_WS_URL=ws://10.x.x.x:3000/ws
CLAUDEBOX_HTTP_URL=http://10.x.x.x:3000

CLAUDEBOX_API_KEY=<openssl rand -hex 32>
AI_AGENT_SIGNING_SECRET=<openssl rand -hex 32>
CREATIVE_AI_QUEUE_CONCURRENCY=1
CREATIVE_AI_WORKSPACE_RETENTION_DAYS=14

# Audio transcription: the whisper service in docker-compose.prod.yml. The
# URL defaults to http://whisper:3110 in the compose file; set the language
# to pin Tagalog (tl) or leave blank to auto-detect. Model size is baked into
# the image at build time (small by default; base is lighter, medium better).
CREATIVE_AI_WHISPER_LANGUAGE=
CREATIVE_AI_WHISPER_MODEL=small
WHISPER_MEMORY_LIMIT=1536m
```

The whisper image is built by the deploy workflow beside api, web and admin.
Its first build downloads the model (a few minutes); later builds are cached.
Scene thumbnails from every analysis go to object storage, so the same
`OBJECT_STORAGE_*` settings the rest of the ERP uses must be present.

Both secrets must be identical on the two hosts. The gateway refuses to start
without the signing secret, and a run whose token does not verify is rejected.

## 6. Deploy and verify

Push to `main` as usual. Then:

```bash
# On droplet A, from inside the api container:
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T api \
  node -e "fetch('http://10.x.x.x:3000/health').then(r=>r.json()).then(console.log)"
```

Expect `status: ok` with `signedRunsRequired: true`. Check the transcription
service the same way:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T worker \
  node -e "fetch('http://whisper:3110/health').then(r=>r.json()).then(console.log)"
```

Expect `ok: true` with the model name. Then confirm the gateway is
**not** reachable publicly:

```bash
curl -m 5 http://<droplet B public IP>:3000/health   # must fail
```

## 7. Connect the first tenant

Sign in as that tenant's Tenant Admin, open Settings → AI, press **Connect
Claude**, finish the sign-in, then **Test**. Assign each store a product
category on the same page. Run one analysis from Video Registry.

## 8. What runs on its own

- The worker closes runs that stop responding (every 5 minutes) and purges run
  folders after the retention window (hourly). Uploads are deleted as soon as
  frames exist.
- The gateway re-resolves its egress allowlist every 15 minutes, restarts on
  failure, and reports run counters on `/health`.
- Users can cancel a queued or running analysis from the dialog.

## 9. Rollback

Set `AI_AGENT_ENABLED=false` and redeploy droplet A. The AI endpoints answer
503 and the UI entry points disappear. Droplet B can keep running; tenant
credentials stay in its volume for the next attempt.

## 10. Operational notes

- Tenant credentials in `claudebox_tenant_auth` are plaintext files. Keep
  droplet B's disk encrypted and its SSH access limited.
- Runs draw on each tenant's Claude subscription, so the dollar figure in a run
  record is a usage equivalent, not a charge. Plan limits, not cost, are what
  stop a busy tenant.
- To bump Claude Code, change `CLAUDE_CODE_VERSION` in the gateway Dockerfile,
  let the workflow publish, run one mock smoke and one real analysis, then move
  the pinned digest.
