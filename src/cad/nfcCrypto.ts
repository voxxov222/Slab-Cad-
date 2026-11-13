import { NfcChipConfigId } from './types';

export type VerificationOutcome =
  | 'AUTHENTIC_NTAG424'
  | 'PROTOTYPE_NTAG215_UNVERIFIED_CRYPTO'
  | 'CLONE_REPLAY_DETECTED'
  | 'TAMPER_SEAL_BROKEN'
  | 'SERIAL_REVOKED';

export interface NfcTapSimulationResult {
  outcome: VerificationOutcome;
  chipType: NfcChipConfigId;
  uidHex: string;
  readCounter: number;
  cmacHex: string | null;
  ndfUrl: string;
  verifiedAtIso: string;
  httpStatus: number;
  headline: string;
  detail: string;
  checks: {
    label: string;
    passed: boolean;
    detail: string;
  }[];
}

// Deterministic FNV-1a / pseudo-CMAC generator for transparent client-side cryptographic demonstration
function fnv1aHex(input: string, length = 16): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  const combined =
    h1.toString(16).padStart(8, '0').toUpperCase() +
    h2.toString(16).padStart(8, '0').toUpperCase() +
    ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return combined.slice(0, length);
}

export function simulateNfcTap(params: {
  serialNumber: string;
  chipType: NfcChipConfigId;
  uidHex: string;
  counter: number;
  scenario: 'normal' | 'clone_replay' | 'tampered_seal' | 'revoked';
}): NfcTapSimulationResult {
  const { serialNumber, chipType, uidHex, counter, scenario } = params;
  const counterHex = counter.toString(16).padStart(6, '0').toUpperCase();
  const verifiedAtIso = new Date().toISOString();

  if (scenario === 'revoked') {
    return {
      outcome: 'SERIAL_REVOKED',
      chipType,
      uidHex,
      readCounter: counter,
      cmacHex: chipType === 'ntag424_dna' ? fnv1aHex(`${uidHex}:${counterHex}:VCA`, 16) : null,
      ndfUrl: `https://vcaslabs.com/v/${encodeURIComponent(serialNumber)}`,
      verifiedAtIso,
      httpStatus: 410,
      headline: 'Certification Revoked in VCA Registry',
      detail:
        'Serial number has been flagged as replaced, surrendered, or invalidated by Verified Card Authority.',
      checks: [
        { label: 'Physical NFC UID Match', passed: true, detail: `UID ${uidHex} matches record` },
        { label: 'Registry Status', passed: false, detail: 'Status = REVOKED / DO NOT TRUST' },
        { label: 'Blockchain Token State', passed: false, detail: 'Metadata frozen with revocation flag' },
      ],
    };
  }

  if (scenario === 'tampered_seal') {
    return {
      outcome: 'TAMPER_SEAL_BROKEN',
      chipType,
      uidHex,
      readCounter: counter,
      cmacHex: chipType === 'ntag424_dna' ? fnv1aHex(`${uidHex}:${counterHex}:TAMPER`, 16) : null,
      ndfUrl: `https://vcaslabs.com/v/${encodeURIComponent(serialNumber)}?t=1`,
      verifiedAtIso,
      httpStatus: 409,
      headline: 'Tamper-Evident Loop Open / Physical Breach',
      detail:
        'NTAG424 DNA TT (Tamper Tag) status wire detected an open circuit across the ultrasonic weld barrier.',
      checks: [
        { label: 'UID Binding', passed: true, detail: `UID ${uidHex} bound to ${serialNumber}` },
        { label: 'Tamper Loop Continuity', passed: false, detail: 'TT Status = OPEN (Seal Fractured)' },
        { label: 'Custody Verification', passed: false, detail: 'Requires physical lab re-inspection' },
      ],
    };
  }

  if (scenario === 'clone_replay') {
    const staleCounter = Math.max(1, counter - 3);
    const staleHex = staleCounter.toString(16).padStart(6, '0').toUpperCase();
    const forgedCmac = fnv1aHex(`${uidHex}:${staleHex}:FORGED`, 16);
    return {
      outcome: 'CLONE_REPLAY_DETECTED',
      chipType,
      uidHex,
      readCounter: staleCounter,
      cmacHex: chipType === 'ntag424_dna' ? forgedCmac : null,
      ndfUrl:
        chipType === 'ntag424_dna'
          ? `https://vcaslabs.com/v/${encodeURIComponent(serialNumber)}?picc=${uidHex}&ctr=${staleHex}&cmac=${forgedCmac}`
          : `https://vcaslabs.com/v/${encodeURIComponent(serialNumber)}`,
      verifiedAtIso,
      httpStatus: 403,
      headline: 'Suspected Cloned Tag / Replay Attack Blocked',
      detail:
        chipType === 'ntag424_dna'
          ? `Received counter (${staleCounter}) is <= last verified counter (${counter}) or AES-128 CMAC failed backend validation.`
          : 'NTAG215 has no cryptographic counter or AES-128 key — static NDEF URL was copied to an unauthorized sticker.',
      checks: [
        { label: 'Static UID Check', passed: true, detail: `UID ${uidHex} spoofed or copied` },
        {
          label: 'Monotonic SDM Read Counter',
          passed: false,
          detail: `Received ctr=${staleCounter} <= stored=${counter}`,
        },
        {
          label: 'AES-128 SUN CMAC Signature',
          passed: false,
          detail: 'Cryptographic MAC mismatch against VCA HSM key',
        },
      ],
    };
  }

  // Normal tap path
  if (chipType === 'ntag215') {
    return {
      outcome: 'PROTOTYPE_NTAG215_UNVERIFIED_CRYPTO',
      chipType,
      uidHex,
      readCounter: counter,
      cmacHex: null,
      ndfUrl: `https://vcaslabs.com/v/${encodeURIComponent(serialNumber)}`,
      verifiedAtIso,
      httpStatus: 200,
      headline: 'Prototype Tag Read (Static NDEF — Non-Cryptographic)',
      detail:
        'NTAG215 resolved static NDEF URL and UID lookup. WARNING: NTAG215 lacks AES-128 dynamic messaging and cannot prevent UID/URL cloning.',
      checks: [
        { label: 'NDEF URI Lookup', passed: true, detail: `Resolved ${serialNumber}` },
        { label: '7-Byte UID Registry Match', passed: true, detail: `UID ${uidHex} recognized` },
        {
          label: 'AES-128 Anti-Cloning Proof',
          passed: false,
          detail: 'Not supported on NTAG215 — upgrade to NTAG424 DNA for production',
        },
      ],
    };
  }

  const cmacHex = fnv1aHex(`${uidHex}:${counterHex}:VCA-HSM-KEY01`, 16);
  return {
    outcome: 'AUTHENTIC_NTAG424',
    chipType,
    uidHex,
    readCounter: counter,
    cmacHex,
    ndfUrl: `https://vcaslabs.com/v/${encodeURIComponent(serialNumber)}?picc=${uidHex}&ctr=${counterHex}&cmac=${cmacHex}`,
    verifiedAtIso,
    httpStatus: 200,
    headline: 'Cryptographically Verified Authentic VCA Slab',
    detail:
      'NTAG424 DNA dynamic SUN payload verified via AES-128 CMAC and monotonic read counter against VCA HSM.',
    checks: [
      { label: '7-Byte Hardware UID', passed: true, detail: `UID ${uidHex} bound in factory` },
      { label: 'Monotonic SDM Counter', passed: true, detail: `Counter #${counter} > previous` },
      { label: 'AES-128 SUN CMAC', passed: true, detail: `CMAC ${cmacHex} verified` },
      { label: 'Tamper-Evident Loop', passed: true, detail: 'TT Circuit Closed (Intact)' },
    ],
  };
}
