import { EngineeringMetrics } from './engineeringMath';
import {
  ExplainerKeyframe,
  ExplainerSegment,
  SceneSfxStyle,
} from './explainerTimeline';
import { SlabComponentId, SlabParameters } from './types';

export interface PresentationPlan {
  title: string;
  prompt: string;
  creativeDirection: string;
  totalDurationSec: number;
  accentHex: string;
  generatedBy: 'gemini' | 'studio-director';
  scenes: ExplainerSegment[];
}

export interface RawPresentationSceneInput {
  title?: string;
  angleLabel?: string;
  durationSec?: number;
  cameraPathDescription?: string;
  soundDesignCue?: string;
  narration?: string;
  highlightComponent?: string | null;
  showCallouts?: boolean;
  hudHeadline?: string;
  hudSubline?: string;
  hudMetrics?: string[];
  accentHex?: string;
  sfxStyle?: string;
  keyframes?: Partial<ExplainerKeyframe>[];
}

export interface RawPresentationPlanInput {
  title?: string;
  creativeDirection?: string;
  accentHex?: string;
  scenes?: RawPresentationSceneInput[];
}

export const PRESENTATION_PROMPT_PRESETS: { label: string; prompt: string }[] = [
  {
    label: 'NFC Macro & Tap',
    prompt:
      '35-second macro close-up orbiting the embedded NTAG424 NFC chip and copper coil with glowing cyan RF waves, X-ray housing transparency, and a smartphone tap verification.',
  },
  {
    label: '12-Layer Exploded Cutaway',
    prompt:
      '40-second high-detail exploded assembly showing all 12 protective slab layers separating along the Z-axis, card cavity tolerances, inner sleeve, and cross-section cutaway.',
  },
  {
    label: 'Blockchain & Security',
    prompt:
      '45-second cinematic showcase of ultrasonic tamper-weld security pins, live data stream constellation linking physical slab to blockchain digital passport, and bold hero finale.',
  },
  {
    label: 'Cleanroom Mfg & Laser QC',
    prompt:
      '35-second industrial look at precision injection-moulding platens, robotic NFC die placement, ultrasonic perimeter sealing, and laser optical quality inspection sweep.',
  },
];

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

const VALID_SFX_STYLES = new Set<SceneSfxStyle>([
  'impact',
  'mechanical',
  'nfc',
  'telemetry',
  'laser',
]);

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeHex(hex: unknown, fallback = '#38BDF8'): string {
  if (typeof hex !== 'string') return fallback;
  const trimmed = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  return fallback;
}

export function clampCameraPos(
  raw: unknown,
  fallback: [number, number, number]
): [number, number, number] {
  if (!Array.isArray(raw) || raw.length < 3) return fallback;
  let x = clampNum(raw[0], -280, 280, fallback[0]);
  const y = clampNum(raw[1], -48, 220, fallback[1]);
  let z = clampNum(raw[2], -280, 320, fallback[2]);

  // Keep camera cleanly outside the slab assembly radius so it never clips inside the polycarbonate shell
  const horizDist = Math.hypot(x, z);
  if (horizDist < 72 && Math.abs(y) < 88) {
    const angle = horizDist > 0.01 ? Math.atan2(z, x) : 0;
    x = Math.cos(angle) * 92;
    z = Math.sin(angle) * 92;
  }
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(z * 10) / 10];
}

export function clampCameraTarget(
  raw: unknown,
  fallback: [number, number, number]
): [number, number, number] {
  if (!Array.isArray(raw) || raw.length < 3) return fallback;
  return [
    Math.round(clampNum(raw[0], -60, 60, fallback[0]) * 10) / 10,
    Math.round(clampNum(raw[1], -55, 65, fallback[1]) * 10) / 10,
    Math.round(clampNum(raw[2], -40, 40, fallback[2]) * 10) / 10,
  ];
}

function normalizeKeyframe(
  raw: Partial<ExplainerKeyframe> | undefined,
  fallback: ExplainerKeyframe
): ExplainerKeyframe {
  return {
    cameraPos: clampCameraPos(raw?.cameraPos, fallback.cameraPos),
    target: clampCameraTarget(raw?.target, fallback.target),
    fov: Math.round(clampNum(raw?.fov, 22, 50, fallback.fov)),
    explode: Number(clampNum(raw?.explode, 0, 1, fallback.explode).toFixed(2)),
    housingOpacity: Number(clampNum(raw?.housingOpacity, 0.16, 1, fallback.housingOpacity).toFixed(2)),
    rfFieldIntensity: Number(clampNum(raw?.rfFieldIntensity, 0, 1, fallback.rfFieldIntensity).toFixed(2)),
    phoneApproach: Number(clampNum(raw?.phoneApproach, 0, 1, fallback.phoneApproach).toFixed(2)),
    dataStreamProgress: Number(clampNum(raw?.dataStreamProgress, 0, 1, fallback.dataStreamProgress).toFixed(2)),
    mfgStageProgress: Number(clampNum(raw?.mfgStageProgress, 0, 1, fallback.mfgStageProgress).toFixed(2)),
    outlineTraceProgress: Number(
      clampNum(raw?.outlineTraceProgress, 0, 1, fallback.outlineTraceProgress).toFixed(2)
    ),
    sectionEnabled:
      typeof raw?.sectionEnabled === 'boolean' ? raw.sectionEnabled : fallback.sectionEnabled,
    sectionOffsetMm: Number(
      clampNum(raw?.sectionOffsetMm, -34, 34, fallback.sectionOffsetMm).toFixed(1)
    ),
  };
}

function cleanDisplayCopy(text: string): string {
  return text
    .replace(/\s*\/\/\s*/g, ' · ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validatePresentationPrompt(prompt: string): { ok: boolean; cleaned: string; error?: string } {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return { ok: false, cleaned: '', error: 'Describe what you want to see in the presentation video.' };
  }
  if (cleaned.length < 4) {
    return {
      ok: false,
      cleaned,
      error: 'Enter at least a short phrase describing the camera angle, feature, or scene.',
    };
  }
  return { ok: true, cleaned: cleaned.slice(0, 600) };
}

export function normalizeGeneratedPresentation(
  raw: RawPresentationPlanInput,
  prompt: string,
  params: SlabParameters,
  metrics: EngineeringMetrics,
  generatedBy: 'gemini' | 'studio-director'
): PresentationPlan {
  const fallback = buildStudioPresentationFallback(prompt, params, metrics);
  const accentHex = sanitizeHex(raw.accentHex, fallback.accentHex);
  const rawScenes = Array.isArray(raw.scenes) && raw.scenes.length >= 2 ? raw.scenes.slice(0, 7) : null;

  if (!rawScenes) {
    return fallback;
  }

  let cursorSec = 0;
  const scenes: ExplainerSegment[] = rawScenes.map((rs, idx) => {
    const fb = fallback.scenes[idx % fallback.scenes.length];
    const duration = Math.round(clampNum(rs.durationSec, 5, 22, fb.endSec - fb.startSec));
    const startSec = cursorSec;
    const endSec = cursorSec + duration;
    cursorSec = endSec;

    const rawKfs = Array.isArray(rs.keyframes) && rs.keyframes.length >= 3 ? rs.keyframes : fb.keyframes;
    const k0 = normalizeKeyframe(rawKfs[0], fb.keyframes[0]);
    const k1 = normalizeKeyframe(rawKfs[1], fb.keyframes[1]);
    const k2 = normalizeKeyframe(rawKfs[2], fb.keyframes[2]);
    const maxExplode = Math.max(k0.explode, k1.explode, k2.explode);

    const compRaw = rs.highlightComponent as SlabComponentId | null | undefined;
    const highlightComponent =
      compRaw && VALID_COMPONENTS.has(compRaw) ? compRaw : compRaw === null ? null : fb.highlightComponent;

    const sfxRaw = rs.sfxStyle as SceneSfxStyle | undefined;
    const sfxStyle = sfxRaw && VALID_SFX_STYLES.has(sfxRaw) ? sfxRaw : fb.sfxStyle || 'impact';

    const cleanMetrics = Array.isArray(rs.hudMetrics)
      ? rs.hudMetrics
          .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
          .map((m) => cleanDisplayCopy(m).slice(0, 56))
          .slice(0, 3)
      : fb.hudMetrics;

    const rawTitle =
      typeof rs.title === 'string' && rs.title.trim() ? cleanDisplayCopy(rs.title) : fb.title;
    const normalizedTitle = rawTitle.startsWith('SCENE ')
      ? rawTitle
      : `SCENE 0${idx + 1} · ${rawTitle.toUpperCase()}`;

    const requestedCallouts =
      typeof rs.showCallouts === 'boolean' ? rs.showCallouts : Boolean(fb.showCallouts);

    return {
      id: `gen-scene-${idx + 1}`,
      index: idx + 1,
      title: normalizedTitle.slice(0, 64),
      angleLabel:
        typeof rs.angleLabel === 'string' && rs.angleLabel.trim()
          ? cleanDisplayCopy(rs.angleLabel).slice(0, 72)
          : fb.angleLabel,
      cameraPathDescription:
        typeof rs.cameraPathDescription === 'string' && rs.cameraPathDescription.trim()
          ? rs.cameraPathDescription.trim().slice(0, 220)
          : fb.cameraPathDescription,
      soundDesignCue:
        typeof rs.soundDesignCue === 'string' && rs.soundDesignCue.trim()
          ? rs.soundDesignCue.trim().slice(0, 140)
          : fb.soundDesignCue,
      startSec,
      endSec,
      narration:
        typeof rs.narration === 'string' && rs.narration.trim()
          ? rs.narration.trim().slice(0, 320)
          : fb.narration,
      highlightComponent,
      showCallouts: requestedCallouts && maxExplode >= 0.4,
      hudHeadline:
        typeof rs.hudHeadline === 'string' && rs.hudHeadline.trim()
          ? cleanDisplayCopy(rs.hudHeadline).slice(0, 48)
          : fb.hudHeadline,
      hudSubline:
        typeof rs.hudSubline === 'string' && rs.hudSubline.trim()
          ? cleanDisplayCopy(rs.hudSubline).slice(0, 72)
          : fb.hudSubline,
      hudMetrics: cleanMetrics,
      accentHex: sanitizeHex(rs.accentHex, accentHex),
      sfxStyle,
      keyframes: [k0, k1, k2],
    };
  });

  return {
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? cleanDisplayCopy(raw.title).slice(0, 72)
        : fallback.title,
    prompt,
    creativeDirection:
      typeof raw.creativeDirection === 'string' && raw.creativeDirection.trim()
        ? raw.creativeDirection.trim().slice(0, 180)
        : fallback.creativeDirection,
    totalDurationSec: cursorSec,
    accentHex,
    generatedBy,
    scenes,
  };
}

export function buildStudioPresentationFallback(
  prompt: string,
  params: SlabParameters,
  metrics: EngineeringMetrics
): PresentationPlan {
  const lower = prompt.toLowerCase();

  // Detect requested visual accent mood
  let accentHex = '#38BDF8';
  if (/(emerald|green|mint|verified|eco)/.test(lower)) accentHex = '#34D399';
  else if (/(gold|amber|warm|luxury|trophy)/.test(lower)) accentHex = '#F59E0B';
  else if (/(violet|purple|neon|cyber)/.test(lower)) accentHex = '#A855F7';

  // Detect requested duration target if user typed one (e.g. "30s", "45 seconds", "60 sec")
  const durMatch = lower.match(/\b(15|20|25|30|35|40|45|50|60|75|90)\s*(?:s|sec|secs|second|seconds)\b/);
  const targetSec = durMatch ? Number(durMatch[1]) : 40;

  // Detect domain topics to curate high-detail scenes tailored to the prompt
  const wantsNfc = /(nfc|chip|antenna|coil|rf|13\.56|ntag|tap|phone|scan)/.test(lower);
  const wantsExplode = /(explod|layer|internal|assembly|component|12|part|apart|inside)/.test(lower);
  const wantsSection = /(section|cutaway|cross|slice|cavity|sleeve|card|thickness|tolerance)/.test(lower);
  const wantsBlockchain = /(blockchain|nft|digital|passport|chain|identity|ledger|qr)/.test(lower);
  const wantsMfg = /(mfg|manufactur|mould|mold|ultrasonic|weld|laser|qc|cleanroom|robot)/.test(lower);

  interface SceneTemplate {
    slug: string;
    title: string;
    angleLabel: string;
    weight: number;
    cameraPathDescription: string;
    soundDesignCue: string;
    narration: string;
    highlightComponent: SlabComponentId | null;
    showCallouts: boolean;
    hudHeadline: string;
    hudSubline: string;
    hudMetrics: string[];
    sfxStyle: SceneSfxStyle;
    keyframes: [ExplainerKeyframe, ExplainerKeyframe, ExplainerKeyframe];
  }

  const templates: SceneTemplate[] = [];

  // Opening always anchors the product with the user's subject
  templates.push({
    slug: 'hero',
    title: 'DRAMATIC PRODUCT REVEAL',
    angleLabel: 'Volumetric Sweep & Orbital Push-In',
    weight: 1.0,
    cameraPathDescription:
      'Begin in obsidian studio lighting as a volumetric cyan beam sweeps across the chamfered polycarbonate profile while pushing toward the hero card face.',
    soundDesignCue: 'Deep sub-bass transient + harmonic synth swell',
    narration: `Engineered around ${params.overallWidthMm.toFixed(1)} by ${params.overallHeightMm.toFixed(1)} millimeters of optical-grade polymer, prototype ${params.serialNumber} introduces a new benchmark in collectible authentication.`,
    highlightComponent: null,
    showCallouts: false,
    hudHeadline: 'VCA · OPTICAL MONOLITH',
    hudSubline: `PROTOTYPE ${params.serialNumber} · ${params.polymerGrade.toUpperCase()}`,
    hudMetrics: [
      `ENVELOPE: ${params.overallWidthMm.toFixed(1)} × ${params.overallHeightMm.toFixed(1)} × ${params.overallThicknessMm.toFixed(1)} mm`,
      `CARD CAVITY: 63.5 × 88.9 mm`,
      `MASS: ${metrics.estimatedTotalMassG} g`,
    ],
    sfxStyle: 'impact',
    keyframes: [
      {
        cameraPos: [165, 18, 220],
        target: [0, -6, 0],
        fov: 34,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0.55,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [28, 12, 188],
        target: [0, -4, 0],
        fov: 30,
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
        cameraPos: [-110, 22, 182],
        target: [0, -6, 0],
        fov: 32,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0.3,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
    ],
  });

  if (wantsExplode || (!wantsNfc && !wantsSection && !wantsMfg && !wantsBlockchain)) {
    templates.push({
      slug: 'explode',
      title: '12-LAYER INTERNAL ARCHITECTURE',
      angleLabel: 'Z-Axis Explosion & Precision Callouts',
      weight: 1.25,
      cameraPathDescription:
        '45-degree ascending arc as all 12 engineered layers separate along the Z-axis, exposing the archival sleeve, card support frame, and ultrasonic weld perimeter.',
      soundDesignCue: 'Precision servo separation + crystalline optical shimmer',
      narration: `Twelve precision layers interlock around the ${params.cardThicknessMm.toFixed(2)} millimeter card cavity with proposed plus-or-minus ${params.assemblyToleranceMm.toFixed(2)} millimeter tolerances and ultrasonic tamper-evident weld pins.`,
      highlightComponent: 'perimeter_bezel',
      showCallouts: true,
      hudHeadline: '12-COMPONENT STACKUP',
      hudSubline: 'Z-AXIS EXPLODED ENGINEERING VIEW',
      hudMetrics: [
        `OPTICAL WALL: ${params.wallThicknessMm.toFixed(2)} mm`,
        `PROPOSED TOLERANCE: ±${params.assemblyToleranceMm.toFixed(2)} mm`,
        `CHAMFER BEVEL: ${params.shoulderChamferMm.toFixed(1)} mm`,
      ],
      sfxStyle: 'mechanical',
      keyframes: [
        {
          cameraPos: [-85, 18, 155],
          target: [0, -4, 0],
          fov: 32,
          explode: 0.15,
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
          cameraPos: [152, 34, 178],
          target: [0, -8, 0],
          fov: 35,
          explode: 0.92,
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
          cameraPos: [204, 42, 188],
          target: [0, -8, 0],
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
    });
  }

  if (wantsSection) {
    templates.push({
      slug: 'section',
      title: 'OPTICAL CAVITY CUTAWAY',
      angleLabel: 'Live Cross-Section Plane & Sleeve Fit',
      weight: 1.2,
      cameraPathDescription:
        'Dynamic X-axis cross-section slice sweeps across the closed slab, showing zero-pinch card clearance, archival sleeve seat, and interlock tongue depth.',
      soundDesignCue: 'Low laser slicing sweep + clean studio acoustic pulse',
      narration: `Inside the cutaway profile, a ${params.cavityClearanceXYMm.toFixed(2)} millimeter perimeter cushion and ${params.interlockTongueDepthMm.toFixed(2)} millimeter interlock tongue keep the collectible suspended without edge pressure.`,
      highlightComponent: 'card_support_frame',
      showCallouts: false,
      hudHeadline: 'CROSS-SECTION CLEARANCE',
      hudSubline: 'ZERO-PINCH CAVITY & TONGUE-AND-GROOVE LOCK',
      hudMetrics: [
        `CAVITY OPENING: ${metrics.internalCavityWidthMm} × ${metrics.internalCavityHeightMm} mm`,
        `XY CLEARANCE: ${params.cavityClearanceXYMm.toFixed(2)} mm`,
        `TONGUE DEPTH: ${params.interlockTongueDepthMm.toFixed(2)} mm`,
      ],
      sfxStyle: 'laser',
      keyframes: [
        {
          cameraPos: [108, 18, 128],
          target: [0, -4, 0],
          fov: 30,
          explode: 0,
          housingOpacity: 1,
          rfFieldIntensity: 0,
          phoneApproach: 0,
          dataStreamProgress: 0,
          mfgStageProgress: 0,
          outlineTraceProgress: 0,
          sectionEnabled: true,
          sectionOffsetMm: 22,
        },
        {
          cameraPos: [82, 10, 112],
          target: [0, -6, 0],
          fov: 28,
          explode: 0,
          housingOpacity: 1,
          rfFieldIntensity: 0,
          phoneApproach: 0,
          dataStreamProgress: 0,
          mfgStageProgress: 0,
          outlineTraceProgress: 0,
          sectionEnabled: true,
          sectionOffsetMm: 0,
        },
        {
          cameraPos: [-88, 16, 126],
          target: [0, -6, 0],
          fov: 30,
          explode: 0,
          housingOpacity: 1,
          rfFieldIntensity: 0,
          phoneApproach: 0,
          dataStreamProgress: 0,
          mfgStageProgress: 0,
          outlineTraceProgress: 0,
          sectionEnabled: true,
          sectionOffsetMm: -18,
        },
      ],
    });
  }

  if (wantsNfc || (!wantsSection && !wantsMfg)) {
    templates.push({
      slug: 'nfc',
      title: 'EMBEDDED NFC & TAP HANDSHAKE',
      angleLabel: 'X-Ray Shell Fade, 13.56 MHz Field & Tap',
      weight: 1.35,
      cameraPathDescription:
        'Macro dolly onto the upper bay as the outer shell turns X-ray translucent, illuminating the copper spiral coil, pulsing RF field rings, and smartphone tap.',
      soundDesignCue: '13.56 MHz inductive hum + cryptographic NFC tap chime',
      narration: `Sealed inside the upper bay sits a ${params.antennaTurns}-turn copper spiral tuned to ${metrics.estimatedInductanceUh} microhenries. A single smartphone tap verifies the cryptographic access key from up to ${metrics.estimatedReadRangeMm} millimeters.`,
      highlightComponent: 'nfc_antenna',
      showCallouts: false,
      hudHeadline: 'VCA AUTHENTICATED · NFC',
      hudSubline: `${params.nfcChipConfig === 'ntag424_dna' ? 'NTAG424 DNA AES-128' : 'NTAG215'} · ACCESS KEY ONLY`,
      hudMetrics: [
        `INDUCTANCE: ${metrics.estimatedInductanceUh} µH @ 13.56 MHz`,
        `TUNING CAP: ${metrics.requiredTuningCapacitancePf} pF`,
        `EST. READ RANGE: ~${metrics.estimatedReadRangeMm} mm`,
      ],
      sfxStyle: 'nfc',
      keyframes: [
        {
          cameraPos: [76, 48, 124],
          target: [16, 32, 0],
          fov: 28,
          explode: 0.18,
          housingOpacity: 0.28,
          rfFieldIntensity: 0.85,
          phoneApproach: 0.15,
          dataStreamProgress: 0,
          mfgStageProgress: 0,
          outlineTraceProgress: 0,
          sectionEnabled: false,
          sectionOffsetMm: 0,
        },
        {
          cameraPos: [38, 44, 118],
          target: [18, 28, 0],
          fov: 28,
          explode: 0,
          housingOpacity: 0.22,
          rfFieldIntensity: 1,
          phoneApproach: 0.9,
          dataStreamProgress: 0,
          mfgStageProgress: 0,
          outlineTraceProgress: 0,
          sectionEnabled: false,
          sectionOffsetMm: 0,
        },
        {
          cameraPos: [-56, 38, 148],
          target: [12, 16, 0],
          fov: 32,
          explode: 0,
          housingOpacity: 0.55,
          rfFieldIntensity: 1,
          phoneApproach: 1,
          dataStreamProgress: 0.3,
          mfgStageProgress: 0,
          outlineTraceProgress: 0,
          sectionEnabled: false,
          sectionOffsetMm: 0,
        },
      ],
    });
  }

  if (wantsBlockchain) {
    templates.push({
      slug: 'blockchain',
      title: 'BLOCKCHAIN DIGITAL IDENTITY',
      angleLabel: 'Data Stream Arc & Verification Nodes',
      weight: 1.15,
      cameraPathDescription:
        'Follow the luminous telemetry arc streaming from the NFC chip through the rotating blockchain verification constellation.',
      soundDesignCue: 'Data telemetry arpeggio + verification chime',
      narration: `The NFC die acts strictly as a secure access key, linking ${params.serialNumber} to its immutable blockchain digital passport and verifiable ownership history.`,
      highlightComponent: 'nfc_chip',
      showCallouts: false,
      hudHeadline: 'DIGITAL PASSPORT LINKED',
      hudSubline: 'NFC HARDWARE KEY -> ON-CHAIN CERTIFICATE',
      hudMetrics: [
        `SERIAL: ${params.serialNumber}`,
        `NFT STORAGE: ON-CHAIN RECORD ONLY`,
        `TAP VERIFICATION: REAL-TIME SUN CRYPTO`,
      ],
      sfxStyle: 'telemetry',
      keyframes: [
        {
          cameraPos: [-64, 34, 168],
          target: [6, 8, 0],
          fov: 35,
          explode: 0,
          housingOpacity: 0.85,
          rfFieldIntensity: 0.55,
          phoneApproach: 1,
          dataStreamProgress: 0.55,
          mfgStageProgress: 0,
          outlineTraceProgress: 0,
          sectionEnabled: false,
          sectionOffsetMm: 0,
        },
        {
          cameraPos: [-122, 22, 196],
          target: [-10, -4, 0],
          fov: 38,
          explode: 0,
          housingOpacity: 1,
          rfFieldIntensity: 0.25,
          phoneApproach: 0.8,
          dataStreamProgress: 1,
          mfgStageProgress: 0,
          outlineTraceProgress: 0,
          sectionEnabled: false,
          sectionOffsetMm: 0,
        },
        {
          cameraPos: [92, 20, 198],
          target: [0, -8, 0],
          fov: 35,
          explode: 0,
          housingOpacity: 1,
          rfFieldIntensity: 0.15,
          phoneApproach: 0.35,
          dataStreamProgress: 1,
          mfgStageProgress: 0,
          outlineTraceProgress: 0,
          sectionEnabled: false,
          sectionOffsetMm: 0,
        },
      ],
    });
  }

  if (wantsMfg) {
    templates.push({
      slug: 'manufacturing',
      title: 'PRECISION MOULDING & LASER QC',
      angleLabel: 'Platens, Robotic NFC Placement & Laser Scan',
      weight: 1.25,
      cameraPathDescription:
        'Tracking shot beside precision injection-moulding platens closing on the polycarbonate shell, robotic NFC vacuum nozzle placement, and final optical laser scan.',
      soundDesignCue: 'Cleanroom robotics servo + ultrasonic weld + laser sweep',
      narration: `From precision ${params.draftAngleDeg.toFixed(1)}-degree draft moulding to automated NFC antenna placement and ultrasonic perimeter sealing, every stage targets cleanroom repeatability.`,
      highlightComponent: 'tamper_weld_pins',
      showCallouts: false,
      hudHeadline: 'CLEANROOM MANUFACTURING',
      hudSubline: 'INJECTION MOULD -> NFC PLACE -> LASER QC',
      hudMetrics: [
        `MOULD DRAFT: ${params.draftAngleDeg.toFixed(1)}°`,
        `WELD DIRECTOR: ${params.weldRidgeWidthMm.toFixed(2)} mm`,
        `QC INSPECTION: OPTICAL LASER SWEEP`,
      ],
      sfxStyle: 'laser',
      keyframes: [
        {
          cameraPos: [188, 28, 176],
          target: [0, -6, 0],
          fov: 35,
          explode: 0.45,
          housingOpacity: 1,
          rfFieldIntensity: 0,
          phoneApproach: 0,
          dataStreamProgress: 0,
          mfgStageProgress: 0.2,
          outlineTraceProgress: 0,
          sectionEnabled: false,
          sectionOffsetMm: 0,
        },
        {
          cameraPos: [72, 98, 188],
          target: [0, -2, 0],
          fov: 36,
          explode: 0.2,
          housingOpacity: 1,
          rfFieldIntensity: 0.15,
          phoneApproach: 0,
          dataStreamProgress: 0,
          mfgStageProgress: 0.62,
          outlineTraceProgress: 0,
          sectionEnabled: false,
          sectionOffsetMm: 0,
        },
        {
          cameraPos: [-156, 26, 196],
          target: [0, -6, 0],
          fov: 34,
          explode: 0,
          housingOpacity: 1,
          rfFieldIntensity: 0,
          phoneApproach: 0,
          dataStreamProgress: 0,
          mfgStageProgress: 1,
          outlineTraceProgress: 0.4,
          sectionEnabled: false,
          sectionOffsetMm: 0,
        },
      ],
    });
  }

  // Closing signature shot
  templates.push({
    slug: 'finale',
    title: 'HERO SIGNATURE FINALE',
    angleLabel: 'Chamfer Perimeter Trace & Smooth Pullback',
    weight: 0.85,
    cameraPathDescription:
      'Smooth centered pullback as electric-blue light traces the chamfered perimeter of the finished VCA slab before settling into the brand lockup.',
    soundDesignCue: 'Resonant low-end impact resolving into quiet atmospheric tail',
    narration: 'Verified Card Authority. Physical protection meets cryptographic certainty.',
    highlightComponent: null,
    showCallouts: false,
    hudHeadline: 'VCA · VERIFIED CARD AUTHORITY',
    hudSubline: 'VCASLABS.COM · TRUST WHAT YOU COLLECT',
    hudMetrics: [
      `SERIAL: ${params.serialNumber}`,
      `TAMPER-EVIDENT ULTRASONIC SEAL`,
    ],
    sfxStyle: 'impact',
    keyframes: [
      {
        cameraPos: [82, 16, 208],
        target: [0, -8, 0],
        fov: 33,
        explode: 0,
        housingOpacity: 1,
        rfFieldIntensity: 0.25,
        phoneApproach: 0,
        dataStreamProgress: 0,
        mfgStageProgress: 0,
        outlineTraceProgress: 0.7,
        sectionEnabled: false,
        sectionOffsetMm: 0,
      },
      {
        cameraPos: [20, 12, 232],
        target: [0, -10, 0],
        fov: 34,
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
        cameraPos: [0, 10, 255],
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
    ],
  });

  const weightSum = templates.reduce((acc, t) => acc + t.weight, 0);
  let cursorSec = 0;
  const scenes: ExplainerSegment[] = templates.map((tpl, idx) => {
    const dur =
      idx === templates.length - 1
        ? Math.max(5, targetSec - cursorSec)
        : Math.max(6, Math.round((tpl.weight / weightSum) * targetSec));
    const startSec = cursorSec;
    const endSec = cursorSec + dur;
    cursorSec = endSec;
    return {
      id: `gen-scene-${idx + 1}`,
      index: idx + 1,
      title: `SCENE 0${idx + 1} · ${tpl.title}`,
      angleLabel: tpl.angleLabel,
      cameraPathDescription: tpl.cameraPathDescription,
      soundDesignCue: tpl.soundDesignCue,
      startSec,
      endSec,
      narration: tpl.narration,
      highlightComponent: tpl.highlightComponent,
      showCallouts: tpl.showCallouts,
      hudHeadline: tpl.hudHeadline,
      hudSubline: tpl.hudSubline,
      hudMetrics: tpl.hudMetrics,
      accentHex,
      sfxStyle: tpl.sfxStyle,
      keyframes: tpl.keyframes,
    };
  });

  const summaryTopic = prompt.length > 52 ? `${prompt.slice(0, 49).trim()}...` : prompt;

  return {
    title: `Custom Showcase: ${summaryTopic}`,
    prompt,
    creativeDirection: `Obsidian studio cinematography with custom multi-angle CAD choreography (${scenes.length} scenes, ${cursorSec}s).`,
    totalDurationSec: cursorSec,
    accentHex,
    generatedBy: 'studio-director',
    scenes,
  };
}
