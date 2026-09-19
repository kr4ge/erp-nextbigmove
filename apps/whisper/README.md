# Whisper service

Transcribes the audio of a creative for the AI analysis. Runs beside the ERP
worker as its own container because the API image is Alpine and PyTorch does
not install there.

OpenAI's open-source Whisper weights run through faster-whisper (CTranslate2,
int8) on your own server. No OpenAI account, no key, nothing leaves the
network. Several times faster and a fraction of the memory of the reference
package, which is what lets the `small` model run on a 4 GB droplet.

## How the worker uses it

The worker extracts the audio with ffmpeg and posts the WAV to
`POST /transcribe`. The answer is the text and timestamped segments, which
land in `video-timeline.json` for the model and in the storyboard. The
worker finds the service through `CREATIVE_AI_WHISPER_URL`; production sets
it to `http://whisper:3110` in the compose file.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `WHISPER_MODEL` | `small` | Model size. `base` is faster but weak on Tagalog; `medium` is better still but needs about 2 GB. |
| `WHISPER_COMPUTE_TYPE` | `int8` | Quantisation. `int8` is the right choice on CPU. |
| `WHISPER_THREADS` | `2` | CPU threads for inference. |
| `WHISPER_BEAM_SIZE` | `5` | Decoding beam. Lower to 1 for speed at some accuracy cost. |
| `WHISPER_IDLE_UNLOAD_SECONDS` | `600` | Release the model after this long without a request. `0` keeps it loaded. |
| `WHISPER_MAX_AUDIO_BYTES` | `67108864` | Largest accepted body. |
| `CREATIVE_AI_WHISPER_LANGUAGE` | unset | Set on the worker, not here. `tl` pins Tagalog; unset lets Whisper detect. |

Memory during a transcription is roughly 500 MB for `base` and 1 GB for
`small`; idle, after the unload, under 150 MB. A 60-second ad takes about
half a minute on two cores with `small`.

## Local

```bash
docker compose -f docker-compose.dev.yml --profile ai up -d whisper
curl -s localhost:3110/health
```

Then in `apps/api/.env`:

```dotenv
CREATIVE_AI_WHISPER_URL=http://127.0.0.1:3110
```
