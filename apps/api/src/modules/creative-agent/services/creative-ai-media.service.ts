import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { mkdir, readFile, readdir, writeFile } from 'fs/promises';
import { basename, join, relative } from 'path';

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

@Injectable()
export class CreativeAiMediaService {
  async preprocess(workspace: string, sourcePath: string) {
    const ffprobe = process.env.CREATIVE_AI_FFPROBE_BIN || 'ffprobe';
    const ffmpeg = process.env.CREATIVE_AI_FFMPEG_BIN || 'ffmpeg';
    const probe = await this.probe(ffprobe, sourcePath);
    const durationSeconds = this.duration(probe);
    const maxDuration = this.positiveNumber(process.env.CREATIVE_AI_MAX_VIDEO_SECONDS, 600);
    if (durationSeconds <= 0) throw new Error('The uploaded file has no readable video duration');
    if (durationSeconds > maxDuration) {
      throw new Error(`Video duration ${Math.ceil(durationSeconds)}s exceeds the ${maxDuration}s local analysis limit`);
    }

    const framesDirectory = join(workspace, 'frames');
    await mkdir(framesDirectory, { recursive: true });
    const hookFrameLimit = Math.min(6, this.positiveInt(process.env.CREATIVE_AI_HOOK_FRAME_LIMIT, 6));
    const timelineFrameLimit = Math.min(24, this.positiveInt(process.env.CREATIVE_AI_TIMELINE_FRAME_LIMIT, 12));
    const scaleFilter = 'scale=1280:-2:force_original_aspect_ratio=decrease';

    await this.run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-ss', '0', '-i', sourcePath,
      '-t', String(Math.min(3, durationSeconds)), '-vf', `fps=2,${scaleFilter}`,
      '-q:v', '3', '-frames:v', String(hookFrameLimit), join(framesDirectory, 'hook-%02d.jpg'),
    ], 120_000);

    const intervalSeconds = Math.max(1, durationSeconds / timelineFrameLimit);
    await this.run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
      '-vf', `fps=1/${intervalSeconds.toFixed(3)},${scaleFilter}`,
      '-q:v', '3', '-frames:v', String(timelineFrameLimit), join(framesDirectory, 'timeline-%02d.jpg'),
    ], 180_000);

    const frameNames = (await readdir(framesDirectory))
      .filter((name) => /^(hook|timeline)-\d+\.jpg$/.test(name))
      .sort();
    if (frameNames.length === 0) throw new Error('FFmpeg did not produce any readable video frames');

    const frames = frameNames.map((name) => {
      const frameNumber = Math.max(0, Number(name.match(/(\d+)/)?.[1] || 1) - 1);
      const isHook = name.startsWith('hook-');
      return {
        file: relative(workspace, join(framesDirectory, name)),
        timestampSeconds: Number(Math.min(
          durationSeconds,
          isHook ? frameNumber * 0.5 : frameNumber * intervalSeconds,
        ).toFixed(2)),
        segment: isHook ? 'HOOK' : 'TIMELINE',
      };
    });

    const warnings: string[] = [];
    const transcript = await this.transcribe(workspace, sourcePath, ffmpeg, warnings);
    const videoStream = probe.streams?.find((stream) => stream.codec_type === 'video');
    const manifest = {
      version: 1,
      sourceFile: basename(sourcePath),
      durationSeconds: Number(durationSeconds.toFixed(3)),
      format: probe.format?.format_name || null,
      video: {
        codec: videoStream?.codec_name || null,
        width: videoStream?.width || null,
        height: videoStream?.height || null,
        frameRate: videoStream?.r_frame_rate || null,
      },
      sampling: {
        hookWindowSeconds: Math.min(3, durationSeconds),
        hookFramesPerSecond: 2,
        timelineIntervalSeconds: Number(intervalSeconds.toFixed(3)),
      },
      frames,
      transcript,
      warnings,
    };
    await writeFile(join(workspace, 'video-timeline.json'), JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
  }

  private async probe(binary: string, sourcePath: string): Promise<ProbePayload> {
    let result: CommandResult;
    try {
      result = await this.run(binary, [
        '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', sourcePath,
      ], 30_000);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new Error('ffprobe is not installed. Install FFmpeg locally before running video analysis.');
      }
      throw error;
    }
    try {
      return JSON.parse(result.stdout) as ProbePayload;
    } catch {
      throw new Error('ffprobe returned invalid metadata for the uploaded video');
    }
  }

  private async transcribe(
    workspace: string,
    sourcePath: string,
    ffmpeg: string,
    warnings: string[],
  ) {
    const whisper = process.env.CREATIVE_AI_WHISPER_BIN?.trim();
    if (!whisper) {
      warnings.push('AUDIO_TRANSCRIPTION_NOT_CONFIGURED');
      return {
        status: 'NOT_CONFIGURED',
        source: 'CREATIVE_SCRIPT_FALLBACK',
        text: null,
        segments: [],
      };
    }

    const transcriptDirectory = join(workspace, 'transcript');
    const audioPath = join(transcriptDirectory, 'audio.wav');
    await mkdir(transcriptDirectory, { recursive: true });
    await this.run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
      '-vn', '-ac', '1', '-ar', '16000', audioPath,
    ], 180_000);
    const args = [
      audioPath,
      '--model', process.env.CREATIVE_AI_WHISPER_MODEL || 'base',
      '--output_format', 'json',
      '--output_dir', transcriptDirectory,
    ];
    const language = process.env.CREATIVE_AI_WHISPER_LANGUAGE?.trim();
    if (language) args.push('--language', language);
    try {
      await this.run(whisper, args, this.positiveInt(process.env.CREATIVE_AI_TRANSCRIPTION_TIMEOUT_MS, 20 * 60 * 1000));
      const payload = JSON.parse(await readFile(join(transcriptDirectory, 'audio.json'), 'utf8'));
      return {
        status: 'COMPLETED',
        source: 'LOCAL_WHISPER',
        text: typeof payload?.text === 'string' ? payload.text : null,
        segments: Array.isArray(payload?.segments)
          ? payload.segments.map((segment: any) => ({
              start: Number(segment.start ?? 0),
              end: Number(segment.end ?? 0),
              text: String(segment.text ?? '').trim(),
            }))
          : [],
      };
    } catch (error: any) {
      warnings.push('AUDIO_TRANSCRIPTION_FAILED');
      return {
        status: 'FAILED',
        source: 'CREATIVE_SCRIPT_FALLBACK',
        text: null,
        segments: [],
        error: String(error?.message || error).slice(0, 500),
      };
    }
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
        if (stderr.length < 256 * 1024) stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => finish(() => reject(error)));
      child.on('close', (code) => finish(() => {
        if (code === 0) resolveCommand({ stdout, stderr });
        else reject(new Error(stderr.trim() || `${binary} exited with code ${code}`));
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
