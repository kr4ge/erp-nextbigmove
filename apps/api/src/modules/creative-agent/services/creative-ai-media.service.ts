import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'fs/promises';
import { basename, join, relative } from 'path';
import sharp = require('sharp');
import {
  CREATIVE_AI_AUDIO_EXTRACT_TIMEOUT_MS,
  CREATIVE_AI_HOOK_FRAMES_TIMEOUT_MS,
  CREATIVE_AI_PROBE_TIMEOUT_MS,
  CREATIVE_AI_SCENE_DETECT_TIMEOUT_MS,
  CREATIVE_AI_TIMELINE_FRAMES_TIMEOUT_MS,
  creativeAiTranscriptionTimeoutMs,
} from '../utils/creative-ai-timeouts';
import {
  dedupeSamples,
  formatStamp,
  gridIntervalSeconds,
  measurePacing,
  parseShowinfoTimestamps,
  planScenes,
  sheetLayout,
  type FrameSample,
  type Pacing,
  type SceneSpan,
  type SheetLayout,
  type TranscriptSegment,
} from '../utils/creative-ai-sampling';
import { renderStampLabel } from '../utils/creative-ai-glyphs';

type CommandResult = { stdout: string; stderr: string };
type ProbePayload = {
  format?: { duration?: string; format_name?: string; bit_rate?: string };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    duration?: string;
  }>;
};

export type MediaScene = {
  index: number;
  startSeconds: number;
  endSeconds: number;
  /** Full-size first frame of the scene, relative to the workspace; null once trimmed for size. */
  frame: string | null;
  thumbnail: string | null;
};

export type MediaSheetCell = { index: number; timestampSeconds: number; sceneIndex: number | null };
export type MediaSheet = { file: string; columns: number; rows: number; cells: MediaSheetCell[] };
export type MediaThumbnail = { sceneIndex: number; timestampSeconds: number | null; endSeconds: number | null; file: string };
export type MediaFrame = { file: string; timestampSeconds: number | null; segment: 'HOOK' | 'SCENE' | 'STATIC'; sceneIndex: number | null };
export type MediaTranscript = {
  status: 'COMPLETED' | 'NOT_CONFIGURED' | 'NO_AUDIO' | 'FAILED' | 'NOT_APPLICABLE';
  source: string;
  text: string | null;
  language?: string | null;
  segments: TranscriptSegment[];
  error?: string;
};

/**
 * What preprocessing hands to the model and to the storyboard. Version 2 adds
 * detected scenes, contact sheets, per-scene thumbnails and code-measured
 * pacing to the frame manifest version 1 carried.
 */
export type MediaManifest = {
  version: 2;
  kind: 'VIDEO' | 'STATIC';
  sourceFile: string;
  durationSeconds: number | null;
  format: string | null;
  video: { codec: string | null; width: number | null; height: number | null; frameRate: string | null };
  sampling:
    | { staticImage: true }
    | {
        hookWindowSeconds: number;
        hookFramesPerSecond: number;
        gridIntervalSeconds: number;
        sceneThreshold: number;
        maxScenes: number;
        sheetsPerRead: number;
      };
  scenes: MediaScene[];
  frames: MediaFrame[];
  sheets: MediaSheet[];
  thumbnails: MediaThumbnail[];
  transcript: MediaTranscript;
  pacing: Pacing | null;
  warnings: string[];
};

const FRAME_WIDTH = 1280;
const THUMBNAIL_WIDTH = 480;
const SCENE_MIN_SECONDS = 0.6;
const SHEET_BACKGROUND = { r: 24, g: 24, b: 24 };
const pad = (value: number, width = 3) => String(value).padStart(width, '0');

@Injectable()
export class CreativeAiMediaService {
  private readonly logger = new Logger(CreativeAiMediaService.name);

  /**
   * Prepares what an analysis reads. A video is cut into scenes and sampled
   * once a second onto contact sheets; a static creative is a single
   * normalised image, which needs no duration and no transcript.
   */
  async preprocess(workspace: string, sourcePath: string, kind: 'VIDEO' | 'STATIC' = 'VIDEO'): Promise<MediaManifest> {
    return kind === 'STATIC'
      ? this.preprocessStatic(workspace, sourcePath)
      : this.preprocessVideo(workspace, sourcePath);
  }

  private async preprocessStatic(workspace: string, sourcePath: string): Promise<MediaManifest> {
    const ffmpeg = process.env.CREATIVE_AI_FFMPEG_BIN || 'ffmpeg';
    const ffprobe = process.env.CREATIVE_AI_FFPROBE_BIN || 'ffprobe';
    const probe = await this.probe(ffprobe, sourcePath);
    const imageStream = probe.streams?.find((stream) => stream.codec_type === 'video');
    if (!imageStream?.width || !imageStream?.height) {
      throw new Error('The uploaded file is not a readable image');
    }

    const framesDirectory = join(workspace, 'frames');
    const thumbsDirectory = join(workspace, 'thumbs');
    await Promise.all([mkdir(framesDirectory, { recursive: true }), mkdir(thumbsDirectory, { recursive: true })]);
    const target = join(framesDirectory, 'static-01.jpg');
    // One normalised JPEG: same width ceiling as video frames, so the model
    // sees images of a consistent scale whatever the source was.
    await this.run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
      '-vf', `scale=${FRAME_WIDTH}:-2:force_original_aspect_ratio=decrease`,
      '-q:v', '2', '-frames:v', '1', target,
    ], CREATIVE_AI_HOOK_FRAMES_TIMEOUT_MS);
    const thumbnail = join(thumbsDirectory, 'static-01.jpg');
    await sharp(target).resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(thumbnail);

    const manifest: MediaManifest = {
      version: 2,
      kind: 'STATIC',
      sourceFile: basename(sourcePath),
      durationSeconds: null,
      format: probe.format?.format_name || null,
      video: {
        codec: imageStream.codec_name || null,
        width: imageStream.width,
        height: imageStream.height,
        frameRate: null,
      },
      sampling: { staticImage: true },
      scenes: [{ index: 0, startSeconds: 0, endSeconds: 0, frame: relative(workspace, target), thumbnail: relative(workspace, thumbnail) }],
      frames: [{ file: relative(workspace, target), timestampSeconds: null, segment: 'STATIC', sceneIndex: 0 }],
      sheets: [],
      thumbnails: [{ sceneIndex: 0, timestampSeconds: null, endSeconds: null, file: relative(workspace, thumbnail) }],
      transcript: { status: 'NOT_APPLICABLE', source: 'STATIC_CREATIVE', text: null, segments: [] },
      pacing: null,
      warnings: [],
    };
    await writeFile(join(workspace, 'video-timeline.json'), JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
  }

  private async preprocessVideo(workspace: string, sourcePath: string): Promise<MediaManifest> {
    const ffprobe = process.env.CREATIVE_AI_FFPROBE_BIN || 'ffprobe';
    const ffmpeg = process.env.CREATIVE_AI_FFMPEG_BIN || 'ffmpeg';
    const probe = await this.probe(ffprobe, sourcePath);
    const durationSeconds = this.duration(probe);
    const maxDuration = this.positiveNumber(process.env.CREATIVE_AI_MAX_VIDEO_SECONDS, 600);
    if (durationSeconds <= 0) throw new Error('The uploaded file has no readable video duration');
    if (durationSeconds > maxDuration) {
      throw new Error(`Video duration ${Math.ceil(durationSeconds)}s exceeds the ${maxDuration}s local analysis limit`);
    }

    const config = {
      hookFrameLimit: Math.min(12, this.positiveInt(process.env.CREATIVE_AI_HOOK_FRAME_LIMIT, 6)),
      maxScenes: Math.min(60, this.positiveInt(process.env.CREATIVE_AI_MAX_SCENES, 40)),
      maxGridFrames: Math.min(180, this.positiveInt(process.env.CREATIVE_AI_MAX_GRID_FRAMES, 90)),
      sceneThreshold: Math.min(0.95, Math.max(0.05, this.positiveNumber(process.env.CREATIVE_AI_SCENE_THRESHOLD, 0.3))),
      pushBudgetBytes: this.positiveInt(process.env.CREATIVE_AI_PUSH_BUDGET_BYTES, 8_000_000),
    };
    const warnings: string[] = [];

    // A retry that lost its manifest but kept some files must start clean:
    // the sheets are numbered and a leftover would shift every timestamp.
    const dirs = {
      frames: join(workspace, 'frames'),
      sheets: join(workspace, 'sheets'),
      grid: join(workspace, 'grid'),
      thumbs: join(workspace, 'thumbs'),
    };
    for (const directory of Object.values(dirs)) {
      await rm(directory, { recursive: true, force: true });
      await mkdir(directory, { recursive: true });
    }
    const scaleFilter = `scale=${FRAME_WIDTH}:-2:force_original_aspect_ratio=decrease`;

    // 1. The hook, two frames a second for the first three seconds.
    await this.run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-ss', '0', '-i', sourcePath,
      '-t', String(Math.min(3, durationSeconds)), '-vf', `fps=2,${scaleFilter}`,
      '-q:v', '3', '-frames:v', String(config.hookFrameLimit), join(dirs.frames, 'hook-%02d.jpg'),
    ], CREATIVE_AI_HOOK_FRAMES_TIMEOUT_MS);
    const hookFiles = (await readdir(dirs.frames)).filter((name) => /^hook-\d+\.jpg$/.test(name)).sort();
    if (hookFiles.length === 0) throw new Error('FFmpeg did not produce any readable video frames');

    // 2. One decode pass finds the cuts and saves the first frame of each.
    // showinfo prints the timestamp of every frame the scene filter let
    // through, so the cut list and the files come from the same pass.
    const maxCutFrames = Math.min(120, config.maxScenes * 2);
    const detection = await this.run(ffmpeg, [
      '-hide_banner', '-loglevel', 'info', '-nostats', '-y', '-i', sourcePath,
      '-vf', `select='gt(scene\\,${config.sceneThreshold})',showinfo,${scaleFilter}`,
      '-fps_mode', 'vfr', '-q:v', '4', '-frames:v', String(maxCutFrames), join(dirs.frames, 'cut-%03d.jpg'),
    ], CREATIVE_AI_SCENE_DETECT_TIMEOUT_MS);
    const cutTimestamps = parseShowinfoTimestamps(detection.stderr);
    const cutFiles = (await readdir(dirs.frames)).filter((name) => /^cut-\d+\.jpg$/.test(name)).sort();
    if (cutFiles.length !== cutTimestamps.length) warnings.push('SCENE_FRAME_COUNT_MISMATCH');
    if (cutFiles.length >= maxCutFrames) warnings.push('SCENE_CUTS_TRUNCATED');
    const cutCount = Math.min(cutFiles.length, cutTimestamps.length);
    const fileForCut = new Map<number, string>();
    for (let index = 0; index < cutCount; index += 1) fileForCut.set(cutTimestamps[index], cutFiles[index]);

    const spans = planScenes(durationSeconds, cutTimestamps.slice(0, cutCount), {
      maxScenes: config.maxScenes,
      minSceneSeconds: SCENE_MIN_SECONDS,
    });
    const scenes: MediaScene[] = [];
    const keptCutFiles = new Set<string>();
    for (const span of spans) {
      let frame: string | null = null;
      if (span.index === 0) {
        frame = join(dirs.frames, hookFiles[0]);
      } else {
        const source = fileForCut.get(span.startSeconds);
        if (source) {
          const target = join(dirs.frames, `scene-${pad(span.index)}.jpg`);
          await rename(join(dirs.frames, source), target);
          keptCutFiles.add(source);
          frame = target;
        }
      }
      scenes.push({ ...span, frame: frame ? relative(workspace, frame) : null, thumbnail: null });
    }
    for (const name of cutFiles) {
      if (!keptCutFiles.has(name)) await unlink(join(dirs.frames, name)).catch(() => undefined);
    }

    // 3. The sheet geometry follows the frame as decoded, which already has
    // any rotation applied; the probe reports the stored orientation.
    const firstFrame = await sharp(join(dirs.frames, hookFiles[0])).metadata();
    const videoStream = probe.streams?.find((stream) => stream.codec_type === 'video');
    const frameWidth = firstFrame.width ?? videoStream?.width ?? 1280;
    const frameHeight = firstFrame.height ?? videoStream?.height ?? 720;
    const layout = sheetLayout(frameWidth, frameHeight);

    // 4. Once a second across the whole video, straight into cell size.
    const interval = gridIntervalSeconds(durationSeconds, config.maxGridFrames);
    await this.run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
      '-vf', `fps=1/${interval.toFixed(3)},scale=${layout.cellWidth}:-2`,
      '-q:v', '4', '-frames:v', String(config.maxGridFrames), join(dirs.grid, 'grid-%03d.jpg'),
    ], CREATIVE_AI_TIMELINE_FRAMES_TIMEOUT_MS);
    const gridFiles = (await readdir(dirs.grid)).filter((name) => /^grid-\d+\.jpg$/.test(name)).sort();

    // 5. One timeline from the three sets, then sheets.
    const samples: FrameSample[] = [
      ...hookFiles.map((name, index) => ({
        timestampSeconds: Number(Math.min(durationSeconds, index * 0.5).toFixed(2)),
        role: 'HOOK' as const,
        file: join(dirs.frames, name),
        sceneIndex: index === 0 ? 0 : null,
      })),
      ...scenes
        .filter((scene) => scene.index > 0 && scene.frame)
        .map((scene) => ({ timestampSeconds: scene.startSeconds, role: 'SCENE' as const, file: join(workspace, scene.frame!), sceneIndex: scene.index })),
      ...gridFiles.map((name, index) => ({
        timestampSeconds: Number(Math.min(durationSeconds, index * interval).toFixed(2)),
        role: 'GRID' as const,
        file: join(dirs.grid, name),
        sceneIndex: null,
      })),
    ];
    const ordered = dedupeSamples(samples);
    const sheets = await this.buildSheets(workspace, dirs.sheets, ordered, layout);

    // 6. A thumbnail per scene for the storyboard; these are stored, not sent.
    const thumbnails: MediaThumbnail[] = [];
    for (const scene of scenes) {
      if (!scene.frame) continue;
      const target = join(dirs.thumbs, `scene-${pad(scene.index)}.jpg`);
      await sharp(join(workspace, scene.frame)).resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(target);
      scene.thumbnail = relative(workspace, target);
      thumbnails.push({ sceneIndex: scene.index, timestampSeconds: scene.startSeconds, endSeconds: scene.endSeconds, file: scene.thumbnail });
    }
    await rm(dirs.grid, { recursive: true, force: true });

    // 7. Sound, then what code can measure about the edit and the audio.
    const transcript = await this.transcribe(workspace, sourcePath, ffmpeg, probe, warnings);
    const pacing = measurePacing({
      durationSeconds,
      scenes: spans,
      segments: transcript.status === 'COMPLETED' ? transcript.segments : null,
    });

    // 8. Everything in frames/ and sheets/ travels to the gateway over one
    // socket message, so it has to fit. Sheets carry the coverage; when the
    // total is too large the full-size frames give way first.
    const frames: MediaFrame[] = [
      ...hookFiles.map((name, index) => ({
        file: relative(workspace, join(dirs.frames, name)),
        timestampSeconds: Number(Math.min(durationSeconds, index * 0.5).toFixed(2)),
        segment: 'HOOK' as const,
        sceneIndex: index === 0 ? 0 : null,
      })),
      ...scenes
        .filter((scene) => scene.index > 0 && scene.frame)
        .map((scene) => ({ file: scene.frame!, timestampSeconds: scene.startSeconds, segment: 'SCENE' as const, sceneIndex: scene.index })),
    ];
    await this.fitPushBudget(workspace, frames, scenes, config.pushBudgetBytes, warnings);

    const manifest: MediaManifest = {
      version: 2,
      kind: 'VIDEO',
      sourceFile: basename(sourcePath),
      durationSeconds: Number(durationSeconds.toFixed(3)),
      format: probe.format?.format_name || null,
      video: {
        codec: videoStream?.codec_name || null,
        width: frameWidth,
        height: frameHeight,
        frameRate: videoStream?.r_frame_rate || null,
      },
      sampling: {
        hookWindowSeconds: Math.min(3, durationSeconds),
        hookFramesPerSecond: 2,
        gridIntervalSeconds: interval,
        sceneThreshold: config.sceneThreshold,
        maxScenes: config.maxScenes,
        sheetsPerRead: 4,
      },
      scenes,
      frames,
      sheets,
      thumbnails,
      transcript,
      pacing,
      warnings,
    };
    await writeFile(join(workspace, 'video-timeline.json'), JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
  }

  /**
   * Tile the ordered samples onto sheets, each cell labelled with its
   * timestamp; an amber label marks the first frame of a detected scene.
   * Sheets are built one at a time: this runs on a small box.
   */
  private async buildSheets(workspace: string, sheetsDirectory: string, samples: FrameSample[], layout: SheetLayout): Promise<MediaSheet[]> {
    const perSheet = layout.columns * layout.rows;
    const sheets: MediaSheet[] = [];
    for (let offset = 0; offset < samples.length; offset += perSheet) {
      const chunk = samples.slice(offset, offset + perSheet);
      const composites: sharp.OverlayOptions[] = [];
      const cells: MediaSheetCell[] = [];
      for (let position = 0; position < chunk.length; position += 1) {
        const sample = chunk[position];
        const column = position % layout.columns;
        const row = Math.floor(position / layout.columns);
        const left = layout.gutter + column * (layout.cellWidth + layout.gutter);
        const top = layout.gutter + row * (layout.cellHeight + layout.gutter);
        const cell = await sharp(sample.file)
          .resize(layout.cellWidth, layout.cellHeight, { fit: 'contain', background: SHEET_BACKGROUND })
          .toBuffer();
        composites.push({ input: cell, left, top });
        const label = await renderStampLabel(formatStamp(sample.timestampSeconds), sample.role === 'SCENE' ? 'ACCENT' : 'DARK');
        composites.push({ input: label.buffer, left: left + 6, top: top + 6 });
        cells.push({ index: position, timestampSeconds: sample.timestampSeconds, sceneIndex: sample.sceneIndex });
      }
      const index = sheets.length + 1;
      const target = join(sheetsDirectory, `sheet-${pad(index, 2)}.jpg`);
      await sharp({ create: { width: layout.sheetWidth, height: layout.sheetHeight, channels: 3, background: SHEET_BACKGROUND } })
        .composite(composites)
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(target);
      sheets.push({ file: relative(workspace, target), columns: layout.columns, rows: layout.rows, cells });
    }
    return sheets;
  }

  /**
   * Keep frames/ + sheets/ under the push budget. Full-size frames shrink
   * first; if that is not enough, scene frames beyond the earliest are
   * dropped from the push (their thumbnails survive for the storyboard).
   */
  private async fitPushBudget(workspace: string, frames: MediaFrame[], scenes: MediaScene[], budgetBytes: number, warnings: string[]) {
    const total = async () => {
      let bytes = 0;
      for (const directory of ['frames', 'sheets']) {
        const names = await readdir(join(workspace, directory)).catch(() => [] as string[]);
        for (const name of names) bytes += (await stat(join(workspace, directory, name))).size;
      }
      return bytes;
    };
    let bytes = await total();
    let width = FRAME_WIDTH;
    const initialCount = frames.length;
    for (let attempt = 0; attempt < 3 && bytes > budgetBytes; attempt += 1) {
      width = Math.round(width * 0.8);
      for (const frame of frames) {
        const absolute = join(workspace, frame.file);
        const temporary = `${absolute}.tmp`;
        await sharp(absolute).resize({ width, withoutEnlargement: true }).jpeg({ quality: 72 }).toFile(temporary);
        await rename(temporary, absolute);
      }
      bytes = await total();
    }
    let keep = frames.length;
    while (bytes > budgetBytes && keep > 12) {
      keep = Math.max(12, Math.floor(keep / 2));
      const dropped = frames.splice(keep);
      for (const frame of dropped) {
        await unlink(join(workspace, frame.file)).catch(() => undefined);
        const scene = scenes.find((candidate) => candidate.index === frame.sceneIndex);
        if (scene) scene.frame = null;
      }
      bytes = await total();
    }
    if (width < FRAME_WIDTH || frames.length < initialCount) warnings.push('FRAME_PUSH_BUDGET_TRIMMED');
    if (bytes > budgetBytes) warnings.push('FRAME_PUSH_BUDGET_EXCEEDED');
  }

  private async probe(binary: string, sourcePath: string): Promise<ProbePayload> {
    let result: CommandResult;
    try {
      result = await this.run(binary, [
        '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', sourcePath,
      ], CREATIVE_AI_PROBE_TIMEOUT_MS);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new Error('ffprobe is not installed. Install FFmpeg locally before running creative analysis.');
      }
      throw error;
    }
    try {
      return JSON.parse(result.stdout) as ProbePayload;
    } catch {
      throw new Error('ffprobe returned invalid metadata for the uploaded video');
    }
  }

  /**
   * Speech, with timestamps per line. Two ways to get it: a Whisper binary
   * on this machine, or the Whisper service the compose file runs beside the
   * worker. Neither configured means the model works from the registered
   * script and is told so.
   */
  private async transcribe(
    workspace: string,
    sourcePath: string,
    ffmpeg: string,
    probe: ProbePayload,
    warnings: string[],
  ): Promise<MediaTranscript> {
    const whisperBinary = process.env.CREATIVE_AI_WHISPER_BIN?.trim();
    const whisperUrl = process.env.CREATIVE_AI_WHISPER_URL?.trim();
    if (!whisperBinary && !whisperUrl) {
      warnings.push('AUDIO_TRANSCRIPTION_NOT_CONFIGURED');
      return { status: 'NOT_CONFIGURED', source: 'CREATIVE_SCRIPT_FALLBACK', text: null, segments: [] };
    }
    if (!probe.streams?.some((stream) => stream.codec_type === 'audio')) {
      warnings.push('VIDEO_HAS_NO_AUDIO');
      return { status: 'NO_AUDIO', source: 'CREATIVE_SCRIPT_FALLBACK', text: null, segments: [] };
    }

    const transcriptDirectory = join(workspace, 'transcript');
    const audioPath = join(transcriptDirectory, 'audio.wav');
    await mkdir(transcriptDirectory, { recursive: true });
    try {
      await this.run(ffmpeg, [
        '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
        '-vn', '-ac', '1', '-ar', '16000', audioPath,
      ], CREATIVE_AI_AUDIO_EXTRACT_TIMEOUT_MS);
      const transcript = whisperUrl
        ? await this.transcribeViaService(whisperUrl, audioPath)
        : await this.transcribeViaBinary(whisperBinary!, audioPath, transcriptDirectory);
      await writeFile(join(transcriptDirectory, 'transcript.json'), JSON.stringify(transcript, null, 2), 'utf8');
      return transcript;
    } catch (error: any) {
      warnings.push('AUDIO_TRANSCRIPTION_FAILED');
      this.logger.warn(`Transcription failed: ${String(error?.message || error).slice(0, 300)}`);
      return {
        status: 'FAILED',
        source: 'CREATIVE_SCRIPT_FALLBACK',
        text: null,
        segments: [],
        error: String(error?.message || error).slice(0, 500),
      };
    } finally {
      await unlink(audioPath).catch(() => undefined);
    }
  }

  private async transcribeViaBinary(binary: string, audioPath: string, outputDirectory: string): Promise<MediaTranscript> {
    const args = [
      audioPath,
      '--model', process.env.CREATIVE_AI_WHISPER_MODEL || 'base',
      '--output_format', 'json',
      '--output_dir', outputDirectory,
    ];
    const language = process.env.CREATIVE_AI_WHISPER_LANGUAGE?.trim();
    if (language) args.push('--language', language);
    await this.run(binary, args, creativeAiTranscriptionTimeoutMs());
    const payload = JSON.parse(await readFile(join(outputDirectory, 'audio.json'), 'utf8'));
    return this.normalizeTranscript(payload, 'LOCAL_WHISPER');
  }

  private async transcribeViaService(baseUrl: string, audioPath: string): Promise<MediaTranscript> {
    const endpoint = new URL('transcribe', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    const language = process.env.CREATIVE_AI_WHISPER_LANGUAGE?.trim();
    if (language) endpoint.searchParams.set('language', language);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), creativeAiTranscriptionTimeoutMs());
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'audio/wav' },
        body: await readFile(audioPath),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Whisper service answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
      }
      return this.normalizeTranscript(await response.json(), 'WHISPER_SERVICE');
    } finally {
      clearTimeout(timer);
    }
  }

  private normalizeTranscript(payload: any, source: string): MediaTranscript {
    const segments: TranscriptSegment[] = Array.isArray(payload?.segments)
      ? payload.segments
          .map((segment: any) => ({
            start: Number(segment?.start ?? 0),
            end: Number(segment?.end ?? 0),
            text: String(segment?.text ?? '').trim(),
          }))
          .filter((segment: TranscriptSegment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.text.length > 0)
      : [];
    const text = typeof payload?.text === 'string' && payload.text.trim()
      ? payload.text.trim()
      : segments.map((segment) => segment.text).join(' ') || null;
    return {
      status: 'COMPLETED',
      source,
      text,
      language: typeof payload?.language === 'string' ? payload.language : null,
      segments,
    };
  }

  private duration(probe: ProbePayload) {
    const raw = probe.format?.duration
      || probe.streams?.find((stream) => stream.codec_type === 'video')?.duration
      || '0';
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  }

  private run(binary: string, args: string[], timeoutMs: number): Promise<CommandResult> {
    return new Promise((resolveCommand, reject) => {
      const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback();
      };
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        finish(() => reject(new Error(`${binary} exceeded ${timeoutMs}ms`)));
      }, timeoutMs);
      child.stdout.on('data', (chunk) => {
        if (stdout.length < 2 * 1024 * 1024) stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk) => {
        if (stderr.length < 512 * 1024) stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => finish(() => reject(error)));
      child.on('close', (code) => finish(() => {
        if (code === 0) resolveCommand({ stdout, stderr });
        else reject(new Error(stderr.trim().split('\n').slice(-6).join('\n') || `${binary} exited with code ${code}`));
      }));
    });
  }

  private positiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private positiveNumber(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
