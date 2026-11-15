import { EngineeringMetrics, POLYMER_SPECS, generateBom } from './engineeringMath';
import { DEFAULT_SLAB_PARAMETERS, SlabParameters, VIEW_PRESETS, ViewPresetId } from './types';

export type AppRouteMode = 'full' | 'cad-only' | 'embed-blueprint' | 'readme';
export type EmbedBlueprintStyle = 'exploded-blueprint' | 'blueprint' | 'studio' | 'xray-nfc';

export const DEFAULT_GITHUB_CAD_URL = 'https://github.com/vcaslabs/vca-slab-cad';
export const GITHUB_CAD_STORAGE_KEY = 'vca_github_cad_repo_url';
export const DEFAULT_CONTACT_EMAIL = 'tosmond@vcaslabs.com';
export const CONTACT_EMAIL_STORAGE_KEY = 'vca_manufacturer_contact_email';

export interface EmbedOptions {
  style: EmbedBlueprintStyle;
  view: ViewPresetId;
  explode: boolean;
  callouts: boolean;
  hud: boolean;
  animate: boolean;
  heightPx: number;
}

export const DEFAULT_EMBED_OPTIONS: EmbedOptions = {
  style: 'exploded-blueprint',
  view: 'exploded',
  explode: true,
  callouts: true,
  hud: true,
  animate: true,
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

export function sanitizeContactEmail(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_CONTACT_EMAIL;
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return trimmed;
  }
  return DEFAULT_CONTACT_EMAIL;
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

export function parseAppModeAndEmbedFromSearch(
  search: string,
  pathname: string = ''
): ParsedRouteState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const embedParam = q.get('embed');
  const modeParam = q.get('mode');
  const normalizedPath = pathname.replace(/\/+$/, '').toLowerCase();

  const isReadme = modeParam === 'readme' || normalizedPath === '/readme';
  const isEmbed = !isReadme && (embedParam === 'blueprint' || embedParam === '1' || embedParam === 'cad');
  const cadOnly = isReadme || isEmbed || modeParam === 'cad-only' || modeParam === 'cad';
  const mode: AppRouteMode = isReadme
    ? 'readme'
    : isEmbed
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

  const animateParam = q.get('animate');
  const animate =
    animateParam !== null ? animateParam === '1' || animateParam === 'true' : true;

  const heightPx = clampNum(q.get('height'), 280, 1200) ?? DEFAULT_EMBED_OPTIONS.heightPx;

  return {
    mode,
    cadOnly,
    embed: { style, view, explode, callouts, hud, animate, heightPx },
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

export function buildReadmePageUrl(origin: string, params: SlabParameters): string {
  const base = origin.replace(/\/+$/, '');
  const q = buildParamQuery(params);
  q.set('mode', 'readme');
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
  q.set('animate', options.animate ? '1' : '0');
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

export function buildAnimatedCadSvgUrl(
  origin: string,
  params: SlabParameters,
  contactEmail: string = DEFAULT_CONTACT_EMAIL
): string {
  const base = origin.replace(/\/+$/, '');
  const q = buildParamQuery(params);
  const cleanEmail = sanitizeContactEmail(contactEmail);
  if (cleanEmail !== DEFAULT_CONTACT_EMAIL) {
    q.set('email', cleanEmail);
  }
  return `${base}/api/cad-animated.svg?${q.toString()}`;
}

export interface CadDownloadUrls {
  stlUrl: string;
  dxfUrl: string;
  scadUrl: string;
  bomCsvUrl: string;
  rfqUrl: string;
  blueprintSvgUrl: string;
  animatedCadSvgUrl: string;
  dynamicReadmeUrl: string;
  readmePageUrl: string;
  interactive3dUrl: string;
  cadOnlyUrl: string;
}

export function buildCadDownloadUrls(
  origin: string,
  params: SlabParameters,
  contactEmail: string = DEFAULT_CONTACT_EMAIL,
  githubRepoUrl: string = DEFAULT_GITHUB_CAD_URL
): CadDownloadUrls {
  const base = origin.replace(/\/+$/, '');
  const cleanEmail = sanitizeContactEmail(contactEmail);
  const cleanRepo = sanitizeGitHubRepoUrl(githubRepoUrl);
  const baseQs = buildParamQuery(params).toString();

  const emailQs = new URLSearchParams(baseQs);
  emailQs.set('email', cleanEmail);

  const readmeQs = new URLSearchParams(baseQs);
  readmeQs.set('email', cleanEmail);
  if (cleanRepo !== DEFAULT_GITHUB_CAD_URL) {
    readmeQs.set('repo', cleanRepo);
  }

  return {
    stlUrl: `${base}/api/cad/housing.stl?${baseQs}`,
    dxfUrl: `${base}/api/cad/profile.dxf?${baseQs}`,
    scadUrl: `${base}/api/cad/parametric.scad?${baseQs}`,
    bomCsvUrl: `${base}/api/cad/bom.csv?${baseQs}`,
    rfqUrl: `${base}/api/cad/manufacturer-rfq.md?${emailQs.toString()}`,
    blueprintSvgUrl: buildBlueprintSvgUrl(base, DEFAULT_EMBED_OPTIONS, params),
    animatedCadSvgUrl: buildAnimatedCadSvgUrl(base, params, cleanEmail),
    dynamicReadmeUrl: `${base}/api/cad/README.md?${readmeQs.toString()}`,
    readmePageUrl: buildReadmePageUrl(base, params),
    interactive3dUrl: buildEmbedIframeUrl(base, DEFAULT_EMBED_OPTIONS, params),
    cadOnlyUrl: buildCadOnlyUrl(base, params),
  };
}

export interface EmbedSnippets {
  directUrl: string;
  cadOnlyUrl: string;
  svgUrl: string;
  animatedCadSvgUrl: string;
  iframeHtml: string;
  scriptWidgetHtml: string;
  markdownSnippet: string;
  animatedMarkdownSnippet: string;
  objectSvgHtml: string;
  postMessageSnippet: string;
}

export function buildEmbedSnippets(
  origin: string,
  options: EmbedOptions,
  params: SlabParameters,
  contactEmail: string = DEFAULT_CONTACT_EMAIL
): EmbedSnippets {
  const base = origin.replace(/\/+$/, '');
  const directUrl = buildEmbedIframeUrl(base, options, params);
  const cadOnlyUrl = buildCadOnlyUrl(base, params);
  const svgUrl = buildBlueprintSvgUrl(base, options, params);
  const animatedCadSvgUrl = buildAnimatedCadSvgUrl(base, params, contactEmail);
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
  data-animate="${options.animate ? '1' : '0'}"
  data-height="${height}"
></div>
<script async src="${base}/embed.js"></script>`;

  const markdownSnippet = `[![VCA Slab CAD Blueprint (${params.serialNumber})](${svgUrl})](${cadOnlyUrl})`;
  const animatedMarkdownSnippet = `[![VCA Live 3D Animated Slab CAD (${params.serialNumber})](${animatedCadSvgUrl})](${directUrl})`;

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
  animate: ${options.animate ? 'true' : 'false'},
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
    animatedCadSvgUrl,
    iframeHtml,
    scriptWidgetHtml,
    markdownSnippet,
    animatedMarkdownSnippet,
    objectSvgHtml,
    postMessageSnippet,
  };
}

export function buildGitHubCadReadme(
  params: SlabParameters,
  metrics: EngineeringMetrics,
  origin: string,
  githubRepoUrl: string,
  contactEmail: string = DEFAULT_CONTACT_EMAIL
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanRepo = sanitizeGitHubRepoUrl(githubRepoUrl);
  const cleanEmail = sanitizeContactEmail(contactEmail);
  const poly = POLYMER_SPECS[params.polymerGrade];
  const bom = generateBom(params, metrics);
  const urls = buildCadDownloadUrls(cleanOrigin, params, cleanEmail, cleanRepo);
  const snippets = buildEmbedSnippets(cleanOrigin, DEFAULT_EMBED_OPTIONS, params, cleanEmail);

  const bomTableRows = bom
    .map(
      (b) =>
        `| ${b.itemNo} | \`${b.partNumber}\` | ${b.description} | ${b.material} | ${b.qty} | ${b.unitMassG} g | ${b.process} | ${b.specStatus} |`
    )
    .join('\n');

  const nfcChipLabel =
    params.nfcChipConfig === 'ntag424_dna'
      ? 'NXP NTAG424 DNA (AES-128 SUN)'
      : 'NXP NTAG215 (Static NDEF Prototype)';

  return `# VCA — Verified Card Authority | Manufacturer CAD & Engineering Specification

**Reference Prototype Identity:** \`${params.serialNumber}\`  
**Manufacturing & Engineering Inquiries:** [${cleanEmail}](mailto:${cleanEmail})  
**Brand Portal:** [https://vcaslabs.com](https://vcaslabs.com) · **CAD Repository:** ${cleanRepo}  
**Interactive CAD Workstations (No Video Tools):** [Open Live README Page (3D Embedded)](${urls.readmePageUrl}) · [Launch Live 3D CAD Viewport](${urls.interactive3dUrl}) · [Launch Full CAD Studio (\`?mode=cad-only\`)](${urls.cadOnlyUrl})

---

## Live 3D Animated Slab CAD Preview (Exploded Stackup & 13.56 MHz NFC Assembly)

> Click the live animated 3D transparent VCA slab preview below to open the interactive Three.js 3D viewport where manufacturers and engineers can orbit, inspect Front & Rear VCA labels, toggle Z-axis layer explosion, and click components \`#01\`–\`#12\`.

[![VCA Live 3D Animated Slab CAD (${params.serialNumber})](${urls.animatedCadSvgUrl})](${urls.interactive3dUrl})

---

## Direct Manufacturer Contact & DFM Submission

- **Primary Engineering & RFQ Contact:** [${cleanEmail}](mailto:${cleanEmail}?subject=${encodeURIComponent(`VCA Slab Manufacturing & DFM Inquiry — ${params.serialNumber}`)})
- **Live Synced README Endpoint:** [View / Fetch Raw Dynamic \`README.md\`](${urls.dynamicReadmeUrl})
- **Critical Specification Status:** All tolerances, shrinkage allowances, wall thicknesses, and RF coupling figures below are **Proposed Engineering Targets** generated by the VCA Parametric CAD Workstation. Hardened steel cavity cuts, gate locations, hot-runner manifold design, and SPI optical surface grades **require formal vendor DFM confirmation** prior to tooling release.

---

## 1. One-Click Manufacturer CAD & Documentation Downloads

Download live, parameter-synced fabrication files directly from the links below:

| Package Artifact | Format | Description | Direct Download |
| --- | --- | --- | --- |
| **3D Exterior Housing Mesh** | \`.stl\` (ASCII) | Watertight chamfered VCA shell (\`${params.overallWidthMm.toFixed(1)} × ${params.overallHeightMm.toFixed(1)} × ${params.overallThicknessMm.toFixed(1)} mm\`) | [Download \`${params.serialNumber}-housing.stl\`](${urls.stlUrl}) |
| **2D Precision CAD Profile** | \`.dxf\` (AutoCAD R12) | Multi-layer profiles: \`OUTLINE\`, \`CAVITY\`, \`LABEL_BAY\`, \`NFC_POCKET\` | [Download \`${params.serialNumber}-profile.dxf\`](${urls.dxfUrl}) |
| **Parametric B-Rep CAD Source** | \`.scad\` (OpenSCAD / FreeCAD) | Editable solid assembly script ready for STEP AP214 / IGES export | [Download \`${params.serialNumber}-parametric.scad\`](${urls.scadUrl}) |
| **Bill of Materials (BOM)** | \`.csv\` | Itemized housing shells, collar, NFC inlay, archival label, and tamper seal | [Download \`${params.serialNumber}-bom.csv\`](${urls.bomCsvUrl}) |
| **Manufacturer RFQ & Tooling Brief** | \`.md\` | Complete injection-moulding, RF, and ultrasonic welding RFQ dossier | [Download \`${params.serialNumber}-manufacturer-rfq.md\`](${urls.rfqUrl}) |
| **2D Orthographic CAD Blueprint** | \`.svg\` | Full orthographic front elevation + Z-axis stackup drawing | [Download \`${params.serialNumber}-blueprint.svg\`](${urls.blueprintSvgUrl}) |
| **Live 3D Animated CAD Graphic** | \`.svg\` (Animated) | Embeddable isometric animated 3D exploded CAD preview | [Download \`${params.serialNumber}-animated-3d.svg\`](${urls.animatedCadSvgUrl}) |
| **Dynamic Manufacturer README** | \`.md\` | Live parameter-driven copy of this README document | [Download \`README.md\`](${urls.dynamicReadmeUrl}&download=1) |

---

## 2. Enclosure, Polymer & Injection-Moulding Requirements

| Engineering Parameter | Proposed Target | Tooling & Vendor Confirmation Notes |
| --- | --- | --- |
| **Overall Exterior Envelope** | \`${params.overallWidthMm.toFixed(2)} × ${params.overallHeightMm.toFixed(2)} × ${params.overallThicknessMm.toFixed(2)} mm\` | VCA chamfered upper shoulder silhouette (\`${params.shoulderChamferMm.toFixed(1)} mm\` chamfer, \`R${params.cornerRadiusMm.toFixed(1)} mm\`) |
| **Primary Optical Resin** | \`${poly.name}\` | Proposed grade: \`${poly.gradeExample}\` (Transmittance \`${poly.lightTransmittancePct}%\`, Haze \`< ${poly.hazePct}%\`) |
| **Nominal Shell Wall Thickness** | \`${params.wallThicknessMm.toFixed(2)} mm\` | Minimum structural floor behind NFC recess: \`${metrics.minimumWallBehindNfcMm} mm\` |
| **Optical Viewing Window Finish** | \`SPI A-1 Diamond Polish\` | Perimeter collar matte texture \`VDI 24–27\` (EDM finish) |
| **Minimum Draft Angle** | \`${params.draftAngleDeg.toFixed(1)}°\` | Required on optical core walls to eliminate ejection scuffing |
| **General Dimensional Tolerance** | \`±${params.assemblyToleranceMm.toFixed(2)} mm\` | ISO 2768-m / DIN 16742 TG4 (Confirm critical datum flatness w/ moulder) |
| **Shrinkage Allowance & Tool Cavity** | \`${metrics.nominalShrinkagePct}%\` (\`${metrics.compensatedToolWidthMm} × ${metrics.compensatedToolHeightMm} mm\`) | Estimated shot volume \`${metrics.housingVolumeCm3} cm³\`, part mass \`${metrics.estimatedTotalMassG} g\` |
| **Projected Area & Press Est.** | \`${metrics.projectedAreaCm2} cm²\` (~${metrics.estimatedClampingForceTons} US Tons) | 2-cavity hardened S136 / Stavax stainless optical tooling recommended (confirm w/ moulder) |

---

## 3. Card Cavity, Tamper-Evident Weld & NFC Hardware Requirements

### Internal Card Protection & Tamper-Evident Joining
- **Target Card Envelope:** \`${params.cardWidthMm.toFixed(2)} × ${params.cardHeightMm.toFixed(2)} × ${params.cardThicknessMm.toFixed(2)} mm\` (Archival inner sleeve: \`${params.useInnerSleeve ? 'Enabled' : 'Disabled'}\`)
- **Moulded Card Cavity Envelope:** \`${metrics.internalCavityWidthMm} × ${metrics.internalCavityHeightMm} × ${metrics.internalCavityDepthMm} mm\` (Zero-pinch Z-axis play: \`${metrics.zAxisPlayMm} mm\`, corner relief \`R${params.cornerReliefRadiusMm.toFixed(2)} mm\`)
- **Ultrasonic Perimeter Fusion:** \`20 kHz\` hermetic weld utilizing a \`${params.weldRidgeWidthMm.toFixed(2)} × ${params.weldRidgeHeightMm.toFixed(2)} mm\` 45° triangular energy director
- **Interlock & Anti-Pry Architecture:** \`${params.interlockTongueDepthMm.toFixed(2)} mm\` tongue-and-groove perimeter seat plus **4 frangible corner micro-shear alignment pins** (\`Ø 1.80 mm\`) and destructible diffractive hologram / QR void seal

### Integrated 13.56 MHz NFC Access Hardware
- **NFC IC Specification:** \`${nfcChipLabel}\` (ISO/IEC 14443-A)
- **Recessed Isolation Bay:** \`${params.nfcPocketWidthMm.toFixed(2)} × ${params.nfcPocketHeightMm.toFixed(2)} × ${params.nfcPocketDepthMm.toFixed(2)} mm\` (sealed in upper label compartment)
- **Planar Copper Spiral Antenna:** \`${params.antennaOuterWidthMm.toFixed(1)} × ${params.antennaOuterHeightMm.toFixed(1)} mm\`, \`${params.antennaTurns}\` turns (\`${params.antennaTraceWidthMm} mm\` trace width / \`${params.antennaTraceSpacingMm} mm\` gap, \`${params.antennaCopperThicknessUm} µm\` Cu on polyimide flex)
- **Calculated RF Parameters:** \`${metrics.estimatedInductanceUh} µH\` inductance · \`${metrics.requiredTuningCapacitancePf} pF\` tuning capacitance @ \`13.56 MHz\` · Estimated closed-slab smartphone read distance ~\`${metrics.estimatedReadRangeMm} mm\`
- **Architectural Boundary:** The NFC chip operates strictly as a hardware-bound cryptographic access key. The digital certificate / NFT record lives off-chip.

---

## 4. Bill of Materials (BOM)

| Item | Part Number | Description | Material | Qty | Mass | Process | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
${bomTableRows}

---

## 5. Embed Options (Add This Live CAD Anywhere)

Manufacturers, partners, and documentation portals can embed the live VCA Slab CAD using any of the options below:

### Option A — Markdown Live 3D Animated CAD (GitHub, Notion, Linear, Obsidian)
\`\`\`markdown
${snippets.animatedMarkdownSnippet}
\`\`\`

### Option B — Interactive 3D CAD & Blueprint \`<iframe>\` (Websites, Supplier Portals, Webflow, Framer)
\`\`\`html
${snippets.iframeHtml}
\`\`\`

### Option C — Dynamic Self-Mounting Text-Box Widget (\`/embed.js\`)
\`\`\`html
${snippets.scriptWidgetHtml}
\`\`\`

### Option D — Static Vector Blueprint Fallback (\`<object>\`)
\`\`\`html
${snippets.objectSvgHtml}
\`\`\`

---

**Questions, DFM feedback, or tooling quotes?** Contact **${cleanEmail}** · [vcaslabs.com](https://vcaslabs.com)
`;
}
