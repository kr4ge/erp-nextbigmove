/**
 * One place for every Creative AI time budget, so the queue job timeout, the
 * stuck-run sweeper, and the media step never disagree about how long a run
 * is allowed to take.
 */

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export const CREATIVE_AI_PROBE_TIMEOUT_MS = 30_000;
export const CREATIVE_AI_HOOK_FRAMES_TIMEOUT_MS = 120_000;
export const CREATIVE_AI_TIMELINE_FRAMES_TIMEOUT_MS = 180_000;
export const CREATIVE_AI_AUDIO_EXTRACT_TIMEOUT_MS = 180_000;

/**
 * How long the model call itself may take (also the ERP socket timeout).
 * The tenant's policy sets a per-run ceiling in minutes; this env value is the
 * outer bound the ERP will wait regardless, so it must be at least as large as
 * the largest policy value (60 minutes).
 */
export function creativeAiRunTimeoutMs(maxRunMinutes?: number) {
  const envCeiling = positiveInt(process.env.CREATIVE_AI_RUN_TIMEOUT_MS, 65 * 60 * 1000);
  if (!maxRunMinutes) return envCeiling;
  // Give the gateway a moment to report its own timeout before ERP gives up.
  return Math.min(envCeiling, maxRunMinutes * 60_000 + 30_000);
}

export function creativeAiTranscriptionTimeoutMs() {
  return positiveInt(process.env.CREATIVE_AI_TRANSCRIPTION_TIMEOUT_MS, 20 * 60 * 1000);
}

/** Worst case for probe + frame extraction + optional audio + transcription. */
export function creativeAiPreprocessingBudgetMs() {
  const whisperConfigured = Boolean(process.env.CREATIVE_AI_WHISPER_BIN?.trim());
  return CREATIVE_AI_PROBE_TIMEOUT_MS
    + CREATIVE_AI_HOOK_FRAMES_TIMEOUT_MS
    + CREATIVE_AI_TIMELINE_FRAMES_TIMEOUT_MS
    + (whisperConfigured ? CREATIVE_AI_AUDIO_EXTRACT_TIMEOUT_MS + creativeAiTranscriptionTimeoutMs() : 0);
}

/**
 * The Bull job timeout. Preprocessing and the model call run inside the same
 * job, so the job must be allowed to outlast both plus a margin for database
 * work; otherwise a long transcription makes the job time out and retry, and
 * the model is paid for twice.
 */
export function creativeAiJobTimeoutMs(maxRunMinutes?: number) {
  return creativeAiPreprocessingBudgetMs() + creativeAiRunTimeoutMs(maxRunMinutes) + 60_000;
}

/** Extra time past the job timeout before the sweeper closes a silent run. */
export function creativeAiStaleRunGraceMs() {
  return positiveInt(process.env.CREATIVE_AI_STALE_RUN_GRACE_MS, 2 * 60 * 1000);
}
