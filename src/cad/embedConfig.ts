import { EngineeringMetrics, POLYMER_SPECS } from './engineeringMath';
import { DEFAULT_SLAB_PARAMETERS, SlabParameters, VIEW_PRESETS, ViewPresetId } from './types';

export type AppRouteMode = 'full' | 'cad-only' | 'embed-blueprint';
export type EmbedBlueprintStyle = 'exploded-blueprint' | 'blueprint' | 'studio' | 'xray-nfc';

export const DEFAULT_GITHUB_CAD_URL = 'https://github.com/vcaslabs/vca-slab-cad';
export const GITHUB_CAD_STORAGE_KEY = 'vca_github_cad_repo_url';

export interface EmbedOptions {
  style: EmbedBlueprintStyle;
  view: ViewPresetId;
  explode: boolean;
  callouts: boolean;
  hud: boolean;
  heightPx: number;
}

export const DEFAULT_EMBED_OPTIONS: EmbedOptions = {
  style: 'exploded-blueprint',
  view: 'exploded',
  explode: true,
  callouts: true,
  hud: true,
  heightPx: 560,
};

export interface ParsedRouteState {
  mode: AppRouteMode;
  cadOnly: boolean;
  embed: EmbedOptions;
  paramOverrides: Partial<SlabParameters>;
}

const VALID_VIEWS = new Set<ViewPresetId>(VIEW_PRESETS.map((v) => v.id));
const VALID_STYLES = new Set<EmbedBlueprintStyle>([
  'exploded-blueprint',
  'blueprint',
  'studio',
  'xray-nfc',
]);

function clampNum(raw: string | null, min: number, max: number): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeGitHubRepoUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_GITHUB_CAD_URL;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Allow shorthand owner/repo like "vcaslabs/vca-slab-cad"
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      return `https://github.com/${trimmed}`;
    }
  }
  return DEFAULT_GITHUB_CAD_URL;
}

export function parseParamOverridesFromSearch(search: string): Partial<SlabParameters> {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const out: Partial<SlabParameters> = {};

  const serial = q.get('serial');
  if (serial && /^[a-zA-Z0-9_-]{2,28}$/.test(serial.trim())) {
    out.serialNumber = serial.trim();
  }

  const w = clampNum(q.get('w'), 78, 96);
  const h = clampNum(q.get('h'), 126, 152);
  const t = clampNum(q.get('t'), 5.2, 10.5);
  const wall = clampNum(q.get('wall'), 1.2, 2.8);
  const turns = clampNum(q.get('turns'), 3, 10);

  if (w !== undefined) out.overallWidthMm = w;
  if (h !== undefined) out.overallHeightMm = h;
  if (t !== undefined) out.overallThicknessMm = t;
  if (wall !== undefined) out.wallThicknessMm = wall;
  if (turns !== undefined) out.antennaTurns = Math.round(turns);

  const chip = q.get('chip');
  if (chip === 'ntag424_dna' || chip === 'ntag215') {
    out.nfcChipConfig = chip;
  }

  return out;
}

export function parseAppModeAndEmbedFromSearch(search: string): ParsedRouteState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const embedParam = q.get('embed');
  const modeParam = q.get('mode');

  const isEmbed = embedParam === 'blueprint' || embedParam === '1' || embedParam === 'cad';
  const cadOnly = isEmbed || modeParam === 'cad-only' || modeParam === 'cad';
  const mode: AppRouteMode = isEmbed
    ? 'embed-blueprint'
    : cadOnly
      ? 'cad-only'
      : 'full';

  const rawStyle = q.get('style') as EmbedBlueprintStyle | null;
  const style: EmbedBlueprintStyle =
    rawStyle && VALID_STYLES.has(rawStyle) ? rawStyle : DEFAULT_EMBED_OPTIONS.style;

  const rawView = q.get('view') as ViewPresetId | null;
  const view: ViewPresetId =
    rawView && VALID_VIEWS.has(rawView)
      ? rawView
      : style === 'exploded-blueprint'
        ? 'exploded'
        : 'assembled';

  const explodeParam = q.get('explode');
  const explode =
    explodeParam !== null
      ? explodeParam === '1' || explodeParam === 'true'
      : style === 'exploded-blueprint' || view === 'exploded';

  const calloutsParam = q.get('callouts');
  const callouts =
    calloutsParam !== null ? calloutsParam === '1' || calloutsParam === 'true' : true;

  const hudParam = q.get('hud');
  const hud = hudParam !== null ? hudParam === '1' || hudParam === 'true' : true;

  const heightPx = clampNum(q.get('height'), 280, 1200) ?? DEFAULT_EMBED_OPTIONS.heightPx;

  return {
    mode,
    cadOnly,
    embed: { style, view, explode, callouts, hud, heightPx },
    paramOverrides: parseParamOverridesFromSearch(search),
  };
}

function buildParamQuery(params: SlabParameters): URLSearchParams {
  const q = new URLSearchParams();
  q.set('serial', params.serialNumber);
  if (Math.abs(params.overallWidthMm - DEFAULT_SLAB_PARAMETERS.overallWidthMm) > 0.01) {
    q.set('w', params.overallWidthMm.toFixed(1));
  }
  if (Math.abs(params.overallHeightMm - DEFAULT_SLAB_PARAMETERS.overallHeightMm) > 0.01) {
    q.set('h', params.overallHeightMm.toFixed(1));
  }
  if (Math.abs(params.overallThicknessMm - DEFAULT_SLAB_PARAMETERS.overallThicknessMm) > 0.01) {
    q.set('t', params.overallThicknessMm.toFixed(1));
  }
  if (Math.abs(params.wallThicknessMm - DEFAULT_SLAB_PARAMETERS.wallThicknessMm) > 0.01) {
    q.set('wall', params.wallThicknessMm.toFixed(2));
  }
  if (params.nfcChipConfig !== DEFAULT_SLAB_PARAMETERS.nfcChipConfig) {
    q.set('chip', params.nfcChipConfig);
  }
  if (params.antennaTurns !== DEFAULT_SLAB_PARAMETERS.antennaTurns) {
    q.set('turns', String(params.antennaTurns));
  }
  return q;
}

export function buildCadOnlyUrl(origin: string, params: SlabParameters): string {
  const base = origin.replace(/\/+$/, '');
  const q = buildParamQuery(params);
  q.set('mode', 'cad-only');
  return `${base}/?${q.toString()}`;
}

export function buildEmbedIframeUrl(
  origin: string,
  options: EmbedOptions,
  params: SlabParameters
): string {
  const base = origin.replace(/\/+$/, '');
  const q = buildParamQuery(params);
  q.set('embed', 'blueprint');
  q.set('style', options.style);
  q.set('view', options.view);
  q.set('explode', options.explode ? '1' : '0');
  q.set('callouts', options.callouts ? '1' : '0');
  q.set('hud', options.hud ? '1' : '0');
  return `${base}/?${q.toString()}`;
}

export function buildBlueprintSvgUrl(
  origin: string,
  options: EmbedOptions,
  params: SlabParameters
): string {
  const base = origin.replace(/\/+$/, '');
  const q = buildParamQuery(params);
  q.set('style', options.style);
  q.set('view', options.view);
  q.set('explode', options.explode ? '1' : '0');
  q.set('hud', options.hud ? '1' : '0');
  return `${base}/api/blueprint.svg?${q.toString()}`;
}

export interface EmbedSnippets {
  directUrl: string;
  cadOnlyUrl: string;
  svgUrl: string;
  iframeHtml: string;
  scriptWidgetHtml: string;
  markdownSnippet: string;
  objectSvgHtml: string;
  postMessageSnippet: string;
}

export function buildEmbedSnippets(
  origin: string,
  options: EmbedOptions,
  params: SlabParameters
): EmbedSnippets {
  const base = origin.replace(/\/+$/, '');
  const directUrl = buildEmbedIframeUrl(base, options, params);
  const cadOnlyUrl = buildCadOnlyUrl(base, params);
  const svgUrl = buildBlueprintSvgUrl(base, options, params);
  const height = Math.round(options.heightPx);

  const iframeHtml = `<iframe
  src="${directUrl}"
  title="VCA Slab CAD Blueprint — ${params.serialNumber}"
  width="100%"
  height="${height}"
  style="border:1px solid #1E3A5F;border-radius:8px;background:#041224;display:block;"
  loading="lazy"
  allow="fullscreen"
></iframe>`;

  const scriptWidgetHtml = `<div
  data-vca-blueprint
  data-serial="${params.serialNumber}"
  data-style="${options.style}"
  data-view="${options.view}"
  data-explode="${options.explode ? '1' : '0'}"
  data-callouts="${options.callouts ? '1' : '0'}"
  data-hud="${options.hud ? '1' : '0'}"
  data-height="${height}"
></div>
<script async src="${base}/embed.js"></script>`;

  const markdownSnippet = `[![VCA Slab CAD Blueprint (${params.serialNumber})](${svgUrl})](${cadOnlyUrl})`;

  const objectSvgHtml = `<object
  type="image/svg+xml"
  data="${svgUrl}"
  aria-label="VCA Slab CAD Blueprint ${params.serialNumber}"
  style="width:100%;max-width:1200px;aspect-ratio:5/3;border:1px solid #1E3A5F;border-radius:8px;display:block;"
></object>`;

  const postMessageSnippet = `// Dynamically update any embedded VCA blueprint iframe from your host page
const frame = document.querySelector('iframe[src*="embed=blueprint"]');
frame?.contentWindow?.postMessage({
  type: 'VCA_EMBED_UPDATE',
  style: '${options.style}',
  explode: ${options.explode ? 'true' : 'false'},
  params: {
    overallWidthMm: ${params.overallWidthMm.toFixed(1)},
    overallHeightMm: ${params.overallHeightMm.toFixed(1)},
    overallThicknessMm: ${params.overallThicknessMm.toFixed(1)},
    antennaTurns: ${params.antennaTurns}
  }
}, '*');`;

  return {
    directUrl,
    cadOnlyUrl,
    svgUrl,
    iframeHtml,
    scriptWidgetHtml,
    markdownSnippet,
    objectSvgHtml,
    postMessageSnippet,
  };
}

export function buildGitHubCadReadme(
  params: SlabParameters,
  metrics: EngineeringMetrics,
  origin: string,
  githubRepoUrl: string
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanRepo = sanitizeGitHubRepoUrl(githubRepoUrl);
  const cadOnlyUrl = buildCadOnlyUrl(cleanOrigin, params);
  const svgUrl = buildBlueprintSvgUrl(cleanOrigin, DEFAULT_EMBED_OPTIONS, params);
  const iframeUrl = buildEmbedIframeUrl(cleanOrigin, DEFAULT_EMBED_OPTIONS, params);
  const poly = POLYMER_SPECS[params.polymerGrade];

  return `# VCA — Verified Card Authority | Certified Slab CAD & Hardware Specification

**Reference Serial:** \`${params.serialNumber}\`  
**Repository:** ${cleanRepo}  
**Interactive CAD-Only Viewer (No Video Studio):** [Launch CAD & Blueprints](${cadOnlyUrl})

[![VCA Slab CAD Blueprint (${params.serialNumber})](${svgUrl})](${cadOnlyUrl})

> **Scope:** This repository export contains the VCA parametric 3D CAD geometry, 2D CAD profiles, engineering blueprints, NFC hardware layout, bill of materials, and verification architecture. All video/film production tools are excluded in CAD-only mode.

---

## 1. Proposed Physical Enclosure Dimensions
| Parameter | Proposed Value | Notes |
| --- | --- | --- |
| Overall Exterior Envelope | \`${params.overallWidthMm.toFixed(2)} × ${params.overallHeightMm.toFixed(2)} × ${params.overallThicknessMm.toFixed(2)} mm\` | VCA chamfered shoulder silhouette |
| Optical Shell Wall Thickness | \`${params.wallThicknessMm.toFixed(2)} mm\` | ${poly.name} (${poly.gradeExample}) |
| Internal Card Cavity Opening | \`${metrics.internalCavityWidthMm} × ${metrics.internalCavityHeightMm} mm\` | Target card: \`${params.cardWidthMm} × ${params.cardHeightMm} mm\` |
| Internal Cavity Depth | \`${metrics.internalCavityDepthMm} mm\` | Sleeve: ${params.useInnerSleeve ? 'Enabled' : 'Disabled'} |
| Ultrasonic Energy Director | \`${params.weldRidgeWidthMm.toFixed(2)} × ${params.weldRidgeHeightMm.toFixed(2)} mm\` | 20 kHz perimeter fusion + 4 shear pins |

## 2. Integrated NFC Access-Key Architecture
- **NFC Chip Configuration:** \`${params.nfcChipConfig === 'ntag424_dna' ? 'NXP NTAG424 DNA (AES-128 SUN)' : 'NXP NTAG215 (Static NDEF)'}\`
- **Planar Copper Spiral Coil:** \`${params.antennaOuterWidthMm} × ${params.antennaOuterHeightMm} mm\`, \`${params.antennaTurns}\` turns
- **Estimated Inductance:** \`${metrics.estimatedInductanceUh} µH @ 13.56 MHz\` (~${metrics.estimatedReadRangeMm} mm closed-slab read)
- **Architectural Boundary:** The NFC chip operates strictly as a hardware-bound cryptographic access key. The digital certificate/NFT record lives off-chip.

## 3. Repository CAD Artifacts
- \`${params.serialNumber}-housing.stl\` — Watertight chamfered exterior mesh (ASCII STL)
- \`${params.serialNumber}-profile.dxf\` — AutoCAD R12 2D layers (\`OUTLINE\`, \`CAVITY\`, \`LABEL_BAY\`, \`NFC_POCKET\`)
- \`${params.serialNumber}-parametric.scad\` — Editable OpenSCAD / FreeCAD B-Rep source
- \`${params.serialNumber}-blueprint.svg\` — Parametric 2D engineering schematic & Z-axis stackup

## 4. Embed This Blueprint Anywhere
Use the dynamic iframe URL in Notion, Webflow, React, or any HTML container:
\`\`\`html
<iframe src="${iframeUrl}" width="100%" height="560" style="border:1px solid #1E3A5F;border-radius:8px;" loading="lazy"></iframe>
\`\`\`
`;
}
