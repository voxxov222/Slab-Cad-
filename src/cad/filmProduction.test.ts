import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FILM_SCENES,
  QC_CHECK_ITEMS,
  createDefaultQcState,
  evaluateFilmFrame,
  formatTimecode,
  getTotalFilmDuration,
  isSceneQcReadyForApproval,
  recalculateSceneBounds,
} from './filmProduction';

test('8-scene commercial production timeline is contiguous and totals 90s', () => {
  assert.equal(DEFAULT_FILM_SCENES.length, 8);
  assert.equal(getTotalFilmDuration(DEFAULT_FILM_SCENES), 90);

  for (let i = 0; i < DEFAULT_FILM_SCENES.length; i++) {
    const s = DEFAULT_FILM_SCENES[i];
    assert.equal(s.index, i + 1);
    assert.ok(s.durationSec > 0);
    if (i > 0) {
      assert.equal(s.startSec, DEFAULT_FILM_SCENES[i - 1].endSec);
    }
  }
});

test('evaluates real mechanical assembly choreography and 360-degree showcase orbit', () => {
  const s1Start = evaluateFilmFrame(0);
  assert.equal(s1Start.scene.id, 'scene-01-opening');
  assert.equal(s1Start.videoOpacity, 0);

  // Scene 02 lifts front housing cleanly away from rear housing
  const s2Mid = evaluateFilmFrame(16);
  assert.equal(s2Mid.scene.id, 'scene-02-cavity');
  assert.ok(s2Mid.assembly.frontHousingZMm > 25, 'Front polycarbonate shell lifts during Scene 02');
  assert.ok(s2Mid.assembly.rearHousingZMm < -5, 'Rear housing seats opposite');

  // Scene 03 macro NFC antenna & chip installation
  const s3Start = evaluateFilmFrame(22.2);
  assert.equal(s3Start.scene.id, 'scene-03-nfc-install');
  assert.ok(s3Start.fov <= 25.5, 'Macro close-up narrows FOV');
  assert.ok(s3Start.assembly.antennaOffsetMm[2] > 10, 'Antenna lowers into pocket');

  // Scene 06 executes full 360° camera rotation
  const s6Quarter = evaluateFilmFrame(61); // 3s into 12s scene -> ~90 deg
  const s6Half = evaluateFilmFrame(64); // 6s into 12s scene -> ~205 deg (rear side)
  assert.equal(s6Half.scene.id, 'scene-06-360-hero');
  assert.ok(s6Half.cameraPos[2] < -100, '360° orbit passes behind the slab at mid-scene');
  assert.notEqual(Math.round(s6Quarter.cameraPos[0]), Math.round(s6Half.cameraPos[0]));

  // Scene 07 1:1 smartphone tap verification
  const s7Mid = evaluateFilmFrame(76);
  assert.equal(s7Mid.scene.id, 'scene-07-verification');
  assert.ok(s7Mid.phoneApproach > 0.85);
  assert.ok(s7Mid.phoneVerified > 0.6);

  // Scene 08 fades cleanly to black at 90s
  const endFrame = evaluateFilmFrame(90);
  assert.equal(endFrame.scene.id, 'scene-08-finale');
  assert.equal(endFrame.videoOpacity, 0);
});

test('recalculates contiguous scene bounds when producer edits scene durations', () => {
  const edited = DEFAULT_FILM_SCENES.map((s, i) => (i === 0 ? { ...s, durationSec: 12 } : s));
  const updated = recalculateSceneBounds(edited);
  assert.equal(updated[0].startSec, 0);
  assert.equal(updated[0].endSec, 12);
  assert.equal(updated[1].startSec, 12);
  assert.equal(getTotalFilmDuration(updated), 92);
});

test('8-point QC approval gate rejects incomplete scene inspections', () => {
  const qc = createDefaultQcState();
  assert.equal(isSceneQcReadyForApproval(qc), false);

  QC_CHECK_ITEMS.slice(0, 7).forEach((item) => {
    qc.checks[item.key] = true;
  });
  assert.equal(isSceneQcReadyForApproval(qc), false);

  qc.checks[QC_CHECK_ITEMS[7].key] = true;
  assert.equal(isSceneQcReadyForApproval(qc), true);
});

test('formatTimecode supports optional tenths precision', () => {
  assert.equal(formatTimecode(0), '00:00');
  assert.equal(formatTimecode(75.4, true), '01:15.4');
});
