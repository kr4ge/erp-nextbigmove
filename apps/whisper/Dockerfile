# Whisper transcription service for creative analysis.
#
# Its own container because the API image is Alpine, where the Whisper
# runtimes do not install. faster-whisper runs OpenAI's Whisper weights on
# CTranslate2 with int8 quantisation: a fraction of the memory and several
# times the speed of the reference package on a small CPU box, which is what
# makes the `small` model (the first size that handles Tagalog well) fit on
# a 4 GB droplet.
FROM python:3.11-slim

ARG WHISPER_MODEL=small
ENV WHISPER_MODEL=${WHISPER_MODEL} \
    HF_HOME=/models \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN pip install faster-whisper

# Bake the model into the image so a fresh container never downloads at run time.
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', device='cpu', compute_type='int8')"

WORKDIR /app
COPY apps/whisper/server.py ./server.py

EXPOSE 3110
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:3110/health', timeout=4).status == 200 else 1)"

CMD ["python", "server.py"]
