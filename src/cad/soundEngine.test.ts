import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTrackEffectiveGain, DEFAULT_MIXER_STATE, MixerState } from './soundEngine';

test('computeTrackEffectiveGain returns configured gains when unmuted and un-soloed', () => {
  assert.equal(computeTrackEffectiveGain(DEFAULT_MIXER_STATE, 'vo'), 1.0);
  assert.equal(computeTrackEffectiveGain(DEFAULT_MIXER_STATE, 'music'), 0.45);
  assert.equal(computeTrackEffectiveGain(DEFAULT_MIXER_STATE, 'sfx'), 0.78);
});

test('computeTrackEffectiveGain zeros muted track and preserves unmuted tracks', () => {
  const mixer: MixerState = {
    ...DEFAULT_MIXER_STATE,
    music: { ...DEFAULT_MIXER_STATE.music, muted: true },
  };
  assert.equal(computeTrackEffectiveGain(mixer, 'music'), 0);
  assert.equal(computeTrackEffectiveGain(mixer, 'vo'), 1.0);
});

test('computeTrackEffectiveGain enforces solo priority and clamps gain bounds', () => {
  const soloVo: MixerState = {
    vo: { gain: 2.0, muted: false, solo: true },
    music: { gain: 0.8, muted: false, solo: false },
    sfx: { gain: 0.9, muted: false, solo: false },
  };
  assert.equal(computeTrackEffectiveGain(soloVo, 'vo'), 1.5);
  assert.equal(computeTrackEffectiveGain(soloVo, 'music'), 0);
  assert.equal(computeTrackEffectiveGain(soloVo, 'sfx'), 0);

  const soloButMuted: MixerState = {
    ...soloVo,
    vo: { gain: 1.0, muted: true, solo: true },
  };
  assert.equal(computeTrackEffectiveGain(soloButMuted, 'vo'), 0);
});
