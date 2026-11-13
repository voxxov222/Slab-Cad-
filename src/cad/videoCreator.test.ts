import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEngineeringMetrics } from './engineeringMath';
import { DEFAULT_SLAB_PARAMETERS } from './types';
import {
  buildFallbackCreatedVideo,
  detectVideoCategory,
  evaluateCreatedVideoFrame,
  formatTimecode,
  layoutLeaderCallouts,
  normalizeCreatedVideoPlan,
  validateCreateVideoPrompt,
} from './videoCreator';

const metrics = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);

test('validateCreateVideoPrompt rejects empty or ultra-short prompts', () => {
  assert.equal(validateCreateVideoPrompt('').ok, false);
  assert.equal(validateCreateVideoPrompt('   hi ').ok, false);
  assert.equal(validateCreateVideoPrompt('VCA pitch deck presentation').ok, true);
});

test('detectVideoCategory routes pitch-deck, advertising, blueprint-explainer, and presentation accurately', () => {
  assert.equal(detectVideoCategory('Create an investor pitch deck for VCA seed round'), 'pitch-deck');
  assert.equal(detectVideoCategory('Make a 30s commercial ad hook for collectors'), 'advertising');
  assert.equal(
    detectVideoCategory('Prototype CAD blueprint explainer with exploded slab and tolerances'),
    'blueprint-explainer'
  );
  assert.equal(detectVideoCategory('Executive product showcase with 360 orbit'), 'presentation');
});

test('buildFallbackCreatedVideo creates all 4 categories with live exploded indexing labels and contiguous timing', () => {
  const categories = ['pitch-deck', 'presentation', 'advertising', 'blueprint-explainer'] as const;
  for (const cat of categories) {
    const plan = buildFallbackCreatedVideo(
      `Create a ${cat} showcase with exploded slab view`,
      cat,
      DEFAULT_SLAB_PARAMETERS,
      metrics
    );
    assert.equal(plan.category, cat);
    assert.ok(plan.scenes.length >= 3);
    assert.ok(plan.scenes.some((s) => s.showLiveLabels));

    let prevEnd = 0;
    for (const sc of plan.scenes) {
      assert.equal(sc.startSec, prevEnd);
      assert.ok(sc.endSec > sc.startSec);
      assert.ok(sc.narration.length > 15);
      prevEnd = sc.endSec;
    }
    assert.equal(plan.totalDurationSec, prevEnd);
  }
});

test('evaluateCreatedVideoFrame rotates camera around target XZ during 360 turntable orbit', () => {
  const plan = buildFallbackCreatedVideo(
    'Presentation turntable showcase',
    'presentation',
    DEFAULT_SLAB_PARAMETERS,
    metrics
  );
  const start = evaluateCreatedVideoFrame(0, plan.scenes);
  const mid = evaluateCreatedVideoFrame(plan.scenes[0].endSec * 0.5, plan.scenes);
  assert.ok(start.cameraPos[2] > 180);
  // 180-degree turntable sweep flips camera to negative Z side without cutting through slab
  assert.ok(mid.cameraPos[2] < -150);
});

test('layoutLeaderCallouts separates overlapping exploded callout pins into clean non-overlapping left/right shelves', () => {
  const stackedPins = Array.from({ length: 10 }, (_, idx) => ({
    id: 'front_housing' as const,
    calloutNumber: idx + 1,
    shortName: `Part ${idx + 1}`,
    material: 'Polycarbonate',
    px: idx % 2 === 0 ? 590 : 620,
    py: 260 + idx * 2, // densely bunched near the center
    visible: true,
  }));

  const positioned = layoutLeaderCallouts(stackedPins, 1280, 720);
  assert.equal(positioned.length, 10);

  const left = positioned.filter((p) => p.side === 'left').sort((a, b) => a.ly - b.ly);
  const right = positioned.filter((p) => p.side === 'right').sort((a, b) => a.ly - b.ly);

  for (let i = 1; i < left.length; i++) {
    assert.ok(left[i].ly - left[i - 1].ly >= 21, `Left gap too small: ${left[i].ly - left[i - 1].ly}`);
  }
  for (let i = 1; i < right.length; i++) {
    assert.ok(right[i].ly - right[i - 1].ly >= 21, `Right gap too small: ${right[i].ly - right[i - 1].ly}`);
  }
});

test('normalizeCreatedVideoPlan clamps unsafe camera coordinates and forces live labels when exploded', () => {
  const plan = normalizeCreatedVideoPlan(
    {
      title: 'Custom Test',
      scenes: [
        {
          title: 'Scene One',
          durationSec: 12,
          narration: 'Clear executive voiceover.',
          visualStyle: 'exploded-blueprint',
          showLiveLabels: false,
          keyframes: [
            { cameraPos: [5, 0, 5], explode: 0.9 },
            { cameraPos: [140, 20, 180], explode: 1.0 },
            { cameraPos: [180, 30, 180], explode: 1.0 },
          ],
        },
        {
          title: 'Scene Two',
          durationSec: 10,
          narration: 'Closing statement.',
        },
      ],
    },
    'Blueprint explainer',
    'blueprint-explainer',
    DEFAULT_SLAB_PARAMETERS,
    metrics,
    'gemini'
  );

  assert.equal(plan.generatedBy, 'gemini');
  assert.equal(plan.scenes[0].showLiveLabels, true);
  // Camera distance clamped safely outside slab envelope (>= 100mm)
  const k0 = plan.scenes[0].keyframes[0];
  assert.ok(Math.hypot(k0.cameraPos[0], k0.cameraPos[2]) >= 98);
  assert.equal(formatTimecode(plan.totalDurationSec), '00:22');
});
