import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEngineeringMetrics } from './engineeringMath';
import { evaluateExplainerFrame, formatTimecode } from './explainerTimeline';
import {
  buildStudioPresentationFallback,
  clampCameraPos,
  normalizeGeneratedPresentation,
  validatePresentationPrompt,
} from './presentationGenerator';
import { DEFAULT_SLAB_PARAMETERS } from './types';

test('validatePresentationPrompt rejects empty and ultra-short inputs', () => {
  assert.equal(validatePresentationPrompt('   ').ok, false);
  assert.equal(validatePresentationPrompt('ab').ok, false);
  const okRes = validatePresentationPrompt('  Macro   orbit around the NFC chip  ');
  assert.equal(okRes.ok, true);
  assert.equal(okRes.cleaned, 'Macro   orbit around the NFC chip'.replace(/\s+/g, ' '));
});

test('clampCameraPos prevents cameras from clipping inside the slab or below floor grid', () => {
  const inside = clampCameraPos([10, 12, 14], [100, 20, 160]);
  assert.ok(Math.hypot(inside[0], inside[2]) >= 72, 'Camera pushed safely outside slab shell');

  const underground = clampCameraPos([120, -140, 160], [100, 20, 160]);
  assert.ok(underground[1] >= -48, 'Camera remains above studio grid floor');
});

test('buildStudioPresentationFallback tailors scenes, duration, and accent mood to prompt keywords', () => {
  const metrics = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);
  const plan = buildStudioPresentationFallback(
    '30s emerald cross-section cutaway and exploded assembly with NFC chip tap',
    DEFAULT_SLAB_PARAMETERS,
    metrics
  );

  assert.equal(plan.accentHex, '#34D399');
  assert.ok(plan.scenes.length >= 4);
  assert.ok(
    plan.scenes.some((s) => s.keyframes.some((k) => k.sectionEnabled)),
    'Cross-section keyword activates section cutaway keyframe'
  );
  assert.ok(
    plan.scenes.some((s) => s.keyframes.some((k) => k.explode > 0.8)),
    'Explode keyword activates full axial separation'
  );
  assert.ok(
    plan.scenes.some((s) => s.keyframes.some((k) => k.rfFieldIntensity > 0.8 && k.phoneApproach > 0.7)),
    'NFC tap keyword activates RF rings and smartphone approach'
  );

  // Contiguous bounds check
  for (let i = 0; i < plan.scenes.length; i++) {
    const s = plan.scenes[i];
    if (i === 0) assert.equal(s.startSec, 0);
    else assert.equal(s.startSec, plan.scenes[i - 1].endSec);
    assert.ok(s.endSec > s.startSec);
  }
  assert.equal(plan.totalDurationSec, plan.scenes[plan.scenes.length - 1].endSec);

  const midFrame = evaluateExplainerFrame(plan.totalDurationSec * 0.5, plan.scenes);
  assert.equal(midFrame.accentHex, '#34D399');
});

test('normalizeGeneratedPresentation sanitizes malformed AI output into valid playable storyboard', () => {
  const metrics = calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS);
  const plan = normalizeGeneratedPresentation(
    {
      title: 'Hyper_Detail // NFC Showcase',
      creativeDirection: 'Close-up macro choreography',
      accentHex: 'not-a-hex',
      scenes: [
        {
          title: 'Macro_Coil_Dive',
          durationSec: 200, // out of range -> clamped to 22
          narration: 'Inspecting the tuned 13.56 MHz inductive coil.',
          highlightComponent: 'nfc_antenna',
          showCallouts: true, // allowed because keyframe 0 explodes to 1
          hudHeadline: 'NTAG424_DNA // SILICON',
          hudSubline: 'VCA-26-00202 // HARDWARE',
          hudMetrics: ['13.56 MHz', 'NTAG424_DNA', 'AES-128', 'Extra Ignored'],
          sfxStyle: 'nfc',
          keyframes: [
            { cameraPos: [0, 0, 0], fov: 99, housingOpacity: 0.01, explode: 2 },
            { cameraPos: [50, 30, 120], fov: 28, housingOpacity: 0.25, rfFieldIntensity: 1 },
            { cameraPos: [-60, 25, 140], fov: 32, housingOpacity: 0.5, phoneApproach: 1 },
          ],
        },
        {
          title: 'Hero Pullback',
          durationSec: 1, // out of range -> clamped to 5
          narration: 'Verified Card Authority.',
          showCallouts: true, // suppressed because explode stays 0
          keyframes: [
            { cameraPos: [90, 20, 210], explode: 0, outlineTraceProgress: 0.8 },
            { cameraPos: [20, 12, 230], explode: 0, outlineTraceProgress: 1 },
            { cameraPos: [0, 10, 250], explode: 0, outlineTraceProgress: 1 },
          ],
        },
      ],
    },
    'Show me a macro NFC coil showcase',
    DEFAULT_SLAB_PARAMETERS,
    metrics,
    'gemini'
  );

  assert.equal(plan.generatedBy, 'gemini');
  assert.equal(plan.title, 'Hyper Detail · NFC Showcase');
  assert.equal(plan.scenes.length, 2);
  assert.equal(plan.scenes[0].title, 'SCENE 01 · MACRO COIL DIVE');
  assert.equal(plan.scenes[0].hudHeadline, 'NTAG424 DNA · SILICON');
  assert.equal(plan.scenes[0].hudSubline, 'VCA-26-00202 · HARDWARE');
  assert.equal(plan.scenes[0].showCallouts, true);
  assert.equal(plan.scenes[1].showCallouts, false);
  assert.equal(plan.scenes[0].endSec - plan.scenes[0].startSec, 22);
  assert.equal(plan.scenes[1].endSec - plan.scenes[1].startSec, 5);
  assert.equal(plan.totalDurationSec, 27);
  assert.equal(plan.scenes[0].hudMetrics?.length, 3);
  assert.equal(plan.scenes[0].keyframes[0].fov, 50);
  assert.equal(plan.scenes[0].keyframes[0].housingOpacity, 0.16);
  assert.equal(plan.scenes[0].keyframes[0].explode, 1);
  assert.equal(formatTimecode(125), '02:05');
});
