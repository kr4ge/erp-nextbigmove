import { describe, expect, it } from '@jest/globals';
import {
  dedupeSamples,
  formatStamp,
  gridIntervalSeconds,
  measurePacing,
  parseShowinfoTimestamps,
  planScenes,
  sceneIndexAt,
  sheetLayout,
} from './creative-ai-sampling';

describe('parseShowinfoTimestamps', () => {
  it('reads the cut timestamps ffmpeg prints, in order and without repeats', () => {
    const stderr = [
      '[Parsed_showinfo_1 @ 0x1] n:   0 pts:  74 pts_time:2.46667 duration: 1 fmt:yuv420p',
      '[Parsed_showinfo_1 @ 0x1] n:   1 pts: 276 pts_time:9.2     duration: 1',
      '[Parsed_showinfo_1 @ 0x1] n:   2 pts: 276 pts_time:9.2     duration: 1',
      'frame=    3 fps=0.0 q=4.0 Lsize=N/A',
    ].join('\n');
    expect(parseShowinfoTimestamps(stderr)).toEqual([2.467, 9.2]);
  });
});

describe('planScenes', () => {
  it('starts at zero, ends at the duration, and folds a flash cut into its neighbour', () => {
    const scenes = planScenes(45, [2.8, 3.1, 9.2, 16.5, 44.99], { maxScenes: 40, minSceneSeconds: 0.6 });
    expect(scenes.map((s) => [s.startSeconds, s.endSeconds])).toEqual([[0, 2.8], [2.8, 9.2], [9.2, 16.5], [16.5, 45]]);
    expect(scenes.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it('merges the shortest scenes first when the edit has more than the budget', () => {
    // A fast-cut ad must keep its overall shape, not lose its ending.
    const scenes = planScenes(20, [1, 2, 10, 11, 19], { maxScenes: 3, minSceneSeconds: 0.5 });
    expect(scenes).toHaveLength(3);
    expect(scenes[0].startSeconds).toBe(0);
    expect(scenes[scenes.length - 1].endSeconds).toBe(20);
  });

  it('treats a video with no cuts as one scene', () => {
    expect(planScenes(12, [], { maxScenes: 40, minSceneSeconds: 0.6 })).toEqual([{ index: 0, startSeconds: 0, endSeconds: 12 }]);
  });
});

describe('gridIntervalSeconds', () => {
  it('samples once a second until the video outgrows the frame budget', () => {
    expect(gridIntervalSeconds(45, 90)).toBe(1);
    expect(gridIntervalSeconds(180, 90)).toBe(2);
    expect(gridIntervalSeconds(100, 90)).toBe(1.2);
  });
});

describe('sheetLayout', () => {
  it('tiles a portrait ad four across so each cell keeps its width', () => {
    const layout = sheetLayout(720, 1280);
    expect(layout.columns).toBe(4);
    expect(layout.rows).toBe(2);
    expect(layout.sheetWidth).toBeLessThanOrEqual(1568);
    expect(layout.sheetHeight).toBeLessThanOrEqual(1568);
  });

  it('tiles a landscape ad three by three and never exceeds the long edge', () => {
    const layout = sheetLayout(1920, 1080);
    expect(layout.columns).toBe(3);
    expect(layout.rows).toBe(3);
    expect(Math.max(layout.sheetWidth, layout.sheetHeight)).toBeLessThanOrEqual(1568);
  });

  it('shrinks square frames so the sheet stays within the long edge', () => {
    const layout = sheetLayout(1080, 1080);
    expect(layout.sheetHeight).toBeLessThanOrEqual(1568);
    expect(layout.sheetWidth).toBeLessThanOrEqual(1568);
  });
});

describe('dedupeSamples', () => {
  it('keeps the scene frame when a grid frame lands on the same moment', () => {
    const kept = dedupeSamples([
      { timestampSeconds: 9, role: 'GRID', file: 'g9', sceneIndex: null },
      { timestampSeconds: 9.2, role: 'SCENE', file: 's2', sceneIndex: 2 },
      { timestampSeconds: 10, role: 'GRID', file: 'g10', sceneIndex: null },
      { timestampSeconds: 0, role: 'HOOK', file: 'h1', sceneIndex: 0 },
      { timestampSeconds: 0, role: 'GRID', file: 'g0', sceneIndex: null },
    ]);
    expect(kept.map((s) => s.file)).toEqual(['h1', 's2', 'g10']);
  });
});

describe('sceneIndexAt', () => {
  it('finds the scene a moment belongs to', () => {
    const scenes = [
      { index: 0, startSeconds: 0, endSeconds: 2.8 },
      { index: 1, startSeconds: 2.8, endSeconds: 9.2 },
      { index: 2, startSeconds: 9.2, endSeconds: 45 },
    ];
    expect(sceneIndexAt(scenes, 0)).toBe(0);
    expect(sceneIndexAt(scenes, 2.8)).toBe(1);
    expect(sceneIndexAt(scenes, 44)).toBe(2);
    expect(sceneIndexAt([], 3)).toBeNull();
  });
});

describe('formatStamp', () => {
  it('prints one decimal and a unit, the form the model cites', () => {
    expect(formatStamp(0)).toBe('0.0s');
    expect(formatStamp(12.46)).toBe('12.5s');
  });
});

describe('measurePacing', () => {
  const scenes = [
    { index: 0, startSeconds: 0, endSeconds: 2.8 },
    { index: 1, startSeconds: 2.8, endSeconds: 9.2 },
    { index: 2, startSeconds: 9.2, endSeconds: 30 },
  ];

  it('measures the edit: cuts per minute, first cut, the longest static run', () => {
    const pacing = measurePacing({ durationSeconds: 30, scenes, segments: null });
    expect(pacing.sceneCount).toBe(3);
    expect(pacing.cutsPerMinute).toBe(4);
    expect(pacing.firstCutAt).toBe(2.8);
    expect(pacing.longestStaticRun).toEqual({ startSeconds: 9.2, endSeconds: 30, seconds: 20.8 });
    expect(pacing.hasSpeech).toBe(false);
    expect(pacing.speechStartsAt).toBeNull();
  });

  it('measures the audio: when speech starts, how much of the ad it covers, the silences', () => {
    const pacing = measurePacing({
      durationSeconds: 30,
      scenes,
      segments: [
        { start: 0.4, end: 3, text: 'Sobrang sakit ng likod ko dati' },
        { start: 3.2, end: 8, text: 'every morning parang ang bigat' },
        { start: 14, end: 18, text: 'after two weeks' },
      ],
    });
    expect(pacing.hasSpeech).toBe(true);
    expect(pacing.speechStartsAt).toBe(0.4);
    expect(pacing.speechCoverage).toBe(0.38);
    expect(pacing.wordsPerMinute).toBeGreaterThan(50);
    expect(pacing.silenceGaps).toEqual([
      { startSeconds: 8, endSeconds: 14 },
      { startSeconds: 18, endSeconds: 30 },
    ]);
  });
});
