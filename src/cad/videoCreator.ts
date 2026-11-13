import { EngineeringMetrics, calculateEngineeringMetrics } from './engineeringMath';
import { DEFAULT_SLAB_PARAMETERS, SlabComponentId, SlabParameters } from './types';

export type VideoFormatCategory =
  | 'pitch-deck'
  | 'presentation'
  | 'advertising'
  | 'blueprint-explainer';

export type StudioVoiceId = 'Charon' | 'Fenrir' | 'Puck' | 'Kore' | 'Zephyr';

export type VideoResolutionId = '480p' | '720p' | '1080p' | '2160p';

export type VideoVisualStyle = 'studio' | 'blueprint' | 'exploded-blueprint' | 'xray-nfc';

export type CameraShotStyle =
  | 'low-angle-hero'
  | 'orbital-crane'
  | 'exploded-stack-orbit'
  | 'top-macro-nfc'
  | 'cross-section-glide'
  | 'turntable-360'
  | 'chamfer-pullback';

export const STUDIO_VOICES: { id: StudioVoiceId; label: string; tone: string }[] = [
  { id: 'Charon', label: 'Charon · Deep Executive Male', tone: 'Deep, calm executive narrator' },
  { id: 'Fenrir', label: 'Fenrir · Authoritative Baritone', tone: 'Measured baritone engineering narrator' },
  { id: 'Puck', label: 'Puck · Modern Broadcast Male', tone: 'Crisp, articulate commercial narrator' },
  { id: 'Kore', label: 'Kore · Studio Technical Female', tone: 'Clear, confident studio presenter' },
  { id: 'Zephyr', label: 'Zephyr · Refined Editorial', tone: 'Warm, poised product keynote voice' },
];

export const VIDEO_RESOLUTIONS: Record<
  VideoResolutionId,
  { id: VideoResolutionId; label: string; width: number; height: number; bitrate: number }
> = {
  '480p': { id: '480p', label: 'Regular MP4 · 854×480', width: 854, height: 480, bitrate: 2_800_000 },
  '720p': { id: '720p', label: 'HD · 1280×720', width: 1280, height: 720, bitrate: 5_000_000 },
  '1080p': { id: '1080p', label: 'Full HD · 1920×1080', width: 1920, height: 1080, bitrate: 9_000_000 },
  '2160p': { id: '2160p', label: '4K UHD · 3840×2160', width: 3840, height: 2160, bitrate: 20_000_000 },
};

export interface VideoCategorySpec {
  id: VideoFormatCategory;
  label: string;
  shortLabel: string;
  defaultDurationSec: number;
  description: string;
  starterPrompt: string;
}

export const VIDEO_CATEGORIES: VideoCategorySpec[] = [
  {
    id: 'pitch-deck',
    label: 'Pitch Deck',
    shortLabel: 'Pitch Deck',
    defaultDurationSec: 42,
    description: 'Investor & partner narrative covering problem, hardware moat, NFC architecture, and scale.',
    starterPrompt:
      'Investor pitch deck video for VCA: open on why static collectibles fail collectors, transition into an exploded slab view indexing all 12 live hardware labels, showcase NTAG424 NFC access-key security with X-ray optics, and close on scalable certified trust.',
  },
  {
    id: 'presentation',
    label: 'Presentation Video',
    shortLabel: 'Presentation',
    defaultDurationSec: 40,
    description: 'Executive showcase with 360° turntable camera sweeps, cavity cutaways, and smartphone tap.',
    starterPrompt:
      'Executive VCA presentation video with sweeping low-angle hero push, 360-degree optical turntable orbit, exploded Z-axis assembly indexing live component labels, and smartphone NFC verification.',
  },
  {
    id: 'advertising',
    label: 'Advertising',
    shortLabel: 'Advertising',
    defaultDurationSec: 30,
    description: 'Sharp 30s commercial pacing with dramatic angles, macro NFC glow, and brand close.',
    starterPrompt:
      'High-impact 30-second VCA commercial advertisement: dramatic grazing rim light on the chamfered slab, snap into exploded blueprint view with live component labels, macro NFC tap confirmation, and Trust What You Collect finale.',
  },
  {
    id: 'blueprint-explainer',
    label: 'Prototype Blueprint Explainer',
    shortLabel: 'Blueprint Explainer',
    defaultDurationSec: 45,
    description: 'Technical CAD drafting walkthrough with exploded view, live #01–#12 labels, and tolerances.',
    starterPrompt:
      'Prototype blueprint explainer video for VCA engineering review: CAD blueprint mode, slow exploded slab orbital pass indexing all 12 live component labels with exact millimeter tolerances, X-axis cross-section slice, and 13.56 MHz NFC bay inspection.',
  },
];

export interface CreatedVideoKeyframe {
  cameraPos: [number, number, number];
  target: [number, number, number];
  fov: number;
  orbitSweepDeg: number;
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

export interface CreatedVideoScene {
  id: string;
  index: number;
  title: string;
  shotLabel: string;
  shotStyle: CameraShotStyle;
  cameraDescription: string;
  durationSec: number;
  startSec: number;
  endSec: number;
  narration: string;
  visualStyle: VideoVisualStyle;
  showLiveLabels: boolean;
  highlightComponent: SlabComponentId | null;
  hudHeadline: string;
  hudSubline: string;
  hudMetrics: string[];
  accentHex: string;
  keyframes: [CreatedVideoKeyframe, CreatedVideoKeyframe, CreatedVideoKeyframe];
}

export interface CreatedVideoPlan {
  id: string;
  title: string;
  category: VideoFormatCategory;
  prompt: string;
  creativeSummary: string;
  totalDurationSec: number;
  accentHex: string;
  generatedBy: 'gemini' | 'studio-director';
  scenes: CreatedVideoScene[];
}

export interface CreatedVideoFrameState {
  timeSec: number;
  totalDurationSec: number;
  progress: number;
  sceneIndex: number;
  segment: CreatedVideoScene;
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
  visualStyle: VideoVisualStyle;
  accentHex: string;
}

export interface RawLeaderPin {
  id: SlabComponentId;
  calloutNumber: number;
  shortName: string;
  material: string;
  px: number;
  py: number;
  visible: boolean;
}

export interface PositionedLeaderCallout extends RawLeaderPin {
  lx: number;
  ly: number;
  side: 'left' | 'right';
}

const VALID_COMPONENTS = new Set<SlabComponentId>([
  'front_housing',
  'rear_housing',
  'perimeter_bezel',
  'card_support_frame',
  'inner_sleeve',
  'trading_card',
  'cert_label',
  'hologram_qr_seal',
  'nfc_compartment',
  'nfc_chip',
  'nfc_antenna',
  'tamper_weld_pins',
]);

const VALID_VISUAL_STYLES = new Set<VideoVisualStyle>([
  'studio',
  'blueprint',
  'exploded-blueprint',
  'xray-nfc',
]);

const VALID_SHOT_STYLES = new Set<CameraShotStyle>([
  'low-angle-hero',
  'orbital-crane',
  'exploded-stack-orbit',
  'top-macro-nfc',
  'cross-section-glide',
  'turntable-360',
  'chamfer-pullback',
]);

function clamp(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeHex(hex: unknown, fallback = '#38BDF8'): string {
  if (typeof hex !== 'string') return fallback;
  const trimmed = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  return fallback;
}

function cleanEditorialText(text: string): string {
  return text
    .replace(/\s*\/\/\s*/g, ' · ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateCreateVideoPrompt(prompt: string): {
  ok: boolean;
  cleaned: string;
  error?: string;
} {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return {
      ok: false,
      cleaned: '',
      error: 'Describe the VCA video you want to create (pitch deck, presentation, ad, or blueprint explainer).',
    };
  }
  if (cleaned.length < 5) {
    return {
      ok: false,
      cleaned,
      error: 'Enter at least a short phrase describing the presentation shots or message.',
    };
  }
  return { ok: true, cleaned: cleaned.slice(0, 900) };
}

export function detectVideoCategory(
  prompt: string,
  explicitCategory?: VideoFormatCategory
): VideoFormatCategory {
  if (explicitCategory) return explicitCategory;
  const lower = prompt.toLowerCase();
  if (/\b(?:pitch|investor|deck|seed|series|tam|market|funding|scale|moat)\b/.test(lower)) {
    return 'pitch-deck';
  }
  if (/\b(?:ad|ads|advert|advertising|commercial|promo|spot|launch|campaign|hook)\b/.test(lower)) {
    return 'advertising';
  }
  if (/\b(?:blueprint|prototype|explainer|cad|tolerance|cross-section|index|label|schematic|exploded)\b/.test(lower)) {
    return 'blueprint-explainer';
  }
  return 'presentation';
}

export function clampCameraPos(
  raw: unknown,
  fallback: [number, number, number]
): [number, number, number] {
  if (!Array.isArray(raw) || raw.length < 3) return fallback;
  let x = clamp(raw[0], -300, 300, fallback[0]);
  const y = clamp(raw[1], -48, 220, fallback[1]);
  let z = clamp(raw[2], -300, 340, fallback[2]);

  // Keep camera strictly outside the slab assembly envelope so it never clips geometry
  const horiz = Math.hypot(x, z);
  if (horiz < 84 && Math.abs(y) < 92) {
    const angle = horiz > 0.01 ? Math.atan2(z, x) : 0;
    x = Math.cos(angle) * 102;
    z = Math.sin(angle) * 102;
  }
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(z * 10) / 10];
}

export function clampCameraTarget(
  raw: unknown,
  fallback: [number, number, number]
): [number, number, number] {
  if (!Array.isArray(raw) || raw.length < 3) return fallback;
  return [
    Math.round(clamp(raw[0], -58, 58, fallback[0]) * 10) / 10,
    Math.round(clamp(raw[1], -52, 62, fallback[1]) * 10) / 10,
    Math.round(clamp(raw[2], -38, 38, fallback[2]) * 10) / 10,
  ];
}

function normalizeKeyframe(
  raw: Partial<CreatedVideoKeyframe> | undefined,
  fallback: CreatedVideoKeyframe
): CreatedVideoKeyframe {
  return {
    cameraPos: clampCameraPos(raw?.cameraPos, fallback.cameraPos),
    target: clampCameraTarget(raw?.target, fallback.target),
    fov: Math.round(clamp(raw?.fov, 22, 50, fallback.fov)),
    orbitSweepDeg: Number(clamp(raw?.orbitSweepDeg, -360, 360, fallback.orbitSweepDeg).toFixed(1)),
    explode: Number(clamp(raw?.explode, 0, 1, fallback.explode).toFixed(2)),
    housingOpacity: Number(clamp(raw?.housingOpacity, 0.16, 1, fallback.housingOpacity).toFixed(2)),
    rfFieldIntensity: Number(clamp(raw?.rfFieldIntensity, 0, 1, fallback.rfFieldIntensity).toFixed(2)),
    phoneApproach: Number(clamp(raw?.phoneApproach, 0, 1, fallback.phoneApproach).toFixed(2)),
    dataStreamProgress: Number(clamp(raw?.dataStreamProgress, 0, 1, fallback.dataStreamProgress).toFixed(2)),
    mfgStageProgress: Number(clamp(raw?.mfgStageProgress, 0, 1, fallback.mfgStageProgress).toFixed(2)),
    outlineTraceProgress: Number(
      clamp(raw?.outlineTraceProgress, 0, 1, fallback.outlineTraceProgress).toFixed(2)
    ),
    sectionEnabled:
      typeof raw?.sectionEnabled === 'boolean' ? raw.sectionEnabled : fallback.sectionEnabled,
    sectionOffsetMm: Number(
      clamp(raw?.sectionOffsetMm, -34, 34, fallback.sectionOffsetMm).toFixed(1)
    ),
  };
}

export function recalculateCreatedScenes(scenes: CreatedVideoScene[]): CreatedVideoScene[] {
  let cursor = 0;
  return scenes.map((sc, idx) => {
    const dur = Math.max(4, Math.min(28, Math.round(sc.durationSec)));
    const startSec = cursor;
    const endSec = cursor + dur;
    cursor = endSec;
    return {
      ...sc,
      index: idx + 1,
      durationSec: dur,
      startSec,
      endSec,
    };
  });
}

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

function rotatePointAroundTargetXZ(
  pos: [number, number, number],
  target: [number, number, number],
  deg: number
): [number, number, number] {
  if (Math.abs(deg) < 0.05) return pos;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = pos[0] - target[0];
  const dz = pos[2] - target[2];
  return [
    target[0] + dx * cos - dz * sin,
    pos[1],
    target[2] + dx * sin + dz * cos,
  ];
}

export function evaluateCreatedVideoFrame(
  rawTimeSec: number,
  scenes: CreatedVideoScene[]
): CreatedVideoFrameState {
  const fallbackList =
    scenes.length > 0
      ? scenes
      : buildFallbackCreatedVideo(
          'VCA presentation video',
          'presentation',
          DEFAULT_SLAB_PARAMETERS,
          calculateEngineeringMetrics(DEFAULT_SLAB_PARAMETERS)
        ).scenes;

  const totalDurationSec = fallbackList[fallbackList.length - 1]?.endSec || 36;
  const timeSec = Math.max(0, Math.min(totalDurationSec, rawTimeSec));
  const progress = totalDurationSec > 0 ? timeSec / totalDurationSec : 0;

  let segmentIndex = fallbackList.length - 1;
  for (let i = 0; i < fallbackList.length; i++) {
    const seg = fallbackList[i];
    if (timeSec >= seg.startSec && timeSec < seg.endSec) {
      segmentIndex = i;
      break;
    }
  }

  const segment = fallbackList[segmentIndex];
  const span = Math.max(0.001, segment.endSec - segment.startSec);
  const rawLocalT = Math.max(0, Math.min(1, (timeSec - segment.startSec) / span));
  const bezierT = smoothstep(rawLocalT);

  const [k0, k1, k2] = segment.keyframes;
  const activeHalf =
    rawLocalT <= 0.5 ? (rawLocalT * 2 < 0.5 ? k0 : k1) : (rawLocalT - 0.5) * 2 < 0.5 ? k1 : k2;

  const basePos = quadBezierVec3(k0.cameraPos, k1.cameraPos, k2.cameraPos, bezierT);
  const target = quadBezierVec3(k0.target, k1.target, k2.target, bezierT);
  const sweepDeg = sample3PointScalar(k0.orbitSweepDeg, k1.orbitSweepDeg, k2.orbitSweepDeg, rawLocalT);
  const cameraPos = rotatePointAroundTargetXZ(basePos, target, sweepDeg);
  const explode = sample3PointScalar(k0.explode, k1.explode, k2.explode, rawLocalT);

  // Fade in first 0.5s, subtle crossfade dip at boundaries, fade out final 0.8s
  let fadeOpacity = 1;
  if (timeSec < 0.5) {
    fadeOpacity = smoothstep(timeSec / 0.5);
  } else if (timeSec > totalDurationSec - 0.8) {
    fadeOpacity = 1 - smoothstep((timeSec - (totalDurationSec - 0.8)) / 0.8);
  }

  return {
    timeSec,
    totalDurationSec,
    progress,
    sceneIndex: segmentIndex,
    segment,
    segmentLocalT: rawLocalT,
    cameraPos,
    target,
    fov: sample3PointScalar(k0.fov, k1.fov, k2.fov, rawLocalT),
    explode,
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
    phoneApproach: sample3PointScalar(k0.phoneApproach, k1.phoneApproach, k2.phoneApproach, rawLocalT),
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
    showCallouts: segment.showLiveLabels || explode >= 0.3,
    visualStyle: segment.visualStyle,
    accentHex: segment.accentHex || '#38BDF8',
  };
}

/**
 * Staggers 3D-to-2D component callout badges into clean non-overlapping left/right leader shelves
 * so exploded slab indexing labels remain readable across every camera angle and resolution.
 */
export function layoutLeaderCallouts(
  pins: RawLeaderPin[],
  viewportWidth: number,
  viewportHeight: number
): PositionedLeaderCallout[] {
  const visiblePins = pins.filter((p) => p.visible);
  if (visiblePins.length === 0 || viewportWidth < 120 || viewportHeight < 100) {
    return [];
  }

  const centerX = viewportWidth / 2;
  const maxY = Math.min(viewportHeight - 96, viewportHeight * 0.84);

  const leftBucket: RawLeaderPin[] = [];
  const rightBucket: RawLeaderPin[] = [];

  for (const pin of visiblePins) {
    // Prefer alternating balance when pins sit near center X
    if (pin.px < centerX - 10) {
      leftBucket.push(pin);
    } else if (pin.px > centerX + 10) {
      rightBucket.push(pin);
    } else if (leftBucket.length <= rightBucket.length) {
      leftBucket.push(pin);
    } else {
      rightBucket.push(pin);
    }
  }

  const assignColumn = (bucket: RawLeaderPin[], side: 'left' | 'right'): PositionedLeaderCallout[] => {
    if (bucket.length === 0) return [];
    const sorted = [...bucket].sort((a, b) => a.py - b.py);
    const lx =
      side === 'left'
        ? Math.max(18, Math.min(viewportWidth * 0.16, 152))
        : Math.min(viewportWidth - 18, Math.max(viewportWidth * 0.84, viewportWidth - 152));

    const colMinY =
      side === 'left'
        ? Math.max(204, viewportHeight * 0.30)
        : Math.max(84, viewportHeight * 0.14);
    const spanY = Math.max(120, maxY - colMinY);
    const colGap = Math.max(20, Math.min(28, spanY / Math.max(1, bucket.length)));

    const ys: number[] = sorted.map((p) => Math.max(colMinY, Math.min(maxY, p.py)));
    // Forward pass: push overlapping entries down
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] - ys[i - 1] < colGap) {
        ys[i] = ys[i - 1] + colGap;
      }
    }
    // Backward pass: clamp bottom and push upward cleanly
    if (ys[ys.length - 1] > maxY) {
      ys[ys.length - 1] = maxY;
      for (let i = ys.length - 2; i >= 0; i--) {
        if (ys[i + 1] - ys[i] < colGap) {
          ys[i] = ys[i + 1] - colGap;
        }
      }
    }

    return sorted.map((p, idx) => ({
      ...p,
      lx: Math.round(lx),
      ly: Math.round(Math.max(colMinY, Math.min(maxY, ys[idx]))),
      side,
    }));
  };

  return [...assignColumn(leftBucket, 'left'), ...assignColumn(rightBucket, 'right')].sort(
    (a, b) => a.calloutNumber - b.calloutNumber
  );
}

export interface RawCreatedSceneInput {
  title?: string;
  shotLabel?: string;
  shotStyle?: string;
  cameraDescription?: string;
  durationSec?: number;
  narration?: string;
  visualStyle?: string;
  showLiveLabels?: boolean;
  highlightComponent?: string | null;
  hudHeadline?: string;
  hudSubline?: string;
  hudMetrics?: string[];
  accentHex?: string;
  keyframes?: Partial<CreatedVideoKeyframe>[];
}

export interface RawCreatedVideoInput {
  title?: string;
  creativeSummary?: string;
  accentHex?: string;
  scenes?: RawCreatedSceneInput[];
}

export function normalizeCreatedVideoPlan(
  raw: RawCreatedVideoInput,
  prompt: string,
  category: VideoFormatCategory,
  params: SlabParameters,
  metrics: EngineeringMetrics,
  generatedBy: 'gemini' | 'studio-director'
): CreatedVideoPlan {
  const fallback = buildFallbackCreatedVideo(prompt, category, params, metrics);
  const accentHex = sanitizeHex(raw.accentHex, fallback.accentHex);
  const rawScenes =
    Array.isArray(raw.scenes) && raw.scenes.length >= 2 ? raw.scenes.slice(0, 7) : null;

  if (!rawScenes) return fallback;

  const built: CreatedVideoScene[] = rawScenes.map((rs, idx) => {
    const fb = fallback.scenes[idx % fallback.scenes.length];
    const durationSec = Math.round(clamp(rs.durationSec, 5, 24, fb.durationSec));
    const rawKfs =
      Array.isArray(rs.keyframes) && rs.keyframes.length >= 3 ? rs.keyframes : fb.keyframes;
    const k0 = normalizeKeyframe(rawKfs[0], fb.keyframes[0]);
    const k1 = normalizeKeyframe(rawKfs[1], fb.keyframes[1]);
    const k2 = normalizeKeyframe(rawKfs[2], fb.keyframes[2]);
    const maxExplode = Math.max(k0.explode, k1.explode, k2.explode);

    const visualStyle = VALID_VISUAL_STYLES.has(rs.visualStyle as VideoVisualStyle)
      ? (rs.visualStyle as VideoVisualStyle)
      : fb.visualStyle;
    const shotStyle = VALID_SHOT_STYLES.has(rs.shotStyle as CameraShotStyle)
      ? (rs.shotStyle as CameraShotStyle)
      : fb.shotStyle;
    const compRaw = rs.highlightComponent as SlabComponentId | null | undefined;
    const highlightComponent =
      compRaw && VALID_COMPONENTS.has(compRaw)
        ? compRaw
        : compRaw === null
          ? null
          : fb.highlightComponent;

    const cleanMetrics = Array.isArray(rs.hudMetrics)
      ? rs.hudMetrics
          .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
          .map((m) => cleanEditorialText(m).slice(0, 56))
          .slice(0, 3)
      : fb.hudMetrics;

    const rawTitle =
      typeof rs.title === 'string' && rs.title.trim() ? cleanEditorialText(rs.title) : fb.title;
    const normalizedTitle = rawTitle.startsWith('0')
      ? rawTitle
      : `0${idx + 1} · ${rawTitle.replace(/^SCENE\s*\d+\s*·?\s*/i, '')}`;

    return {
      id: `vca-scene-${idx + 1}`,
      index: idx + 1,
      title: normalizedTitle.slice(0, 64),
      shotLabel:
        typeof rs.shotLabel === 'string' && rs.shotLabel.trim()
          ? cleanEditorialText(rs.shotLabel).slice(0, 68)
          : fb.shotLabel,
      shotStyle,
      cameraDescription:
        typeof rs.cameraDescription === 'string' && rs.cameraDescription.trim()
          ? rs.cameraDescription.trim().slice(0, 220)
          : fb.cameraDescription,
      durationSec,
      startSec: 0,
      endSec: durationSec,
      narration:
        typeof rs.narration === 'string' && rs.narration.trim()
          ? rs.narration.trim().slice(0, 420)
          : fb.narration,
      visualStyle,
      showLiveLabels:
        typeof rs.showLiveLabels === 'boolean'
          ? rs.showLiveLabels || maxExplode >= 0.35
          : fb.showLiveLabels || maxExplode >= 0.35,
      highlightComponent,
      hudHeadline:
        typeof rs.hudHeadline === 'string' && rs.hudHeadline.trim()
          ? cleanEditorialText(rs.hudHeadline).slice(0, 52)
          : fb.hudHeadline,
      hudSubline:
        typeof rs.hudSubline === 'string' && rs.hudSubline.trim()
          ? cleanEditorialText(rs.hudSubline).slice(0, 72)
          : fb.hudSubline,
      hudMetrics: cleanMetrics,
      accentHex: sanitizeHex(rs.accentHex, accentHex),
      keyframes: [k0, k1, k2],
    };
  });

  const scenes = recalculateCreatedScenes(built);
  const totalDurationSec = scenes[scenes.length - 1]?.endSec || 36;

  return {
    id: `vca-vid-${Date.now()}`,
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? cleanEditorialText(raw.title).slice(0, 76)
        : fallback.title,
    category,
    prompt,
    creativeSummary:
      typeof raw.creativeSummary === 'string' && raw.creativeSummary.trim()
        ? raw.creativeSummary.trim().slice(0, 200)
        : fallback.creativeSummary,
    totalDurationSec,
    accentHex,
    generatedBy,
    scenes,
  };
}

export function buildFallbackCreatedVideo(
  prompt: string,
  explicitCategory: VideoFormatCategory,
  params: SlabParameters,
  metrics: EngineeringMetrics
): CreatedVideoPlan {
  const category = detectVideoCategory(prompt, explicitCategory);
  const lower = prompt.toLowerCase();

  let accentHex = '#38BDF8';
  if (/(emerald|green|verified|trust)/.test(lower)) accentHex = '#34D399';
  else if (/(gold|amber|luxury|trophy)/.test(lower)) accentHex = '#F59E0B';

  const durMatch = lower.match(/\b(20|25|30|35|40|45|50|60|75)\s*(?:s|sec|secs|second|seconds)\b/);
  const catMeta = VIDEO_CATEGORIES.find((c) => c.id === category) || VIDEO_CATEGORIES[1];
  const targetTotalSec = durMatch ? Number(durMatch[1]) : catMeta.defaultDurationSec;

  const isBlueprintCat = category === 'blueprint-explainer' || /(blueprint|schematic|cad)/.test(lower);
  const isPitchCat = category === 'pitch-deck';
  const isAdCat = category === 'advertising';

  const makeScenes = (): Omit<CreatedVideoScene, 'startSec' | 'endSec'>[] => {
    if (isBlueprintCat) {
      return [
        {
          id: 'vca-scene-1',
          index: 1,
          title: '01 · Prototype CAD Envelope',
          shotLabel: 'Low-Angle Crane Push · Blueprint Grid',
          shotStyle: 'low-angle-hero',
          cameraDescription:
            'Low-angle push onto the chamfered polycarbonate profile rendered in technical blueprint wireframe.',
          durationSec: 10,
          narration: `Prototype ${params.serialNumber} establishes a rigid ${params.overallWidthMm.toFixed(1)} by ${params.overallHeightMm.toFixed(1)} millimeter optical enclosure designed to protect standard collectibles with repeatable industrial tolerances.`,
          visualStyle: 'blueprint',
          showLiveLabels: false,
          highlightComponent: null,
          hudHeadline: `CAD BLUEPRINT · ${params.serialNumber}`,
          hudSubline: 'OPTICAL POLYCARBONATE MONOLITH',
          hudMetrics: [
            `EXTERIOR: ${params.overallWidthMm.toFixed(1)} × ${params.overallHeightMm.toFixed(1)} × ${params.overallThicknessMm.toFixed(1)} mm`,
            `WALL THICKNESS: ${params.wallThicknessMm.toFixed(2)} mm · DRAFT ${params.draftAngleDeg.toFixed(1)}°`,
            `MASS ESTIMATE: ${metrics.estimatedTotalMassG} g`,
          ],
          accentHex,
          keyframes: [
            {
              cameraPos: [174, -18, 245],
              target: [0, -4, 0],
              fov: 34,
              orbitSweepDeg: 0,
              explode: 0,
              housingOpacity: 0.72,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0.85,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [106, 18, 212],
              target: [0, 0, 0],
              fov: 32,
              orbitSweepDeg: -14,
              explode: 0,
              housingOpacity: 0.68,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 1,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [-110, 26, 205],
              target: [0, 0, 0],
              fov: 33,
              orbitSweepDeg: -22,
              explode: 0.18,
              housingOpacity: 0.65,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0.5,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
          ],
        },
        {
          id: 'vca-scene-2',
          index: 2,
          title: '02 · Exploded Slab View & Live Labels',
          shotLabel: 'Three-Quarter Z-Axis Explode · #01–#12 Indexed',
          shotStyle: 'exploded-stack-orbit',
          cameraDescription:
            'Deliberate 3/4 orbital sweep around the fully exploded 12-layer assembly while live indexing labels lock onto every component.',
          durationSec: 15,
          narration: `In the exploded assembly view, twelve live-indexed subsystems separate cleanly along the Z-axis: optical shells, graphite collar, archival inner sleeve, zero-pinch card cradle, and tamper-evident shear pins.`,
          visualStyle: 'exploded-blueprint',
          showLiveLabels: true,
          highlightComponent: 'card_support_frame',
          hudHeadline: '12-LAYER EXPLODED STACKUP',
          hudSubline: 'LIVE COMPONENT INDEXING ACTIVE (#01–#12)',
          hudMetrics: [
            `CARD CAVITY: ${metrics.internalCavityWidthMm} × ${metrics.internalCavityHeightMm} mm`,
            `Z-AXIS PLAY: ${params.cavityDepthAllowanceMm.toFixed(2)} mm`,
            `WELD DIRECTOR: ${params.weldRidgeWidthMm.toFixed(2)} mm`,
          ],
          accentHex,
          keyframes: [
            {
              cameraPos: [-138, 26, 198],
              target: [0, 0, 0],
              fov: 35,
              orbitSweepDeg: 0,
              explode: 0.45,
              housingOpacity: 0.66,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [176, 36, 192],
              target: [0, -2, 0],
              fov: 36,
              orbitSweepDeg: 18,
              explode: 1,
              housingOpacity: 0.66,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [216, 44, 178],
              target: [0, -2, 0],
              fov: 36,
              orbitSweepDeg: 34,
              explode: 1,
              housingOpacity: 0.68,
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
          id: 'vca-scene-3',
          index: 3,
          title: '03 · Cross-Section Cavity & Interlock Cut',
          shotLabel: 'Dynamic X-Axis Section Glide',
          shotStyle: 'cross-section-glide',
          cameraDescription:
            'Precision sagittal cut plane sweeps across the closed slab to inspect corner relief, tongue-and-groove sealing, and zero-pinch clearance.',
          durationSec: 10,
          narration: `Sweeping an active cross-section reveals ${params.cavityClearanceXYMm.toFixed(2)} millimeters of lateral cushion and a ${params.interlockTongueDepthMm.toFixed(2)} millimeter interlock tongue sealing the outer perimeter.`,
          visualStyle: 'blueprint',
          showLiveLabels: true,
          highlightComponent: 'tamper_weld_pins',
          hudHeadline: 'CROSS-SECTION CLEARANCE',
          hudSubline: 'TONGUE-AND-GROOVE TAMPER SEAL',
          hudMetrics: [
            `XY CLEARANCE: ±${params.cavityClearanceXYMm.toFixed(2)} mm`,
            `INTERLOCK DEPTH: ${params.interlockTongueDepthMm.toFixed(2)} mm`,
            `PROPOSED TOLERANCE: ±${params.assemblyToleranceMm.toFixed(2)} mm`,
          ],
          accentHex,
          keyframes: [
            {
              cameraPos: [118, 22, 146],
              target: [0, 0, 0],
              fov: 30,
              orbitSweepDeg: 0,
              explode: 0,
              housingOpacity: 0.9,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: true,
              sectionOffsetMm: 22,
            },
            {
              cameraPos: [88, 12, 126],
              target: [0, -4, 0],
              fov: 28,
              orbitSweepDeg: -10,
              explode: 0,
              housingOpacity: 0.92,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: true,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [-96, 18, 138],
              target: [0, -4, 0],
              fov: 30,
              orbitSweepDeg: -18,
              explode: 0,
              housingOpacity: 0.92,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: true,
              sectionOffsetMm: -16,
            },
          ],
        },
        {
          id: 'vca-scene-4',
          index: 4,
          title: '04 · Embedded NFC Key & Smartphone Verify',
          shotLabel: 'Macro Top-Right Dive · X-Ray NFC Bay',
          shotStyle: 'top-macro-nfc',
          cameraDescription:
            'Steep macro angle over the upper-right bay as the optical shell goes translucent to reveal the tuned copper spiral and tap handshake.',
          durationSec: 10,
          narration: `Seated inside the isolated upper bay, the ${params.antennaTurns}-turn copper spiral and ${params.nfcChipConfig === 'ntag424_dna' ? 'NTAG424 DNA' : 'NTAG215'} transponder act strictly as a cryptographic access key linking straight to the digital record.`,
          visualStyle: 'xray-nfc',
          showLiveLabels: true,
          highlightComponent: 'nfc_antenna',
          hudHeadline: 'NFC ACCESS HARDWARE',
          hudSubline: '13.56 MHz INDUCTIVE ACCESS KEY ONLY',
          hudMetrics: [
            `COIL INDUCTANCE: ${metrics.estimatedInductanceUh} µH`,
            `TUNING CAPACITANCE: ${metrics.requiredTuningCapacitancePf} pF`,
            `EST. CLOSED READ: ~${metrics.estimatedReadRangeMm} mm`,
          ],
          accentHex,
          keyframes: [
            {
              cameraPos: [84, 52, 138],
              target: [18, 36, 0],
              fov: 28,
              orbitSweepDeg: 0,
              explode: 0.12,
              housingOpacity: 0.28,
              rfFieldIntensity: 0.85,
              phoneApproach: 0.15,
              dataStreamProgress: 0.1,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [42, 42, 128],
              target: [18, 34, 0],
              fov: 28,
              orbitSweepDeg: -18,
              explode: 0,
              housingOpacity: 0.24,
              rfFieldIntensity: 1,
              phoneApproach: 0.92,
              dataStreamProgress: 0.5,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [0, 14, 248],
              target: [0, -2, 0],
              fov: 34,
              orbitSweepDeg: 0,
              explode: 0,
              housingOpacity: 0.9,
              rfFieldIntensity: 0.2,
              phoneApproach: 0.2,
              dataStreamProgress: 0.85,
              mfgStageProgress: 0,
              outlineTraceProgress: 0.9,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
          ],
        },
      ];
    }

    if (isPitchCat) {
      return [
        {
          id: 'vca-scene-1',
          index: 1,
          title: '01 · Pitch Opening · Standard of Trust',
          shotLabel: 'Dramatic Low-Angle Studio Push',
          shotStyle: 'low-angle-hero',
          cameraDescription:
            'Sweep from obsidian darkness onto the chamfered VCA slab silhouette with electric-cyan perimeter tracing.',
          durationSec: 10,
          narration:
            'High-value collectibles trade in a multi-billion-dollar market still reliant on static plastic cases. Verified Card Authority re-engineers authentication directly into the hardware.',
          visualStyle: 'studio',
          showLiveLabels: false,
          highlightComponent: null,
          hudHeadline: 'VCA · VERIFIED CARD AUTHORITY',
          hudSubline: 'HARDWARE-ANCHORED AUTHENTICATION',
          hudMetrics: [
            `PROTOTYPE: ${params.serialNumber}`,
            'STANDARD: CRYPTOGRAPHIC ACCESS + TAMPER LOCK',
          ],
          accentHex,
          keyframes: [
            {
              cameraPos: [168, -22, 268],
              target: [0, -6, 0],
              fov: 34,
              orbitSweepDeg: 0,
              explode: 0,
              housingOpacity: 1,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0.7,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [38, 12, 228],
              target: [0, -4, 0],
              fov: 32,
              orbitSweepDeg: -12,
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
              cameraPos: [-112, 22, 214],
              target: [0, -4, 0],
              fov: 33,
              orbitSweepDeg: -20,
              explode: 0,
              housingOpacity: 1,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0.4,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
          ],
        },
        {
          id: 'vca-scene-2',
          index: 2,
          title: '02 · Exploded Architecture & Live Index',
          shotLabel: 'Exploded Stack Orbit · #01–#12 Live Labels',
          shotStyle: 'exploded-stack-orbit',
          cameraDescription:
            'Ascending orbital crane around the exploded 12-layer slab showing every engineered barrier and ultrasonic weld lock.',
          durationSec: 12,
          narration: `Every slab combines twelve proprietary layers: optical polycarbonate shells, a zero-pinch retention cradle, archival inner sleeve, and permanent ultrasonic tamper pins.`,
          visualStyle: 'exploded-blueprint',
          showLiveLabels: true,
          highlightComponent: 'perimeter_bezel',
          hudHeadline: '12-LAYER PROPRIETARY MOAT',
          hudSubline: 'LIVE COMPONENT ARCHITECTURE',
          hudMetrics: [
            `ENVELOPE: ${params.overallWidthMm.toFixed(1)} × ${params.overallHeightMm.toFixed(1)} mm`,
            `ZERO-PINCH CAVITY: ${metrics.internalCavityWidthMm} × ${metrics.internalCavityHeightMm} mm`,
            `SEAL: 20 kHz ULTRASONIC ENERGY DIRECTOR`,
          ],
          accentHex,
          keyframes: [
            {
              cameraPos: [-110, 22, 198],
              target: [0, 0, 0],
              fov: 34,
              orbitSweepDeg: 0,
              explode: 0.3,
              housingOpacity: 0.72,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [168, 34, 194],
              target: [0, -2, 0],
              fov: 36,
              orbitSweepDeg: 22,
              explode: 1,
              housingOpacity: 0.68,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [204, 42, 184],
              target: [0, -2, 0],
              fov: 36,
              orbitSweepDeg: 38,
              explode: 1,
              housingOpacity: 0.7,
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
          id: 'vca-scene-3',
          index: 3,
          title: '03 · NFC Access Key & On-Chain Proof',
          shotLabel: 'X-Ray NFC Macro + Verification Stream',
          shotStyle: 'top-macro-nfc',
          cameraDescription:
            'X-ray fade onto the NTAG424 NFC bay paired with instant smartphone verification streaming to the off-chip ledger.',
          durationSec: 11,
          narration: `With ${params.nfcChipConfig === 'ntag424_dna' ? 'AES-128 rolling cryptography' : 'embedded NFC'} serving strictly as the access key, a single smartphone tap authenticates ownership history on-chain in milliseconds.`,
          visualStyle: 'xray-nfc',
          showLiveLabels: true,
          highlightComponent: 'nfc_chip',
          hudHeadline: 'DIGITAL PASSPORT VERIFICATION',
          hudSubline: 'NFC KEY -> ON-CHAIN PROVENANCE',
          hudMetrics: [
            `TRANSPONDER: ${params.nfcChipConfig === 'ntag424_dna' ? 'NTAG424 DNA' : 'NTAG215'}`,
            `READ RANGE: ~${metrics.estimatedReadRangeMm} mm`,
            'CERTIFICATE STORAGE: OFF-CHIP',
          ],
          accentHex,
          keyframes: [
            {
              cameraPos: [78, 48, 134],
              target: [18, 34, 0],
              fov: 29,
              orbitSweepDeg: 0,
              explode: 0.1,
              housingOpacity: 0.25,
              rfFieldIntensity: 0.9,
              phoneApproach: 0.25,
              dataStreamProgress: 0.35,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [32, 40, 146],
              target: [14, 24, 0],
              fov: 30,
              orbitSweepDeg: -16,
              explode: 0,
              housingOpacity: 0.3,
              rfFieldIntensity: 1,
              phoneApproach: 1,
              dataStreamProgress: 0.95,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [-88, 28, 192],
              target: [0, -4, 0],
              fov: 35,
              orbitSweepDeg: -24,
              explode: 0,
              housingOpacity: 1,
              rfFieldIntensity: 0.35,
              phoneApproach: 0.65,
              dataStreamProgress: 1,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
          ],
        },
        {
          id: 'vca-scene-4',
          index: 4,
          title: '04 · Cleanroom Scale & Closing Thesis',
          shotLabel: 'Turntable Sweep & Signature Pullback',
          shotStyle: 'chamfer-pullback',
          cameraDescription:
            'Cleanroom injection-moulding cycle resolves into a balanced frontal pullback on the finished VCA slab.',
          durationSec: 9,
          narration:
            'Engineered for high-yield injection moulding and automated NFC integration, Verified Card Authority sets the verifiable global standard. Trust what you collect.',
          visualStyle: 'studio',
          showLiveLabels: false,
          highlightComponent: null,
          hudHeadline: 'VCASLABS.COM',
          hudSubline: 'THE NEW STANDARD IN COLLECTIBLE TRUST',
          hudMetrics: [
            `SERIAL: ${params.serialNumber}`,
            'MANUFACTURER-READY SPECIFICATION',
          ],
          accentHex,
          keyframes: [
            {
              cameraPos: [165, 32, 188],
              target: [0, -4, 0],
              fov: 34,
              orbitSweepDeg: 0,
              explode: 0.2,
              housingOpacity: 1,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0.45,
              outlineTraceProgress: 0.3,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [44, 18, 224],
              target: [0, -4, 0],
              fov: 34,
              orbitSweepDeg: -45,
              explode: 0,
              housingOpacity: 1,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0.9,
              outlineTraceProgress: 0.85,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [0, 10, 268],
              target: [0, -4, 0],
              fov: 35,
              orbitSweepDeg: 0,
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
    }

    if (isAdCat) {
      return [
        {
          id: 'vca-scene-1',
          index: 1,
          title: '01 · Commercial Hook · Grazing Reveal',
          shotLabel: 'Fast Low-Angle Arc & Perimeter Beam',
          shotStyle: 'low-angle-hero',
          cameraDescription:
            'Razor-sharp grazing rim light slices across the chamfered shoulders with tight push-in energy.',
          durationSec: 8,
          narration:
            'Your rarest collectibles deserve hardware that proves they are real.',
          visualStyle: 'studio',
          showLiveLabels: false,
          highlightComponent: null,
          hudHeadline: 'PROTECT · AUTHENTICATE · VERIFY',
          hudSubline: `VCA NEXT-GEN SLAB · ${params.serialNumber}`,
          hudMetrics: ['CHAMFERED OPTICAL POLYCARBONATE'],
          accentHex,
          keyframes: [
            {
              cameraPos: [148, -16, 228],
              target: [0, -2, 0],
              fov: 32,
              orbitSweepDeg: 0,
              explode: 0,
              housingOpacity: 1,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0.9,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [20, 12, 182],
              target: [0, 0, 0],
              fov: 29,
              orbitSweepDeg: -18,
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
              cameraPos: [-102, 22, 174],
              target: [0, 0, 0],
              fov: 32,
              orbitSweepDeg: -34,
              explode: 0.25,
              housingOpacity: 0.9,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0.5,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
          ],
        },
        {
          id: 'vca-scene-2',
          index: 2,
          title: '02 · Exploded Hardware Showcase',
          shotLabel: 'Dynamic Exploded Orbit · Live Indexed',
          shotStyle: 'exploded-stack-orbit',
          cameraDescription:
            'Punchy exploded slab reveal orbiting cleanly past the 12 internal components with live labels.',
          durationSec: 12,
          narration:
            'Twelve precision-moulded layers lock together with ultrasonic tamper protection and an embedded cryptographic NFC core.',
          visualStyle: 'exploded-blueprint',
          showLiveLabels: true,
          highlightComponent: 'nfc_antenna',
          hudHeadline: '12 LAYERS · ZERO COMPROMISE',
          hudSubline: 'LIVE EXPLODED HARDWARE INDEX',
          hudMetrics: [
            `OPTICAL GUARD: ${params.wallThicknessMm.toFixed(2)} mm`,
            `TAMPER LOCK: ULTRASONIC WELD PINS`,
          ],
          accentHex,
          keyframes: [
            {
              cameraPos: [-122, 22, 184],
              target: [0, 0, 0],
              fov: 34,
              orbitSweepDeg: 0,
              explode: 0.65,
              housingOpacity: 0.66,
              rfFieldIntensity: 0,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [170, 32, 178],
              target: [0, 0, 0],
              fov: 35,
              orbitSweepDeg: 28,
              explode: 1,
              housingOpacity: 0.68,
              rfFieldIntensity: 0.3,
              phoneApproach: 0,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [110, 40, 146],
              target: [14, 24, 0],
              fov: 31,
              orbitSweepDeg: 40,
              explode: 0.35,
              housingOpacity: 0.34,
              rfFieldIntensity: 0.9,
              phoneApproach: 0.25,
              dataStreamProgress: 0,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
          ],
        },
        {
          id: 'vca-scene-3',
          index: 3,
          title: '03 · Instant Tap & Signature Close',
          shotLabel: 'NFC Macro Tap into Symmetrical Hero',
          shotStyle: 'chamfer-pullback',
          cameraDescription:
            'Smartphone taps the illuminated NFC bay and pulls straight back to the iconic VCA centerpiece.',
          durationSec: 10,
          narration:
            'One tap verifies authenticity anywhere on earth. VCA — Verified Card Authority.',
          visualStyle: 'xray-nfc',
          showLiveLabels: false,
          highlightComponent: null,
          hudHeadline: 'VCA AUTHENTICATED',
          hudSubline: 'VCASLABS.COM · TRUST WHAT YOU COLLECT',
          hudMetrics: [
            `SERIAL: ${params.serialNumber}`,
            'INSTANT NFC DIGITAL PASSPORT',
          ],
          accentHex,
          keyframes: [
            {
              cameraPos: [44, 38, 128],
              target: [18, 30, 0],
              fov: 29,
              orbitSweepDeg: 0,
              explode: 0,
              housingOpacity: 0.35,
              rfFieldIntensity: 1,
              phoneApproach: 0.95,
              dataStreamProgress: 0.7,
              mfgStageProgress: 0,
              outlineTraceProgress: 0,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [18, 16, 212],
              target: [0, -2, 0],
              fov: 33,
              orbitSweepDeg: 0,
              explode: 0,
              housingOpacity: 1,
              rfFieldIntensity: 0.2,
              phoneApproach: 0.25,
              dataStreamProgress: 0.4,
              mfgStageProgress: 0,
              outlineTraceProgress: 0.9,
              sectionEnabled: false,
              sectionOffsetMm: 0,
            },
            {
              cameraPos: [0, 10, 260],
              target: [0, -4, 0],
              fov: 34,
              orbitSweepDeg: 0,
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
    }

    // Default: Presentation Video (balanced executive presentation + 360 turntable + live exploded view)
    return [
      {
        id: 'vca-scene-1',
        index: 1,
        title: '01 · Optical Silhouette & 360° Turntable',
        shotLabel: 'Smooth 360° Orbital Showcase',
        shotStyle: 'turntable-360',
        cameraDescription:
          'Graceful 360-degree studio orbit showcasing chamfered optical polycarbonate clarity and serialized badge.',
        durationSec: 12,
        narration: `Meet prototype ${params.serialNumber} from Verified Card Authority — a precision optical polymer enclosure sculpted for zero-distortion display and uncompromising physical defense.`,
        visualStyle: 'studio',
        showLiveLabels: false,
        highlightComponent: null,
        hudHeadline: 'VCA CERTIFIED SLAB',
        hudSubline: `PROTOTYPE ${params.serialNumber} · ${params.overallWidthMm.toFixed(1)} × ${params.overallHeightMm.toFixed(1)} mm`,
        hudMetrics: [
          `THICKNESS: ${params.overallThicknessMm.toFixed(1)} mm`,
          `CARD WINDOW: 63.5 × 88.9 mm`,
        ],
        accentHex,
        keyframes: [
          {
            cameraPos: [0, 18, 250],
            target: [0, -2, 0],
            fov: 33,
            orbitSweepDeg: 0,
            explode: 0,
            housingOpacity: 1,
            rfFieldIntensity: 0,
            phoneApproach: 0,
            dataStreamProgress: 0,
            mfgStageProgress: 0,
            outlineTraceProgress: 0.75,
            sectionEnabled: false,
            sectionOffsetMm: 0,
          },
          {
            cameraPos: [0, 22, 236],
            target: [0, -2, 0],
            fov: 33,
            orbitSweepDeg: 180,
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
            cameraPos: [0, 18, 246],
            target: [0, -2, 0],
            fov: 33,
            orbitSweepDeg: 350,
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
        ],
      },
      {
        id: 'vca-scene-2',
        index: 2,
        title: '02 · Exploded Assembly Indexing Live Labels',
        shotLabel: 'Three-Quarter Z-Axis Separation · #01–#12',
        shotStyle: 'exploded-stack-orbit',
        cameraDescription:
          'Smooth 3/4 crane orbit while all twelve engineered layers separate along the Z-axis with live component indexing.',
        durationSec: 15,
        narration: `Every component aligns inside a twelve-layer stackup. Live engineering callouts track the graphite frame, archival inner sleeve, recessed certification plate, and four tamper-evident shear pins.`,
        visualStyle: 'exploded-blueprint',
        showLiveLabels: true,
        highlightComponent: 'card_support_frame',
        hudHeadline: 'EXPLODED COMPONENT INDEX',
        hudSubline: '12 ENGINEERED PARTS · LIVE 3D CALLOUTS',
        hudMetrics: [
          `CAVITY: ${metrics.internalCavityWidthMm} × ${metrics.internalCavityHeightMm} mm`,
          `TOLERANCE: ±${params.assemblyToleranceMm.toFixed(2)} mm`,
          `SHELL WALL: ${params.wallThicknessMm.toFixed(2)} mm`,
        ],
        accentHex,
        keyframes: [
          {
            cameraPos: [-118, 24, 198],
            target: [0, 0, 0],
            fov: 34,
            orbitSweepDeg: 0,
            explode: 0.35,
            housingOpacity: 0.72,
            rfFieldIntensity: 0,
            phoneApproach: 0,
            dataStreamProgress: 0,
            mfgStageProgress: 0,
            outlineTraceProgress: 0,
            sectionEnabled: false,
            sectionOffsetMm: 0,
          },
          {
            cameraPos: [176, 36, 188],
            target: [0, -2, 0],
            fov: 36,
            orbitSweepDeg: 20,
            explode: 1,
            housingOpacity: 0.66,
            rfFieldIntensity: 0,
            phoneApproach: 0,
            dataStreamProgress: 0,
            mfgStageProgress: 0,
            outlineTraceProgress: 0,
            sectionEnabled: false,
            sectionOffsetMm: 0,
          },
          {
            cameraPos: [208, 42, 180],
            target: [0, -2, 0],
            fov: 36,
            orbitSweepDeg: 36,
            explode: 1,
            housingOpacity: 0.7,
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
        id: 'vca-scene-3',
        index: 3,
        title: '03 · NFC Hardware Bridge & Verification',
        shotLabel: 'X-Ray Shell Fade & Tap Close-Up',
        shotStyle: 'top-macro-nfc',
        cameraDescription:
          'X-ray transparency exposes the 13.56 MHz copper spiral coil while a smartphone taps to confirm the digital certificate.',
        durationSec: 13,
        narration: `Tuned to ${metrics.estimatedInductanceUh} microhenries at 13.56 megahertz, the embedded NFC module acts exclusively as a physical access key connecting each slab to its verified digital record. VCA — Verified Card Authority.`,
        visualStyle: 'xray-nfc',
        showLiveLabels: true,
        highlightComponent: 'nfc_antenna',
        hudHeadline: 'VERIFIED PHYSICAL-DIGITAL LINK',
        hudSubline: '13.56 MHz NFC KEY -> OFF-CHIP PASSPORT',
        hudMetrics: [
          `COIL: ${params.antennaTurns} TURNS · ~${metrics.estimatedReadRangeMm} mm READ`,
          `SERIAL: ${params.serialNumber}`,
        ],
        accentHex,
        keyframes: [
          {
            cameraPos: [76, 48, 134],
            target: [18, 34, 0],
            fov: 29,
            orbitSweepDeg: 0,
            explode: 0.15,
            housingOpacity: 0.25,
            rfFieldIntensity: 0.9,
            phoneApproach: 0.2,
            dataStreamProgress: 0.25,
            mfgStageProgress: 0,
            outlineTraceProgress: 0,
            sectionEnabled: false,
            sectionOffsetMm: 0,
          },
          {
            cameraPos: [38, 42, 136],
            target: [16, 26, 0],
            fov: 30,
            orbitSweepDeg: -16,
            explode: 0,
            housingOpacity: 0.28,
            rfFieldIntensity: 1,
            phoneApproach: 1,
            dataStreamProgress: 0.9,
            mfgStageProgress: 0,
            outlineTraceProgress: 0,
            sectionEnabled: false,
            sectionOffsetMm: 0,
          },
          {
            cameraPos: [0, 12, 258],
            target: [0, -4, 0],
            fov: 34,
            orbitSweepDeg: 0,
            explode: 0,
            housingOpacity: 1,
            rfFieldIntensity: 0.15,
            phoneApproach: 0.2,
            dataStreamProgress: 0.5,
            mfgStageProgress: 0,
            outlineTraceProgress: 1,
            sectionEnabled: false,
            sectionOffsetMm: 0,
          },
        ],
      },
    ];
  };

  const rawScenes = makeScenes();
  const baseTotal = rawScenes.reduce((sum, s) => sum + s.durationSec, 0);
  const scaled = rawScenes.map((s, idx) => ({
    ...s,
    startSec: 0,
    endSec: 0,
    durationSec:
      idx === rawScenes.length - 1
        ? Math.max(6, targetTotalSec - rawScenes.slice(0, -1).reduce((acc, prev) => acc + Math.max(5, Math.round((prev.durationSec / baseTotal) * targetTotalSec)), 0))
        : Math.max(5, Math.round((s.durationSec / baseTotal) * targetTotalSec)),
  }));

  const scenes = recalculateCreatedScenes(scaled);
  const totalDurationSec = scenes[scenes.length - 1]?.endSec || targetTotalSec;

  return {
    id: `vca-vid-${category}`,
    title: `VCA ${catMeta.label}: ${params.serialNumber}`,
    category,
    prompt,
    creativeSummary: `${catMeta.label} presentation (${scenes.length} scenes · ${totalDurationSec}s) with multi-angle 3D CAD cinematography, exploded view live indexing labels, and voiceover-only audio.`,
    totalDurationSec,
    accentHex,
    generatedBy: 'studio-director',
    scenes,
  };
}

export function formatTimecode(sec: number): string {
  const clamped = Math.max(0, Math.floor(sec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
