import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EXPLAINER_SCENES,
  EXPLAINER_DURATION_SEC,
  VIDEO_RESOLUTIONS,
  evaluateExplainerFrame,
  formatTimecode,
} from './explainerTimeline';

test('90-second cinematic storyboard has 7 exact contiguous scenes', () => {
  assert.equal(EXPLAINER_DURATION_SEC, 90);
  assert.equal(DEFAULT_EXPLAINER_SCENES.length, 7);

  const expectedBounds = [
    [0, 10],
    [10, 25],
    [25, 42],
    [42, 57],
    [57, 75],
    [75, 85],
    [85, 90],
  ];

  DEFAULT_EXPLAINER_SCENES.forEach((scene, idx) => {
    assert.equal(scene.startSec, expectedBounds[idx][0]);
    assert.equal(scene.endSec, expectedBounds[idx][1]);
    assert.ok(scene.narration.length > 10);
  });
});

test('Bezier camera and effect channels evaluate accurately across all 7 scenes', () => {
  const s1 = evaluateExplainerFrame(0);
  assert.equal(s1.segment.index, 1);
  assert.equal(s1.fadeOpacity, 0);

  const s2 = evaluateExplainerFrame(22);
  assert.equal(s2.segment.index, 2);
  assert.ok(s2.explode > 0.85, 'Scene 02 reveals full exploded assembly');
  assert.equal(s2.showCallouts, true);

  const s3 = evaluateExplainerFrame(33.5);
  assert.equal(s3.segment.index, 3);
  assert.ok(s3.housingOpacity < 0.3, 'Scene 03 fades outer housing semi-transparent');
  assert.ok(s3.rfFieldIntensity > 0.8, 'Scene 03 activates RF field visualization');
  assert.ok(s3.phoneApproach > 0.6, 'Scene 03 moves smartphone toward NFC compartment');

  const s4 = evaluateExplainerFrame(50);
  assert.equal(s4.segment.index, 4);
  assert.ok(s4.dataStreamProgress > 0.8, 'Scene 04 illuminates data stream');

  const s5 = evaluateExplainerFrame(66);
  assert.equal(s5.segment.index, 5);
  assert.ok(s5.mfgStageProgress > 0.5, 'Scene 05 advances through manufacturing stages');

  const s7End = evaluateExplainerFrame(90);
  assert.equal(s7End.segment.index, 7);
  assert.equal(s7End.timeSec, 90);
  assert.equal(s7End.fadeOpacity, 0, 'Final frame fades cleanly to black');
});

test('supports editable scene configuration overrides and MP4/HD resolution presets', () => {
  const edited = DEFAULT_EXPLAINER_SCENES.map((s, i) =>
    i === 0 ? { ...s, narration: 'Custom VCA Opening Line.' } : s
  );
  const frame = evaluateExplainerFrame(4, edited);
  assert.equal(frame.segment.narration, 'Custom VCA Opening Line.');

  assert.equal(VIDEO_RESOLUTIONS['480p'].width, 854);
  assert.equal(VIDEO_RESOLUTIONS['480p'].height, 480);
  assert.equal(VIDEO_RESOLUTIONS['1080p'].width, 1920);
  assert.equal(VIDEO_RESOLUTIONS['1080p'].height, 1080);
});

test('formatTimecode formats up to 01:30', () => {
  assert.equal(formatTimecode(0), '00:00');
  assert.equal(formatTimecode(57), '00:57');
  assert.equal(formatTimecode(90), '01:30');
});
