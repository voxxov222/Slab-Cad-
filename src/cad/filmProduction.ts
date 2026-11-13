import { ASSEMBLED_CHOREOGRAPHY, AssemblyChoreography } from './slabGeometry';

export type CameraMotionPreset =
  | 'hero-dolly'
  | 'orbital-arc'
  | 'orbit-360'
  | 'macro-focus-pull'
  | 'overhead-track'
  | 'low-angle-hero';

export type TransitionType = 'cut' | 'crossfade' | 'dip-to-black';

export type SfxCueType =
  | 'bass-impact'
  | 'housing-glide'
  | 'card-seat'
  | 'micro-click'
  | 'ultrasonic-lock'
  | 'nfc-chime';

export type MaleVoiceId = 'Charon' | 'Fenrir' | 'Puck';
export type VideoResolutionId = '720p' | '1080p' | '2160p';

export const VIDEO_RESOLUTIONS: Record<
  VideoResolutionId,
  { id: VideoResolutionId; label: string; width: number; height: number; bitrate: number }
> = {
  '720p': { id: '720p', label: 'HD 1280×720 · 30fps', width: 1280, height: 720, bitrate: 5_000_000 },
  '1080p': { id: '1080p', label: 'FHD 1920×1080 · 30fps', width: 1920, height: 1080, bitrate: 10_000_000 },
  '2160p': { id: '2160p', label: '4K 3840×2160 · 30fps', width: 3840, height: 2160, bitrate: 22_000_000 },
};

export interface SfxCue {
  id: string;
  offsetSec: number;
  type: SfxCueType;
  label: string;
}

export interface CameraKeyframe {
  cameraPos: [number, number, number];
  target: [number, number, number];
  fov: number;
  focusDistanceMm: number;
  aperture: number;
  orbitAngleDeg: number;
  assembly: AssemblyChoreography;
  phoneApproach: number;
  phoneVerified: number;
}

export type QcCheckKey =
  | 'geometryConsistent'
  | 'lightingRealistic'
  | 'transparencyBelievable'
  | 'cameraSmooth'
  | 'narrationHuman'
  | 'labelsReadable'
  | 'engineeringAccurate'
  | 'syncTight';

export const QC_CHECK_ITEMS: { key: QcCheckKey; label: string }[] = [
  { key: 'geometryConsistent', label: 'Slab geometrically consistent' },
  { key: 'lightingRealistic', label: 'Studio lighting & reflections realistic' },
  { key: 'transparencyBelievable', label: 'Polycarbonate transparency believable' },
  { key: 'cameraSmooth', label: 'Camera movement smooth & deliberate' },
  { key: 'narrationHuman', label: 'Narration sounds natural & human' },
  { key: 'labelsReadable', label: 'Certification & QR labels readable' },
  { key: 'engineeringAccurate', label: 'Mechanical assembly makes sense' },
  { key: 'syncTight', label: 'Animation & audio cues synchronized' },
];

export type SceneQcDecision = 'pending' | 'approved' | 'rejected';

export interface SceneQcState {
  decision: SceneQcDecision;
  notes: string;
  checks: Record<QcCheckKey, boolean>;
}

export interface FilmScene {
  id: string;
  index: number;
  title: string;
  shortTitle: string;
  shotDescription: string;
  cameraPreset: CameraMotionPreset;
  transitionIn: TransitionType;
  transitionSec: number;
  durationSec: number;
  startSec: number;
  endSec: number;
  narration: string;
  musicEnergy: number; // 0..1 envelope for film score dynamics
  showTitleOverlay: 'opening' | 'finale' | 'none';
  sfxCues: SfxCue[];
  keyframes: [CameraKeyframe, CameraKeyframe, CameraKeyframe];
  qc: SceneQcState;
}

export interface FilmFrameState {
  timeSec: number;
  totalDurationSec: number;
  progress: number;
  sceneIndex: number;
  scene: FilmScene;
  sceneLocalT: number;
  cameraPos: [number, number, number];
  target: [number, number, number];
  fov: number;
  focusDistanceMm: number;
  aperture: number;
  assembly: AssemblyChoreography;
  phoneApproach: number;
  phoneVerified: number;
  videoOpacity: number; // 0 = black, 1 = full frame (handles dip-to-black & end fade)
  crossfadeMix: number; // 0..1 smooth boundary blend indicator
}

export function createDefaultQcState(): SceneQcState {
  return {
    decision: 'pending',
    notes: '',
    checks: {
      geometryConsistent: false,
      lightingRealistic: false,
      transparencyBelievable: false,
      cameraSmooth: false,
      narrationHuman: false,
      labelsReadable: false,
      engineeringAccurate: false,
      syncTight: false,
    },
  };
}

export function isSceneQcReadyForApproval(qc: SceneQcState): boolean {
  return QC_CHECK_ITEMS.every((item) => qc.checks[item.key]);
}

const RAW_SCENES: Omit<FilmScene, 'startSec' | 'endSec' | 'qc'>[] = [
  {
    id: 'scene-01-opening',
    index: 1,
    title: '01 · Opening Silhouette & Studio Reveal',
    shortTitle: '01 Opening',
    shotDescription:
      'Low-angle hero dolly-in out of darkness into a controlled 45° studio orbital reveal.',
    cameraPreset: 'low-angle-hero',
    transitionIn: 'dip-to-black',
    transitionSec: 0.9,
    durationSec: 10,
    narration:
      'Collectibles deserve more than a simple plastic case. They deserve certainty — engineered from the inside out.',
    musicEnergy: 0.35,
    showTitleOverlay: 'opening',
    sfxCues: [
      { id: 's1-impact', offsetSec: 0.2, type: 'bass-impact', label: 'Sub Open' },
    ],
    keyframes: [
      {
        cameraPos: [176, -24, 292],
        target: [0, -4, 0],
        fov: 34,
        focusDistanceMm: 340,
        aperture: 0.00014,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [82, 10, 274],
        target: [0, -2, 0],
        fov: 33,
        focusDistanceMm: 286,
        aperture: 0.00012,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [-86, 18, 258],
        target: [0, -2, 0],
        fov: 33,
        focusDistanceMm: 272,
        aperture: 0.00012,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
    ],
  },
  {
    id: 'scene-02-cavity',
    index: 2,
    title: '02 · Optical Housing & Card Cavity',
    shortTitle: '02 Housing',
    shotDescription:
      'Smooth dolly-in as the front optical shell separates, exposing the stepped retention cradle and card seating.',
    cameraPreset: 'hero-dolly',
    transitionIn: 'crossfade',
    transitionSec: 0.6,
    durationSec: 12,
    narration:
      'Every VCA slab begins with optical-grade polycarbonate. Two precision-moulded halves surround a dedicated retention cradle — holding the card without pressure on corners or edges.',
    musicEnergy: 0.5,
    showTitleOverlay: 'none',
    sfxCues: [
      { id: 's2-glide', offsetSec: 1.0, type: 'housing-glide', label: 'Shell Split' },
      { id: 's2-seat', offsetSec: 7.2, type: 'card-seat', label: 'Card Seat' },
    ],
    keyframes: [
      {
        cameraPos: [-86, 18, 258],
        target: [0, -2, 0],
        fov: 33,
        focusDistanceMm: 272,
        aperture: 0.00012,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [128, 28, 218],
        target: [0, -4, 8],
        fov: 32,
        focusDistanceMm: 248,
        aperture: 0.00018,
        orbitAngleDeg: 0,
        assembly: {
          frontHousingZMm: 42,
          rearHousingZMm: -20,
          cardOffsetMm: [0, 12, 16],
          cradleZMm: -6,
          nfcPocketZMm: 0,
          antennaOffsetMm: [0, 0, 12],
          chipOffsetMm: [0, 0, 18],
          labelOffsetMm: [0, 12, 34],
          weldPinsZMm: -4,
        },
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [138, 26, 206],
        target: [0, -4, 6],
        fov: 31,
        focusDistanceMm: 242,
        aperture: 0.00018,
        orbitAngleDeg: 0,
        assembly: {
          frontHousingZMm: 46,
          rearHousingZMm: -18,
          cardOffsetMm: [0, 0, 0],
          cradleZMm: 0,
          nfcPocketZMm: 0,
          antennaOffsetMm: [0, 0, 16],
          chipOffsetMm: [0, 0, 24],
          labelOffsetMm: [0, 24, 40],
          weldPinsZMm: 0,
        },
        phoneApproach: 0,
        phoneVerified: 0,
      },
    ],
  },
  {
    id: 'scene-03-nfc-install',
    index: 3,
    title: '03 · Macro — NFC Antenna & Silicon Die',
    shortTitle: '03 NFC Macro',
    shotDescription:
      'Extreme macro focus pull onto the upper recessed NFC pocket as the copper coil and NTAG chip install flush.',
    cameraPreset: 'macro-focus-pull',
    transitionIn: 'crossfade',
    transitionSec: 0.5,
    durationSec: 14,
    narration:
      'Inside the upper architecture lies a dedicated recessed pocket. A tuned copper spiral antenna and cryptographic NFC chip are integrated directly within the assembly — sealed out of reach.',
    musicEnergy: 0.62,
    showTitleOverlay: 'none',
    sfxCues: [
      { id: 's3-ant', offsetSec: 3.2, type: 'micro-click', label: 'Coil Seat' },
      { id: 's3-chip', offsetSec: 9.0, type: 'micro-click', label: 'NTAG Die' },
    ],
    keyframes: [
      {
        cameraPos: [64, 62, 118],
        target: [21, 47, 2],
        fov: 25,
        focusDistanceMm: 132,
        aperture: 0.00028,
        orbitAngleDeg: 0,
        assembly: {
          frontHousingZMm: 62,
          rearHousingZMm: -14,
          cardOffsetMm: [0, 0, 0],
          cradleZMm: 0,
          nfcPocketZMm: 4,
          antennaOffsetMm: [0, 6, 18],
          chipOffsetMm: [0, 10, 28],
          labelOffsetMm: [0, 44, 52],
          weldPinsZMm: 0,
        },
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [30, 56, 94],
        target: [22, 47, 2],
        fov: 24,
        focusDistanceMm: 98,
        aperture: 0.0003,
        orbitAngleDeg: 0,
        assembly: {
          frontHousingZMm: 62,
          rearHousingZMm: -8,
          cardOffsetMm: [0, 0, 0],
          cradleZMm: 0,
          nfcPocketZMm: 0,
          antennaOffsetMm: [0, 0, 0.2],
          chipOffsetMm: [0, 3, 11],
          labelOffsetMm: [0, 44, 52],
          weldPinsZMm: 0,
        },
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [-16, 54, 98],
        target: [19, 47, 1],
        fov: 25,
        focusDistanceMm: 106,
        aperture: 0.00026,
        orbitAngleDeg: 0,
        assembly: {
          frontHousingZMm: 52,
          rearHousingZMm: -4,
          cardOffsetMm: [0, 0, 0],
          cradleZMm: 0,
          nfcPocketZMm: 0,
          antennaOffsetMm: [0, 0, 0],
          chipOffsetMm: [0, 0, 0],
          labelOffsetMm: [0, 34, 40],
          weldPinsZMm: 0,
        },
        phoneApproach: 0,
        phoneVerified: 0,
      },
    ],
  },
  {
    id: 'scene-04-label',
    index: 4,
    title: '04 · Certification Label & Holographic Seal',
    shortTitle: '04 Label',
    shotDescription:
      'Dramatic overhead 3/4 tracking glide as the brushed metallic label and QR security seal register flush.',
    cameraPreset: 'overhead-track',
    transitionIn: 'crossfade',
    transitionSec: 0.5,
    durationSec: 10,
    narration:
      'Above the embedded antenna, the certification plate and holographic QR seal integrate flush within the upper bay, uniting serialized print verification with hardware authentication.',
    musicEnergy: 0.68,
    showTitleOverlay: 'none',
    sfxCues: [
      { id: 's4-label', offsetSec: 4.5, type: 'card-seat', label: 'Label Seal' },
    ],
    keyframes: [
      {
        cameraPos: [-34, 94, 146],
        target: [0, 44, 0],
        fov: 28,
        focusDistanceMm: 162,
        aperture: 0.0002,
        orbitAngleDeg: 0,
        assembly: {
          frontHousingZMm: 42,
          rearHousingZMm: -2,
          cardOffsetMm: [0, 0, 0],
          cradleZMm: 0,
          nfcPocketZMm: 0,
          antennaOffsetMm: [0, 0, 0],
          chipOffsetMm: [0, 0, 0],
          labelOffsetMm: [0, 22, 28],
          weldPinsZMm: 0,
        },
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [14, 78, 152],
        target: [0, 44, 0],
        fov: 27,
        focusDistanceMm: 160,
        aperture: 0.00018,
        orbitAngleDeg: 0,
        assembly: {
          frontHousingZMm: 30,
          rearHousingZMm: 0,
          cardOffsetMm: [0, 0, 0],
          cradleZMm: 0,
          nfcPocketZMm: 0,
          antennaOffsetMm: [0, 0, 0],
          chipOffsetMm: [0, 0, 0],
          labelOffsetMm: [0, 0, 2],
          weldPinsZMm: 0,
        },
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [84, 52, 168],
        target: [0, 34, 0],
        fov: 29,
        focusDistanceMm: 184,
        aperture: 0.00018,
        orbitAngleDeg: 0,
        assembly: {
          frontHousingZMm: 22,
          rearHousingZMm: 0,
          cardOffsetMm: [0, 0, 0],
          cradleZMm: 0,
          nfcPocketZMm: 0,
          antennaOffsetMm: [0, 0, 0],
          chipOffsetMm: [0, 0, 0],
          labelOffsetMm: [0, 0, 0],
          weldPinsZMm: 10,
        },
        phoneApproach: 0,
        phoneVerified: 0,
      },
    ],
  },
  {
    id: 'scene-05-closure',
    index: 5,
    title: '05 · Mechanical Lock & Final Assembly',
    shortTitle: '05 Closure',
    shotDescription:
      'Edge-profile macro dolly along the perimeter energy director and shear pins as the front housing closes flush.',
    cameraPreset: 'hero-dolly',
    transitionIn: 'crossfade',
    transitionSec: 0.5,
    durationSec: 12,
    narration:
      'Perimeter energy directors and alignment shear pins guide the front shell to zero-gap closure — engineered for permanent, tamper-evident ultrasonic sealing.',
    musicEnergy: 0.78,
    showTitleOverlay: 'none',
    sfxCues: [
      { id: 's5-pins', offsetSec: 3.0, type: 'housing-glide', label: 'Lock Close' },
      { id: 's5-lock', offsetSec: 8.2, type: 'ultrasonic-lock', label: 'Ultrasonic' },
    ],
    keyframes: [
      {
        cameraPos: [148, 22, 148],
        target: [0, 0, 0],
        fov: 31,
        focusDistanceMm: 205,
        aperture: 0.00018,
        orbitAngleDeg: 0,
        assembly: {
          frontHousingZMm: 22,
          rearHousingZMm: 0,
          cardOffsetMm: [0, 0, 0],
          cradleZMm: 0,
          nfcPocketZMm: 0,
          antennaOffsetMm: [0, 0, 0],
          chipOffsetMm: [0, 0, 0],
          labelOffsetMm: [0, 0, 0],
          weldPinsZMm: 10,
        },
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [176, 4, 112],
        target: [0, -2, 0],
        fov: 30,
        focusDistanceMm: 204,
        aperture: 0.00018,
        orbitAngleDeg: 0,
        assembly: {
          frontHousingZMm: 6,
          rearHousingZMm: 0,
          cardOffsetMm: [0, 0, 0],
          cradleZMm: 0,
          nfcPocketZMm: 0,
          antennaOffsetMm: [0, 0, 0],
          chipOffsetMm: [0, 0, 0],
          labelOffsetMm: [0, 0, 0],
          weldPinsZMm: 2,
        },
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [116, 12, 232],
        target: [0, -2, 0],
        fov: 32,
        focusDistanceMm: 256,
        aperture: 0.00013,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
    ],
  },
  {
    id: 'scene-06-360-hero',
    index: 6,
    title: '06 · 360° Product Showcase',
    shortTitle: '06 360° Orbit',
    shotDescription:
      'Continuous, unbroken 360-degree studio orbital rotation showcasing optical clarity, bevels, and rear finish.',
    cameraPreset: 'orbit-360',
    transitionIn: 'crossfade',
    transitionSec: 0.6,
    durationSec: 12,
    narration:
      'From every angle, a singular physical object. Crystal clarity, machined edges, and balanced optical weight built to showcase what matters.',
    musicEnergy: 0.85,
    showTitleOverlay: 'none',
    sfxCues: [],
    keyframes: [
      {
        cameraPos: [0, 14, 272],
        target: [0, -2, 0],
        fov: 33,
        focusDistanceMm: 272,
        aperture: 0.00011,
        orbitAngleDeg: 25,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [0, 18, 266],
        target: [0, -2, 0],
        fov: 33,
        focusDistanceMm: 266,
        aperture: 0.00011,
        orbitAngleDeg: 205,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [0, 14, 272],
        target: [0, -2, 0],
        fov: 33,
        focusDistanceMm: 272,
        aperture: 0.00011,
        orbitAngleDeg: 385,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
    ],
  },
  {
    id: 'scene-07-verification',
    index: 7,
    title: '07 · Physical-to-Digital Verification',
    shortTitle: '07 NFC Tap',
    shotDescription:
      'Controlled side-angle dolly as a 1:1 smartphone taps the NFC label to retrieve the external digital record.',
    cameraPreset: 'orbital-arc',
    transitionIn: 'crossfade',
    transitionSec: 0.5,
    durationSec: 12,
    narration:
      'A single tap turns physical protection into verifiable identity. The embedded NFC chip acts as a cryptographic key — connecting the slab to its digital record and blockchain history.',
    musicEnergy: 0.72,
    showTitleOverlay: 'none',
    sfxCues: [
      { id: 's7-tap', offsetSec: 4.8, type: 'nfc-chime', label: 'NFC Tap' },
    ],
    keyframes: [
      {
        cameraPos: [108, 24, 268],
        target: [24, 2, 0],
        fov: 34,
        focusDistanceMm: 286,
        aperture: 0.00014,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0.1,
        phoneVerified: 0,
      },
      {
        cameraPos: [54, 20, 262],
        target: [26, 4, 4],
        fov: 34,
        focusDistanceMm: 268,
        aperture: 0.00014,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 1.0,
        phoneVerified: 0.8,
      },
      {
        cameraPos: [-32, 16, 272],
        target: [20, 2, 4],
        fov: 34,
        focusDistanceMm: 278,
        aperture: 0.00013,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 1.0,
        phoneVerified: 1.0,
      },
    ],
  },
  {
    id: 'scene-08-finale',
    index: 8,
    title: '08 · Brand Finale',
    shortTitle: '08 Finale',
    shotDescription:
      'Symmetrical dolly-out pull-back holding the VCA slab cleanly beside the end card before fading to black.',
    cameraPreset: 'hero-dolly',
    transitionIn: 'crossfade',
    transitionSec: 0.6,
    durationSec: 8,
    narration: 'Verified Card Authority. Trust what you collect.',
    musicEnergy: 0.3,
    showTitleOverlay: 'finale',
    sfxCues: [
      { id: 's8-impact', offsetSec: 0.4, type: 'bass-impact', label: 'Finale' },
    ],
    keyframes: [
      {
        cameraPos: [56, 12, 268],
        target: [-32, -2, 0],
        fov: 33,
        focusDistanceMm: 278,
        aperture: 0.00011,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [24, 10, 294],
        target: [-38, -2, 0],
        fov: 33,
        focusDistanceMm: 300,
        aperture: 0.0001,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
      {
        cameraPos: [0, 8, 318],
        target: [-40, -2, 0],
        fov: 34,
        focusDistanceMm: 322,
        aperture: 0.0001,
        orbitAngleDeg: 0,
        assembly: ASSEMBLED_CHOREOGRAPHY,
        phoneApproach: 0,
        phoneVerified: 0,
      },
    ],
  },
];

export function recalculateSceneBounds(scenes: FilmScene[]): FilmScene[] {
  let cursor = 0;
  return scenes.map((scene, idx) => {
    const dur = Math.max(2, Number(scene.durationSec) || 8);
    const startSec = cursor;
    const endSec = cursor + dur;
    cursor = endSec;
    return {
      ...scene,
      index: idx + 1,
      durationSec: dur,
      startSec,
      endSec,
    };
  });
}

export const DEFAULT_FILM_SCENES: FilmScene[] = recalculateSceneBounds(
  RAW_SCENES.map((s) => ({
    ...s,
    startSec: 0,
    endSec: s.durationSec,
    qc: createDefaultQcState(),
  }))
);

export function getTotalFilmDuration(scenes: FilmScene[]): number {
  if (!scenes.length) return 90;
  return scenes[scenes.length - 1].endSec;
}

function smootherstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smooth C1 quadratic/cubic Bezier interpolation over [k0, k1, k2] with ease-in-out timing.
 */
function sample3Scalar(a: number, b: number, c: number, t: number): number {
  if (t <= 0.5) {
    return lerp(a, b, smootherstep(t * 2));
  }
  return lerp(b, c, smootherstep((t - 0.5) * 2));
}

function quadBezier(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function quadBezierVec3(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  t: number
): [number, number, number] {
  return [
    quadBezier(p0[0], p1[0], p2[0], t),
    quadBezier(p0[1], p1[1], p2[1], t),
    quadBezier(p0[2], p1[2], p2[2], t),
  ];
}

function interpolateAssembly(
  a: AssemblyChoreography,
  b: AssemblyChoreography,
  t: number
): AssemblyChoreography {
  return {
    frontHousingZMm: lerp(a.frontHousingZMm, b.frontHousingZMm, t),
    rearHousingZMm: lerp(a.rearHousingZMm, b.rearHousingZMm, t),
    cardOffsetMm: [
      lerp(a.cardOffsetMm[0], b.cardOffsetMm[0], t),
      lerp(a.cardOffsetMm[1], b.cardOffsetMm[1], t),
      lerp(a.cardOffsetMm[2], b.cardOffsetMm[2], t),
    ],
    cradleZMm: lerp(a.cradleZMm, b.cradleZMm, t),
    nfcPocketZMm: lerp(a.nfcPocketZMm, b.nfcPocketZMm, t),
    antennaOffsetMm: [
      lerp(a.antennaOffsetMm[0], b.antennaOffsetMm[0], t),
      lerp(a.antennaOffsetMm[1], b.antennaOffsetMm[1], t),
      lerp(a.antennaOffsetMm[2], b.antennaOffsetMm[2], t),
    ],
    chipOffsetMm: [
      lerp(a.chipOffsetMm[0], b.chipOffsetMm[0], t),
      lerp(a.chipOffsetMm[1], b.chipOffsetMm[1], t),
      lerp(a.chipOffsetMm[2], b.chipOffsetMm[2], t),
    ],
    labelOffsetMm: [
      lerp(a.labelOffsetMm[0], b.labelOffsetMm[0], t),
      lerp(a.labelOffsetMm[1], b.labelOffsetMm[1], t),
      lerp(a.labelOffsetMm[2], b.labelOffsetMm[2], t),
    ],
    weldPinsZMm: lerp(a.weldPinsZMm, b.weldPinsZMm, t),
  };
}

export function evaluateFilmFrame(
  rawTimeSec: number,
  scenes: FilmScene[] = DEFAULT_FILM_SCENES
): FilmFrameState {
  const activeScenes = scenes.length > 0 ? scenes : DEFAULT_FILM_SCENES;
  const totalDurationSec = getTotalFilmDuration(activeScenes);
  const timeSec = Math.max(0, Math.min(totalDurationSec, rawTimeSec));
  const progress = totalDurationSec > 0 ? timeSec / totalDurationSec : 0;

  let sceneIndex = activeScenes.length - 1;
  for (let i = 0; i < activeScenes.length; i++) {
    const s = activeScenes[i];
    if (timeSec >= s.startSec && timeSec < s.endSec) {
      sceneIndex = i;
      break;
    }
  }

  const scene = activeScenes[sceneIndex];
  const span = Math.max(0.001, scene.endSec - scene.startSec);
  const rawLocalT = Math.max(0, Math.min(1, (timeSec - scene.startSec) / span));
  const easedT = smootherstep(rawLocalT);

  const [k0, k1, k2] = scene.keyframes;

  let cameraPos: [number, number, number];
  if (scene.cameraPreset === 'orbit-360') {
    const radius = sample3Scalar(k0.cameraPos[2], k1.cameraPos[2], k2.cameraPos[2], rawLocalT);
    const heightY = sample3Scalar(k0.cameraPos[1], k1.cameraPos[1], k2.cameraPos[1], rawLocalT);
    const angleDeg = sample3Scalar(k0.orbitAngleDeg, k1.orbitAngleDeg, k2.orbitAngleDeg, rawLocalT);
    const rad = (angleDeg * Math.PI) / 180;
    cameraPos = [Math.sin(rad) * radius, heightY, Math.cos(rad) * radius];
  } else {
    cameraPos = quadBezierVec3(k0.cameraPos, k1.cameraPos, k2.cameraPos, easedT);
  }

  const target = quadBezierVec3(k0.target, k1.target, k2.target, easedT);

  const assembly =
    rawLocalT <= 0.5
      ? interpolateAssembly(k0.assembly, k1.assembly, smootherstep(rawLocalT * 2))
      : interpolateAssembly(k1.assembly, k2.assembly, smootherstep((rawLocalT - 0.5) * 2));

  // Transition opacity envelope (handles dip-to-black & clean finale fade-out)
  let videoOpacity = 1;
  let crossfadeMix = 1;
  const elapsedInScene = timeSec - scene.startSec;
  const remainingInScene = scene.endSec - timeSec;
  const transDur = Math.max(0.15, Math.min(span * 0.45, scene.transitionSec));

  if (scene.transitionIn === 'dip-to-black' && elapsedInScene < transDur) {
    videoOpacity = smootherstep(elapsedInScene / transDur);
  } else if (scene.transitionIn === 'crossfade' && elapsedInScene < transDur) {
    crossfadeMix = smootherstep(elapsedInScene / transDur);
    // Slight studio exposure breath across crossfades for smooth scene transitions
    videoOpacity = 0.72 + 0.28 * crossfadeMix;
  }

  // Final scene fades smoothly to pure black over its last 1.4s
  if (sceneIndex === activeScenes.length - 1 && remainingInScene < 1.4) {
    videoOpacity = Math.min(videoOpacity, smootherstep(remainingInScene / 1.4));
  }

  return {
    timeSec,
    totalDurationSec,
    progress,
    sceneIndex,
    scene,
    sceneLocalT: rawLocalT,
    cameraPos,
    target,
    fov: sample3Scalar(k0.fov, k1.fov, k2.fov, rawLocalT),
    focusDistanceMm: sample3Scalar(
      k0.focusDistanceMm,
      k1.focusDistanceMm,
      k2.focusDistanceMm,
      rawLocalT
    ),
    aperture: sample3Scalar(k0.aperture, k1.aperture, k2.aperture, rawLocalT),
    assembly,
    phoneApproach: sample3Scalar(k0.phoneApproach, k1.phoneApproach, k2.phoneApproach, rawLocalT),
    phoneVerified: sample3Scalar(k0.phoneVerified, k1.phoneVerified, k2.phoneVerified, rawLocalT),
    videoOpacity,
    crossfadeMix,
  };
}

export function formatTimecode(sec: number, showTenths = false): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped % 1) * 10);
  const base = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return showTenths ? `${base}.${tenths}` : base;
}
