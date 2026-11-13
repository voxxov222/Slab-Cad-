import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateNfcTap } from './nfcCrypto';

test('NTAG424 DNA normal tap produces valid AES-128 CMAC and dynamic SUN URL', () => {
  const res = simulateNfcTap({
    serialNumber: 'VCA-26-00202',
    chipType: 'ntag424_dna',
    uidHex: '04A39B72C15080',
    counter: 42,
    scenario: 'normal',
  });

  assert.equal(res.outcome, 'AUTHENTIC_NTAG424');
  assert.equal(res.httpStatus, 200);
  assert.ok(res.cmacHex && res.cmacHex.length === 16);
  assert.ok(res.ndfUrl.includes('picc=04A39B72C15080'));
  assert.ok(res.ndfUrl.includes('cmac='));
  assert.ok(res.checks.every((c) => c.passed));
});

test('NTAG215 normal tap explicitly warns that anti-cloning crypto is absent', () => {
  const res = simulateNfcTap({
    serialNumber: 'VCA-26-00202',
    chipType: 'ntag215',
    uidHex: '04A39B72C15080',
    counter: 1,
    scenario: 'normal',
  });

  assert.equal(res.outcome, 'PROTOTYPE_NTAG215_UNVERIFIED_CRYPTO');
  assert.equal(res.cmacHex, null);
  assert.equal(res.checks.find((c) => c.label.includes('Anti-Cloning'))?.passed, false);
});

test('clone replay and tamper seal scenarios return 403/409 security alerts', () => {
  const replay = simulateNfcTap({
    serialNumber: 'VCA-26-00202',
    chipType: 'ntag424_dna',
    uidHex: '04A39B72C15080',
    counter: 42,
    scenario: 'clone_replay',
  });
  assert.equal(replay.outcome, 'CLONE_REPLAY_DETECTED');
  assert.equal(replay.httpStatus, 403);

  const tamper = simulateNfcTap({
    serialNumber: 'VCA-26-00202',
    chipType: 'ntag424_dna',
    uidHex: '04A39B72C15080',
    counter: 42,
    scenario: 'tampered_seal',
  });
  assert.equal(tamper.outcome, 'TAMPER_SEAL_BROKEN');
  assert.equal(tamper.httpStatus, 409);
});
