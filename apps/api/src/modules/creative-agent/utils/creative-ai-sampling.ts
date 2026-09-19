/**
 * How a video is turned into something a vision model can read end to end.
 *
 * The model cannot watch a video. It reads still images. Sampling a still
 * every few seconds leaves the cuts, price cards and product reveals between
 * samples invisible, so the plan here is the one video-understanding systems
 * converge on: detect the cuts, sample once a second, and hand over both as
 * contact sheets with the timestamp printed in every cell, so a moment can be
 * cited without cross-referencing a manifest.
 *
 * Everything in this file is pure so it can be tested without ffmpeg.
 */

export type SceneSpan = { index: number; startSeconds: number; endSeconds: number };

export type FrameSample = {
  timestampSeconds: number;
  role: 'HOOK' | 'SCENE' | 'GRID';
  file: string;
  /** The detected scene this frame opens, when it opens one. */
  sceneIndex: number | null;
};

export type SheetLayout = {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  gutter: number;
};

export type TranscriptSegment = { start: number; end: number; text: string };

export type Pacing = {
  sceneCount: number;
  cutsPerMinute: number;
  firstCutAt: number | null;
  longestStaticRun: { startSeconds: number; endSeconds: number; seconds: number };
  hasSpeech: boolean;
  speechStartsAt: number | null;
  /** Share of the running time with someone speaking, 0 to 1. */
  speechCoverage: number | null;
  wordsPerMinute: number | null;
  /** Stretches of at least SILENCE_GAP_SECONDS with no speech, once speech has started. */
  silenceGaps: Array<{ startSeconds: number; endSeconds: number }>;
};

const SILENCE_GAP_SECONDS = 2.5;
/** Anthropic's preferred long edge; larger images are scaled down anyway. */
export const SHEET_LONG_EDGE = 1568;
const round = (value: number, places = 2) => Number(value.toFixed(places));

/**
 * Timestamps of the frames ffmpeg's `showinfo` filter reported. With a
 * `select='gt(scene,T)'` filter ahead of it, those are exactly the cuts.
 */
export function parseShowinfoTimestamps(stderr: string): number[] {
  const found = new Set<number>();
  for (const match of stderr.matchAll(/pts_time:\s*(-?[0-9]+(?:\.[0-9]+)?)/g)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value >= 0) found.add(round(value, 3));
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * Cut timestamps become scenes: the first starts at zero, each ends where the
 * next begins, the last ends at the duration. Cuts too close together (a
 * flash, a strobe) fold into their neighbour, and when the edit has more
 * scenes than the analysis can carry, the shortest are merged first so the
 * structure survives rather than the tail being dropped.
 */
export function planScenes(
  durationSeconds: number,
  cutTimestamps: number[],
  options: { maxScenes: number; minSceneSeconds: number },
): SceneSpan[] {
  const duration = Math.max(0, durationSeconds);
  const boundaries: number[] = [0];
  for (const cut of [...cutTimestamps].sort((a, b) => a - b)) {
    if (!Number.isFinite(cut) || cut <= 0 || cut >= duration - 0.05) continue;
    if (cut - boundaries[boundaries.length - 1] < options.minSceneSeconds) continue;
    boundaries.push(round(cut, 3));
  }
  let spans: SceneSpan[] = boundaries.map((start, index) => ({
    index,
    startSeconds: start,
    endSeconds: index + 1 < boundaries.length ? boundaries[index + 1] : round(duration, 3),
  }));
  spans = mergeShortestScenes(spans, Math.max(1, options.maxScenes));
  return spans.map((span, index) => ({ ...span, index }));
}

function mergeShortestScenes(spans: SceneSpan[], maxScenes: number): SceneSpan[] {
  const merged = spans.map((span) => ({ ...span }));
  while (merged.length > maxScenes) {
    let shortest = 0;
    for (let index = 1; index < merged.length; index += 1) {
      const length = merged[index].endSeconds - merged[index].startSeconds;
      const current = merged[shortest].endSeconds - merged[shortest].startSeconds;
      if (length < current) shortest = index;
    }
    // Fold into the previous scene; the first scene has no previous so it
    // absorbs the next one instead.
    if (shortest === 0) {
      merged[0].endSeconds = merged[1].endSeconds;
      merged.splice(1, 1);
    } else {
      merged[shortest - 1].endSeconds = merged[shortest].endSeconds;
      merged.splice(shortest, 1);
    }
  }
  return merged;
}

/** One frame a second, stretched only when the video is longer than the frame budget. */
export function gridIntervalSeconds(durationSeconds: number, maxGridFrames: number): number {
  if (durationSeconds <= maxGridFrames) return 1;
  return round(Math.ceil((durationSeconds / maxGridFrames) * 10) / 10, 1);
}

/**
 * How frames tile onto one sheet. Landscape and square frames go three by
 * three; a portrait frame, which is what most Meta ads are, goes four across
 * and two down so each cell keeps enough width to read on-screen text. The
 * sheet's long edge never exceeds SHEET_LONG_EDGE, so the model sees it at
 * the size it was built and the printed timestamps stay legible.
 */
export function sheetLayout(frameWidth: number, frameHeight: number, longEdge = SHEET_LONG_EDGE): SheetLayout {
  const gutter = 6;
  const portrait = frameHeight > frameWidth * 1.1;
  const columns = portrait ? 4 : 3;
  const rows = portrait ? 2 : 3;
  const aspect = frameHeight / Math.max(1, frameWidth);

  let cellWidth = Math.floor((longEdge - gutter * (columns + 1)) / columns);
  let cellHeight = Math.round(cellWidth * aspect);
  let sheetHeight = rows * cellHeight + gutter * (rows + 1);
  if (sheetHeight > longEdge) {
    const factor = (longEdge - gutter * (rows + 1)) / (rows * cellHeight);
    cellWidth = Math.floor(cellWidth * factor);
    cellHeight = Math.round(cellWidth * aspect);
    sheetHeight = rows * cellHeight + gutter * (rows + 1);
  }
  const sheetWidth = columns * cellWidth + gutter * (columns + 1);
  return { columns, rows, cellWidth, cellHeight, sheetWidth, sheetHeight, gutter };
}

/**
 * Merge the three sample sets into one timeline. Where two frames land within
 * the tolerance of each other the more informative one wins: a scene's first
 * frame over a hook frame over a grid frame.
 */
export function dedupeSamples(samples: FrameSample[], toleranceSeconds = 0.45): FrameSample[] {
  const priority: Record<FrameSample['role'], number> = { SCENE: 3, HOOK: 2, GRID: 1 };
  const sorted = [...samples].sort((a, b) => a.timestampSeconds - b.timestampSeconds || priority[b.role] - priority[a.role]);
  const kept: FrameSample[] = [];
  for (const sample of sorted) {
    const previous = kept[kept.length - 1];
    if (previous && sample.timestampSeconds - previous.timestampSeconds < toleranceSeconds) {
      if (priority[sample.role] > priority[previous.role]) kept[kept.length - 1] = sample;
      continue;
    }
    kept.push(sample);
  }
  return kept;
}

/** The scene a moment falls in. */
export function sceneIndexAt(scenes: SceneSpan[], seconds: number): number | null {
  if (scenes.length === 0) return null;
  let found: number | null = null;
  for (const scene of scenes) {
    if (scene.startSeconds <= seconds + 1e-6) found = scene.index;
    else break;
  }
  return found;
}

/** "12.5s": the form printed on every contact-sheet cell and used in citations. */
export function formatStamp(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`;
}

/**
 * What code can measure about the edit and the audio, so the model is never
 * asked to count. These are facts; they do not vary between runs.
 */
export function measurePacing(input: {
  durationSeconds: number;
  scenes: SceneSpan[];
  segments: TranscriptSegment[] | null;
}): Pacing {
  const duration = Math.max(0.001, input.durationSeconds);
  const scenes = input.scenes.length > 0 ? input.scenes : [{ index: 0, startSeconds: 0, endSeconds: duration }];
  const cuts = Math.max(0, scenes.length - 1);
  let longest = scenes[0];
  for (const scene of scenes) {
    if (scene.endSeconds - scene.startSeconds > longest.endSeconds - longest.startSeconds) longest = scene;
  }

  const spoken = (input.segments ?? [])
    .filter((segment) => segment.text.trim().length > 0 && segment.end > segment.start)
    .sort((a, b) => a.start - b.start);
  const hasSpeech = spoken.length > 0;
  const speechSeconds = spoken.reduce((sum, segment) => sum + (segment.end - segment.start), 0);
  const words = spoken.reduce((sum, segment) => sum + segment.text.trim().split(/\s+/).length, 0);
  const silenceGaps: Pacing['silenceGaps'] = [];
  for (let index = 1; index < spoken.length; index += 1) {
    const gap = spoken[index].start - spoken[index - 1].end;
    if (gap >= SILENCE_GAP_SECONDS) {
      silenceGaps.push({ startSeconds: round(spoken[index - 1].end), endSeconds: round(spoken[index].start) });
    }
  }
  if (hasSpeech && duration - spoken[spoken.length - 1].end >= SILENCE_GAP_SECONDS) {
    silenceGaps.push({ startSeconds: round(spoken[spoken.length - 1].end), endSeconds: round(duration) });
  }

  return {
    sceneCount: scenes.length,
    cutsPerMinute: round(cuts / (duration / 60), 1),
    firstCutAt: scenes.length > 1 ? scenes[1].startSeconds : null,
    longestStaticRun: {
      startSeconds: longest.startSeconds,
      endSeconds: longest.endSeconds,
      seconds: round(longest.endSeconds - longest.startSeconds, 1),
    },
    hasSpeech,
    speechStartsAt: hasSpeech ? round(spoken[0].start) : null,
    speechCoverage: hasSpeech ? round(Math.min(1, speechSeconds / duration)) : null,
    wordsPerMinute: hasSpeech && speechSeconds > 0 ? Math.round(words / (speechSeconds / 60)) : null,
    silenceGaps,
  };
}
