import { describe, expect, it } from '@jest/globals';
import { verifyAnalysis } from './creative-ai-verify';
import type { MediaManifest } from '../services/creative-ai-media.service';

const manifest = (overrides: Partial<MediaManifest> = {}): MediaManifest => ({
  version: 2,
  kind: 'VIDEO',
  sourceFile: 'ad.mp4',
  durationSeconds: 30,
  format: 'mp4',
  video: { codec: 'h264', width: 720, height: 1280, frameRate: '30/1' },
  sampling: { hookWindowSeconds: 3, hookFramesPerSecond: 2, gridIntervalSeconds: 1, sceneThreshold: 0.3, maxScenes: 40, sheetsPerRead: 4 },
  scenes: [],
  frames: [],
  sheets: [],
  thumbnails: [],
  transcript: { status: 'COMPLETED', source: 'WHISPER_SERVICE', text: 'Sobrang sakit ng likod ko dati, every morning parang ang bigat. After two weeks, ang gaan na.', segments: [] },
  pacing: null,
  warnings: [],
  ...overrides,
});

const timeline = [
  { startSeconds: 0, endSeconds: 2.8, role: 'HOOK', whatIsSeen: 'Jar', onScreenText: null, spokenLine: 'Sobrang sakit ng likod ko dati', technique: null, issue: null, keepOrFix: 'KEEP' },
  { startSeconds: 2.8, endSeconds: 30, role: 'PROOF', whatIsSeen: 'Split', onScreenText: null, spokenLine: null, technique: null, issue: null, keepOrFix: 'KEEP' },
];

describe('verifyAnalysis', () => {
  it('passes a well-formed analyst result', () => {
    const checks = verifyAnalysis({
      result: { verdict: 'WATCH', evidence: [{ metric: 'CPP' }], timeline, beats: { productFirstSeenAt: 4 } },
      mode: 'RUNNING_ANALYST',
      manifest: manifest(),
      variables: { TARGET_CPP: '₱350', TARGET_AR_PCT: '40%' },
    });
    expect(checks).toEqual([]);
  });

  it('flags a timeline that overruns the video or leaves most of it uncovered', () => {
    const checks = verifyAnalysis({
      result: { verdict: 'WATCH', evidence: [{}], timeline: [{ startSeconds: 0, endSeconds: 5 }, { startSeconds: 40, endSeconds: 48 }] },
      mode: 'RUNNING_ANALYST',
      manifest: manifest(),
      variables: {},
    });
    expect(checks.map((c) => c.code)).toEqual(expect.arrayContaining(['TIMELINE_OUT_OF_RANGE', 'TIMELINE_COVERAGE_LOW']));
  });

  it('flags a quote the transcript does not contain', () => {
    const checks = verifyAnalysis({
      result: {
        decision: 'APPROVE',
        timeline: [{ ...timeline[0], spokenLine: 'Guaranteed results overnight or your money back' }, timeline[1]],
      },
      mode: 'NEW_REVIEWER',
      manifest: manifest(),
      variables: {},
    });
    expect(checks.map((c) => c.code)).toContain('QUOTE_NOT_IN_TRANSCRIPT');
  });

  it('flags SCALE or KILL when the store has no thresholds', () => {
    const checks = verifyAnalysis({
      result: { verdict: 'KILL', evidence: [{}], timeline },
      mode: 'RUNNING_ANALYST',
      manifest: manifest(),
      variables: { TARGET_CPP: 'not set', TARGET_AR_PCT: 'not set' },
    });
    expect(checks.map((c) => c.code)).toContain('VERDICT_WITHOUT_TARGETS');
  });

  it('flags a reject without a reason and an iteration without a source', () => {
    const checks = verifyAnalysis({
      result: { decision: 'REJECT', noveltyLabel: 'ITERATION', timeline },
      mode: 'NEW_REVIEWER',
      manifest: manifest({ transcript: { status: 'NOT_CONFIGURED', source: 'x', text: null, segments: [] } }),
      variables: {},
    });
    expect(checks.map((c) => c.code)).toEqual(expect.arrayContaining(['REJECT_WITHOUT_REASON', 'ITERATION_WITHOUT_SOURCE']));
  });

  it('does not judge timing for a static creative', () => {
    const checks = verifyAnalysis({
      result: { decision: 'APPROVE', timeline: [{ startSeconds: 0, endSeconds: 0 }] },
      mode: 'NEW_REVIEWER',
      manifest: manifest({ kind: 'STATIC', durationSeconds: null }),
      variables: {},
    });
    expect(checks).toEqual([]);
  });
});
