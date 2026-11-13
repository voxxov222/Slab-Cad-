import { SlabComponentId } from './types';

export const EXPLAINER_DURATION_SEC = 90;

export type MaleVoiceId = 'Charon' | 'Fenrir' | 'Puck';

export type VideoResolutionId = '480p' | '720p' | '1080p' | '2160p';

export const VIDEO_RESOLUTIONS: Record<
  VideoResolutionId,
  { id: VideoResolutionId; label: string; width: number; height: number; bitrate: number }
> = {
  '480p': { id: '480p', label: 'Regular MP4 854×480 · 30fps', width: 854, height: 480, bitrate: 2_500_000 },
  '720p': { id: '720p', label: 'HD 1280×720 · 30fps', width: 1280, height: 720, bitrate: 4_500_000 },
  '1080p': { id: '1080p', label: 'Full HD 1920×1080 · 30fps', width: 1920, height: 1080, bitrate: 8_000_000 },
  '2160p': { id: '2160p', label: '4K 3840×2160 · 30fps', width: 3840, height: 2160, bitrate: 18_000_000 },
};

export type SceneSfxStyle = 'impact' | 'mechanical' | 'nfc' | 'telemetry' | 'laser';

export interface ExplainerKeyframe {
  cameraPos: [number, number, number];
  target: [number, number, number];
  fov: number;
  explode: number;
  housingOpacity: number;
  rfFieldIntensity: number;
  phoneApproach: number;
  dataStreamProgress: number;
  mfgStageProgress: number;
  outlineTraceProgress: number;
  sectionEnabled: boolean;
  sectionOffsetMm: number;
}

export interface ExplainerSegment {
  id: string;
  index: number;
  title: string;
  angleLabel: string;
  cameraPathDescription: string;
  soundDesignCue: string;
  startSec: number;
  endSec: number;
  narration: string;
  highlightComponent: SlabComponentId | null;
  showCallouts: boolean;
  hudHeadline?: string;
  hudSubline?: string;
  hudMetrics?: string[];
  accentHex?: string;
  sfxStyle?: SceneSfxStyle;
  keyframes: [ExplainerKeyframe, ExplainerKeyframe, ExplainerKeyframe];
}

export interface ExplainerFrameState {
  timeSec: number;
  progress: number;
  segmentIndex: number;
  segment: ExplainerSegment;
  segmentLocalT: number;
  cameraPos: [number, number, number];
  target: [number, number, number];
  fov: number;
  explode: number;
  housingOpacity: number;
  rfFieldIntensity: number;
  phoneApproach: number;
  dataStreamProgress: number;
  mfgStageProgress: number;
  outlineTraceProgress: number;
  fadeOpacity: number;
  sectionEnabled: boolean;
  sectionOffsetMm: number;
  highlightComponent: SlabComponentId | null;
  showCallouts: boolean;
  accentHex: string;
}

export const DEFAULT_EXPLAINER_SCENES: ExplainerSegment[] = [
  {
    id: 'scene-01-reveal',
    index: 1,
    title: 'SCENE 01 · THE REVEAL',
    angleLabel: 'Volumetric Sweep & 180° Hero Orbit',
    cameraPathDescription:
      'Fade from darkness with volumetric electric-blue light sweep, slow forward dolly push, and sweeping 180° orbital reveal around the suspended slab.',
    soundDesignCue: 'Deep sub-bass impact (00:00), atmospheric pad swell, rising orchestral strings',
    startSec: 0,
    endSec: 10,
    narration:
      'Protection. Authentication. Digital identity. Introducing the future of collectible certification. VCA.',
    highlightComponent: null,
    showCallouts: false,
    keyframes: [
      {
        cameraPos: [175, -18, 255],
        target: [0, -10, 0],
        fov: 34,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0.25,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [35, 16, 224],
        target: [0, -10, 0],
        fov: 32,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0.65,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [-156, 26, 212],
        target: [0, -12, 0],
        fov: 34,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
    ],
  },
  {
    id: 'scene-02-protection',
    index: 2,
    title: 'SCENE 02 · ENGINEERED PROTECTION',
    angleLabel: 'Macro Dolly, 45° Orbit & 12-Layer Explosion',
    cameraPathDescription:
      'Macro dolly into optical housing bevel, 45° orbital glide into Z-axis exploded assembly, and controlled pullback displaying millimeter tolerances.',
    soundDesignCue: 'Precision mechanical servo glide synchronized with 12-part axial separation',
    startSec: 10,
    endSec: 25,
    narration:
      'Every VCA slab begins with precision engineering. A purpose-designed protective housing, carefully integrated components and a secure construction developed to preserve the integrity of every certified collectible.',
    highlightComponent: 'perimeter_bezel',
    showCallouts: true,
    keyframes: [
      {
        cameraPos: [-56, 12, 134],
        target: [0, -10, 0],
        fov: 30,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [148, 36, 184],
        target: [0, -12, 0],
        fov: 34,
        explode: 0.85,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [216, 46, 196],
        target: [0, -14, 0],
        fov: 36,
        explode: 1,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
    ],
  },
  {
    id: 'scene-03-nfc',
    index: 3,
    title: 'SCENE 03 · NFC TECHNOLOGY',
    angleLabel: 'X-Ray Housing Fade, RF Field & Tap Detection',
    cameraPathDescription:
      'Push into the upper certification label as the outer shell fades semi-transparent, revealing the copper spiral coil, animated RF field rings, and smartphone tap.',
    soundDesignCue: '13.56 MHz electromagnetic harmonic hum + clean digital NFC handshake chime',
    startSec: 25,
    endSec: 42,
    narration:
      'At the heart of the system is integrated NFC technology. A simple tap connects the physical collectible to its digital certification, creating a bridge between the slab and its verifiable identity.',
    highlightComponent: 'nfc_antenna',
    showCallouts: false,
    keyframes: [
      {
        cameraPos: [92, 46, 158],
        target: [20, 14, 0],
        fov: 33,
        explode: 0.25,
        housingOpacity: 0.32,
        rfFieldIntensity: 0.75,
        phoneApproach: 0.15,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [44, 42, 146],
        target: [20, 12, 0],
        fov: 32,
        explode: 0,
        housingOpacity: 0.22,
        rfFieldIntensity: 1,
        phoneApproach: 0.85,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [-64, 38, 168],
        target: [14, 10, 0],
        fov: 34,
        explode: 0,
        housingOpacity: 0.45,
        rfFieldIntensity: 1,
        phoneApproach: 1,
        dataStreamProgress: 0.25,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
    ],
  },
  {
    id: 'scene-04-blockchain',
    index: 4,
    title: 'SCENE 04 · DIGITAL IDENTITY & BLOCKCHAIN',
    angleLabel: 'Data Stream Arc & Network Constellation',
    cameraPathDescription:
      'Follow the luminous blue data arc from the NFC interface into the 3D verification network constellation and smartphone dashboard.',
    soundDesignCue: 'Pulse-synced data telemetry arpeggio and crisp verification confirmation tone',
    startSec: 42,
    endSec: 57,
    narration:
      'Beyond the physical slab, every certification can connect to a digital record, with blockchain-linked identity, verification history and ownership functionality designed for the future of collectibles.',
    highlightComponent: 'nfc_chip',
    showCallouts: false,
    keyframes: [
      {
        cameraPos: [-64, 38, 168],
        target: [12, 8, 0],
        fov: 35,
        explode: 0,
        housingOpacity: 0.85,
        rfFieldIntensity: 0.6,
        phoneApproach: 1,
        dataStreamProgress: 0.45,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [-124, 24, 198],
        target: [0, -8, 0],
        fov: 38,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0.3,
        phoneApproach: 0.9,
        dataStreamProgress: 1,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [108, 22, 212],
        target: [0, -10, 0],
        fov: 36,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0.15,
        phoneApproach: 0.4,
        dataStreamProgress: 1,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
    ],
  },
  {
    id: 'scene-05-manufacturing',
    index: 5,
    title: 'SCENE 05 · MANUFACTURING PRECISION',
    angleLabel: 'Moulding, NFC Placement, Ultrasonic Seal & Laser QC',
    cameraPathDescription:
      'Tracking shot beside precision injection-moulding platens, 90° orbit around NFC coil placement, overhead assembly view, and optical laser inspection sweep.',
    soundDesignCue: 'Cleanroom robotics whine, ultrasonic weld resonance pulse, laser optical scan',
    startSec: 57,
    endSec: 75,
    narration:
      'From material selection to precision moulding, NFC integration and final inspection, every stage is designed around consistency, quality and manufacturing precision.',
    highlightComponent: 'tamper_weld_pins',
    showCallouts: false,
    keyframes: [
      {
        cameraPos: [205, 30, 185],
        target: [0, -8, 0],
        fov: 35,
        explode: 0.55,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0.25,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [75, 118, 205],
        target: [0, -4, 0],
        fov: 36,
        explode: 0.28,
        housingOpacity: 1,
        rfFieldIntensity: 0.2,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0.65,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [-178, 28, 212],
        target: [0, -8, 0],
        fov: 34,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 1,
        outlineTraceProgress: 0.3,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
    ],
  },
  {
    id: 'scene-06-experience',
    index: 6,
    title: 'SCENE 06 · THE VCA EXPERIENCE',
    angleLabel: 'Smartphone Tap & Hero Orbital Showcase',
    cameraPathDescription:
      'Return to the completed monolithic slab as a smartphone taps the NFC label, triggers certification, and orbits smoothly.',
    soundDesignCue: 'Warm orchestral lift + positive NFC tap confirmation chime',
    startSec: 75,
    endSec: 85,
    narration:
      'One physical collectible. One connected identity. A new standard for how collectibles can be protected, authenticated and verified.',
    highlightComponent: null,
    showCallouts: false,
    keyframes: [
      {
        cameraPos: [-112, 26, 210],
        target: [0, -12, 0],
        fov: 34,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0.35,
        phoneApproach: 0.5,
        dataStreamProgress: 0.2,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [28, 28, 184],
        target: [0, -6, 0],
        fov: 32,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0.85,
        phoneApproach: 1,
        dataStreamProgress: 0.5,
        mfgStageProgress: 0,
        outlineTraceProgress: 0,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [132, 24, 212],
        target: [0, -12, 0],
        fov: 34,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0.4,
        phoneApproach: 0.35,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0.4,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
    ],
  },
  {
    id: 'scene-07-finale',
    index: 7,
    title: 'SCENE 07 · BRAND FINALE',
    angleLabel: 'Electric-Blue Perimeter Trace & Pullback',
    cameraPathDescription:
      'Suspended slab in darkness with an electric-blue light tracing the outer chamfered profile as the camera pulls smoothly back and fades to black.',
    soundDesignCue: 'Final resonant deep bass impact (01:25) and atmospheric tail to silence',
    startSec: 85,
    endSec: 90,
    narration: 'VCA. Trust what you collect.',
    highlightComponent: null,
    showCallouts: false,
    keyframes: [
      {
        cameraPos: [92, 14, 240],
        target: [0, -8, 0],
        fov: 34,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0.5,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [28, 12, 265],
        target: [0, -10, 0],
        fov: 35,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 1,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [0, 10, 285],
        target: [0, -10, 0],
        fov: 36,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 1,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
    ],
  },
];

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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

function sample3PointScalar(a: number, b: number, c: number, t: number): number {
  if (t <= 0.5) {
    return lerp(a, b, smoothstep(t * 2));
  }
  return lerp(b, c, smoothstep((t - 0.5) * 2));
}

export function evaluateExplainerFrame(
  rawTimeSec: number,
  scenes: ExplainerSegment[] = DEFAULT_EXPLAINER_SCENES
): ExplainerFrameState {
  const activeScenes = scenes.length > 0 ? scenes : DEFAULT_EXPLAINER_SCENES;
  const maxDuration = activeScenes[activeScenes.length - 1]?.endSec || EXPLAINER_DURATION_SEC;
  const timeSec = Math.max(0, Math.min(maxDuration, rawTimeSec));
  const progress = timeSec / maxDuration;

  let segmentIndex = activeScenes.length - 1;
  for (let i = 0; i < activeScenes.length; i++) {
    const seg = activeScenes[i];
    if (timeSec >= seg.startSec && timeSec < seg.endSec) {
      segmentIndex = i;
      break;
    }
  }

  const segment = activeScenes[segmentIndex];
  const span = Math.max(0.001, segment.endSec - segment.startSec);
  const rawLocalT = Math.max(0, Math.min(1, (timeSec - segment.startSec) / span));
  const bezierT = smoothstep(rawLocalT);

  const [k0, k1, k2] = segment.keyframes;
  const activeHalf = rawLocalT <= 0.5 ? (rawLocalT * 2 < 0.5 ? k0 : k1) : (rawLocalT - 0.5) * 2 < 0.5 ? k1 : k2;

  // Fade in during 0.0 -> 0.8s and fade to black during final 1.4s
  let fadeOpacity = 1;
  if (timeSec < 0.8) {
    fadeOpacity = smoothstep(timeSec / 0.8);
  } else if (timeSec > maxDuration - 1.4) {
    fadeOpacity = 1 - smoothstep((timeSec - (maxDuration - 1.4)) / 1.4);
  }

  return {
    timeSec,
    progress,
    segmentIndex,
    segment,
    segmentLocalT: rawLocalT,
    cameraPos: quadBezierVec3(k0.cameraPos, k1.cameraPos, k2.cameraPos, bezierT),
    target: quadBezierVec3(k0.target, k1.target, k2.target, bezierT),
    fov: sample3PointScalar(k0.fov, k1.fov, k2.fov, rawLocalT),
    explode: sample3PointScalar(k0.explode, k1.explode, k2.explode, rawLocalT),
    housingOpacity: sample3PointScalar(
      k0.housingOpacity,
      k1.housingOpacity,
      k2.housingOpacity,
      rawLocalT
    ),
    rfFieldIntensity: sample3PointScalar(
      k0.rfFieldIntensity,
      k1.rfFieldIntensity,
      k2.rfFieldIntensity,
      rawLocalT
    ),
    phoneApproach: sample3PointScalar(
      k0.phoneApproach,
      k1.phoneApproach,
      k2.phoneApproach,
      rawLocalT
    ),
    dataStreamProgress: sample3PointScalar(
      k0.dataStreamProgress,
      k1.dataStreamProgress,
      k2.dataStreamProgress,
      rawLocalT
    ),
    mfgStageProgress: sample3PointScalar(
      k0.mfgStageProgress,
      k1.mfgStageProgress,
      k2.mfgStageProgress,
      rawLocalT
    ),
    outlineTraceProgress: sample3PointScalar(
      k0.outlineTraceProgress,
      k1.outlineTraceProgress,
      k2.outlineTraceProgress,
      rawLocalT
    ),
    fadeOpacity,
    sectionEnabled: activeHalf.sectionEnabled,
    sectionOffsetMm: sample3PointScalar(
      k0.sectionOffsetMm,
      k1.sectionOffsetMm,
      k2.sectionOffsetMm,
      rawLocalT
    ),
    highlightComponent: segment.highlightComponent,
    showCallouts: segment.showCallouts,
    accentHex: segment.accentHex || '#38BDF8',
  };
}

export function formatTimecode(sec: number, maxSec = 3599): string {
  const clamped = Math.max(0, Math.min(maxSec, Math.floor(sec)));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
