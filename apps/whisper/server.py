"""
Whisper transcription service for the ERP's creative analysis.

The API image is Alpine, where the Whisper runtimes cannot be installed, so
transcription runs here instead: a small HTTP server that loads OpenAI's
Whisper weights through faster-whisper once, transcribes the 16 kHz mono WAV
the worker posts, and answers with the text and timestamped segments. Nothing
leaves the network; there is no OpenAI account involved. The model is
released after a quiet period so an idle box gets its memory back.

Endpoints
  GET  /health                       -> {"ok": true, "model": "small", "loaded": false}
  POST /transcribe?language=tl       -> {"text": ..., "language": ..., "segments": [{"start","end","text"}]}
       body: audio/wav (or any format PyAV decodes), at most WHISPER_MAX_AUDIO_BYTES
"""

import gc
import json
import os
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

MODEL_NAME = os.environ.get("WHISPER_MODEL", "small")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
PORT = int(os.environ.get("WHISPER_PORT", "3110"))
THREADS = int(os.environ.get("WHISPER_THREADS", "2"))
BEAM_SIZE = int(os.environ.get("WHISPER_BEAM_SIZE", "5"))
IDLE_UNLOAD_SECONDS = int(os.environ.get("WHISPER_IDLE_UNLOAD_SECONDS", "600"))
MAX_AUDIO_BYTES = int(os.environ.get("WHISPER_MAX_AUDIO_BYTES", str(64 * 1024 * 1024)))

_lock = threading.Lock()
_model = None
_last_used = 0.0


def _load():
    """Load the model on first use; the import is deferred so /health answers at once."""
    global _model, _last_used
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(MODEL_NAME, device="cpu", compute_type=COMPUTE_TYPE, cpu_threads=THREADS, num_workers=1)
    _last_used = time.time()
    return _model


def _unload_when_idle():
    global _model
    while True:
        time.sleep(30)
        with _lock:
            if _model is not None and IDLE_UNLOAD_SECONDS > 0 and time.time() - _last_used > IDLE_UNLOAD_SECONDS:
                _model = None
                gc.collect()


class Handler(BaseHTTPRequestHandler):
    server_version = "erp-whisper/1.0"

    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # one line per request in the container log
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)

    def do_GET(self):
        if urlparse(self.path).path == "/health":
            self._json(200, {"ok": True, "model": MODEL_NAME, "computeType": COMPUTE_TYPE, "loaded": _model is not None})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/transcribe":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            self._json(400, {"error": "empty body; post the audio bytes"})
            return
        if length > MAX_AUDIO_BYTES:
            self._json(413, {"error": "audio exceeds WHISPER_MAX_AUDIO_BYTES"})
            return
        query = parse_qs(url.query)
        language = (query.get("language") or [None])[0] or None

        audio = self.rfile.read(length)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
            handle.write(audio)
            path = handle.name
        try:
            with _lock:
                started = time.time()
                # vad_filter drops long silences before decoding, which is
                # both faster and less prone to hallucinated lines in gaps.
                generator, info = _load().transcribe(path, language=language, beam_size=BEAM_SIZE, vad_filter=True)
                segments = [
                    {"start": round(float(s.start), 3), "end": round(float(s.end), 3), "text": s.text.strip()}
                    for s in generator
                    if s.text and s.text.strip()
                ]
                seconds = round(time.time() - started, 1)
            print("transcribed %d bytes in %ss, %d segments, language %s" % (length, seconds, len(segments), info.language), flush=True)
            self._json(200, {
                "text": " ".join(s["text"] for s in segments),
                "language": info.language,
                "languageProbability": round(float(info.language_probability or 0), 3),
                "segments": segments,
                "model": MODEL_NAME,
                "seconds": seconds,
            })
        except Exception as error:  # noqa: BLE001 - the worker records the message as a warning
            print("transcription failed: %s" % error, flush=True)
            self._json(500, {"error": str(error)[:500]})
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass


if __name__ == "__main__":
    threading.Thread(target=_unload_when_idle, daemon=True).start()
    print("whisper service listening on :%d (model %s, %s, %d threads)" % (PORT, MODEL_NAME, COMPUTE_TYPE, THREADS), flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
