import { EngineeringMetrics, POLYMER_SPECS } from './engineeringMath';
import { EmbedBlueprintStyle } from './embedConfig';
import { SlabParameters, ViewPresetId } from './types';

export interface BlueprintSvgOptions {
  style?: EmbedBlueprintStyle;
  view?: ViewPresetId;
  explode?: boolean;
  hud?: boolean;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function chamferPolygonPoints(
  cx: number,
  cy: number,
  w: number,
  h: number,
  c: number
): string {
  const hw = w / 2;
  const hh = h / 2;
  const pts: [number, number][] = [
    [cx - hw + c, cy - hh],
    [cx + hw - c, cy - hh],
    [cx + hw, cy - hh + c * 0.55],
    [cx + hw, cy + hh - c * 1.15],
    [cx + hw - c * 1.15, cy + hh],
    [cx - hw + c * 1.15, cy + hh],
    [cx - hw, cy + hh - c * 1.15],
    [cx - hw, cy - hh + c * 0.55],
  ];
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

export function generateBlueprintSvg(
  params: SlabParameters,
  metrics: EngineeringMetrics,
  options: BlueprintSvgOptions = {}
): string {
  const style: EmbedBlueprintStyle = options.style || 'exploded-blueprint';
  const explode = options.explode ?? (style === 'exploded-blueprint' || options.view === 'exploded');
  const showHud = options.hud ?? true;
  const poly = POLYMER_SPECS[params.polymerGrade];

  const W = 1200;
  const H = 720;

  // Front elevation scale (mm -> px)
  const scale = 3.65;
  const slabPxW = params.overallWidthMm * scale;
  const slabPxH = params.overallHeightMm * scale;
  const chamferPx = Math.min(params.shoulderChamferMm, params.overallWidthMm * 0.25) * scale;
  const frontCx = 250;
  const frontCy = 352;

  const frontTop = frontCy - slabPxH / 2;
  const frontLeft = frontCx - slabPxW / 2;
  const frontRight = frontCx + slabPxW / 2;
  const frontBottom = frontCy + slabPxH / 2;

  // Cavity center (card centered at y = -14mm in slab local space -> +14mm down in SVG)
  const cavPxW = metrics.internalCavityWidthMm * scale;
  const cavPxH = metrics.internalCavityHeightMm * scale;
  const cavCy = frontCy + 14 * scale;

  const cardPxW = params.cardWidthMm * scale;
  const cardPxH = params.cardHeightMm * scale;

  // Upper label bay
  const labelPxW = params.labelWidthMm * scale;
  const labelPxH = params.labelHeightMm * scale;
  const labelCy = frontTop + (6 + params.labelHeightMm / 2) * scale;

  // NFC pocket (right half of upper label bay)
  const nfcPxW = params.nfcPocketWidthMm * scale;
  const nfcPxH = params.nfcPocketHeightMm * scale;
  const nfcCx = frontCx + (params.labelWidthMm / 2 - params.nfcPocketWidthMm / 2 - 2) * scale;
  const nfcCy = labelCy;

  // Concentric coil turns
  const coilLines: string[] = [];
  const coilMax = Math.min(params.antennaOuterWidthMm, params.antennaOuterHeightMm) * scale;
  const turnCount = Math.max(3, Math.min(10, Math.round(params.antennaTurns)));
  for (let i = 0; i < turnCount; i++) {
    const frac = 1 - (i * 0.62) / turnCount;
    const sz = coilMax * frac;
    coilLines.push(
      `<rect x="${(nfcCx - sz / 2).toFixed(1)}" y="${(nfcCy - sz / 2).toFixed(1)}" width="${sz.toFixed(1)}" height="${sz.toFixed(1)}" rx="2" fill="none" stroke="#F59E0B" stroke-width="1.2" opacity="0.92" />`
    );
  }

  // Exploded Z-axis stackup layers (right side)
  const stackBaseX = 648;
  const stackCy = 365;
  const gap = explode ? 42 : 12;
  const layers: { label: string; sub: string; x: number; w: number; h: number; color: string; fill: string }[] = [
    {
      label: '01 REAR OPTICAL SHELL',
      sub: `${params.wallThicknessMm.toFixed(2)} mm`,
      x: stackBaseX - gap * 2.2,
      w: 14,
      h: 410,
      color: '#38BDF8',
      fill: 'rgba(56,189,248,0.12)',
    },
    {
      label: '02 SHEAR PINS & WELD',
      sub: `${params.weldRidgeWidthMm.toFixed(2)} mm`,
      x: stackBaseX - gap * 1.2,
      w: 8,
      h: 392,
      color: '#7DD3FC',
      fill: 'rgba(125,211,252,0.18)',
    },
    {
      label: '03 RETENTION CRADLE',
      sub: `${metrics.internalCavityWidthMm} × ${metrics.internalCavityHeightMm}`,
      x: stackBaseX - gap * 0.3,
      w: 12,
      h: 332,
      color: '#93C5FD',
      fill: 'rgba(147,197,253,0.14)',
    },
    {
      label: '04 CARD + SLEEVE',
      sub: `${params.cardThicknessMm.toFixed(2)} mm`,
      x: stackBaseX + gap * 0.55,
      w: 5,
      h: 312,
      color: '#E2E8F0',
      fill: 'rgba(226,232,240,0.22)',
    },
    {
      label: '05 NFC BAY & COIL',
      sub: `${turnCount}T · 13.56 MHz`,
      x: stackBaseX + gap * 1.45,
      w: 10,
      h: 92,
      color: '#F59E0B',
      fill: 'rgba(245,158,11,0.2)',
    },
    {
      label: '06 GRAPHITE COLLAR',
      sub: '2-Shot PC/ABS',
      x: stackBaseX + gap * 2.2,
      w: 12,
      h: 406,
      color: '#64748B',
      fill: 'rgba(100,116,139,0.28)',
    },
    {
      label: '07 FRONT OPTICAL SHELL',
      sub: `${params.wallThicknessMm.toFixed(2)} mm`,
      x: stackBaseX + gap * 3.2,
      w: 14,
      h: 410,
      color: '#38BDF8',
      fill: 'rgba(56,189,248,0.14)',
    },
  ];

  const layerSvg = layers
    .map((layer, idx) => {
      const yTop = idx === 4 ? stackCy - 180 : stackCy - layer.h / 2;
      const labelY = idx % 2 === 0 ? 112 + (idx / 2) * 26 : 604 + ((idx - 1) / 2) * 24;
      const anchorY = idx % 2 === 0 ? yTop : yTop + layer.h;
      return `
        <rect x="${layer.x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${layer.w}" height="${layer.h}" rx="2" fill="${layer.fill}" stroke="${layer.color}" stroke-width="1.5" />
        <line x1="${(layer.x + layer.w / 2).toFixed(1)}" y1="${anchorY.toFixed(1)}" x2="${(layer.x + layer.w / 2).toFixed(1)}" y2="${labelY}" stroke="${layer.color}" stroke-width="0.9" stroke-dasharray="3 3" opacity="0.7" />
        <text x="${(layer.x + layer.w / 2).toFixed(1)}" y="${idx % 2 === 0 ? labelY - 5 : labelY + 12}" text-anchor="middle" fill="${layer.color}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10" font-weight="600">${escapeXml(layer.label)}</text>
      `;
    })
    .join('');

  const serialSafe = escapeXml(params.serialNumber);
  const chipText =
    params.nfcChipConfig === 'ntag424_dna' ? 'NTAG424 DNA (AES-128 SUN)' : 'NTAG215 (STATIC NDEF)';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="VCA Slab CAD Blueprint ${serialSafe}">
  <defs>
    <pattern id="gridMinor" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#0F2D4A" stroke-width="0.6" />
    </pattern>
    <pattern id="gridMajor" width="120" height="120" patternUnits="userSpaceOnUse">
      <rect width="120" height="120" fill="url(#gridMinor)" />
      <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#184673" stroke-width="1.1" />
    </pattern>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
    </marker>
  </defs>

  <!-- CAD Blueprint Background -->
  <rect width="${W}" height="${H}" fill="#041224" />
  <rect width="${W}" height="${H}" fill="url(#gridMajor)" />

  <!-- Outer Drafting Sheet Frame -->
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="#38BDF8" stroke-width="1.4" opacity="0.65" />
  <rect x="26" y="26" width="${W - 52}" height="${H - 52}" fill="none" stroke="#1E3A5F" stroke-width="0.9" />

  <!-- Sheet Header -->
  <text x="42" y="54" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" font-weight="700" letter-spacing="2">VCA — VERIFIED CARD AUTHORITY · CAD ENGINEERING BLUEPRINT</text>
  <text x="42" y="72" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">PROTOTYPE ${serialSafe} · ${escapeXml(poly.name)} · PROPOSED ENGINEERING TARGETS</text>

  <!-- View Titles -->
  <text x="${frontCx}" y="94" text-anchor="middle" fill="#7DD3FC" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" font-weight="700">FRONT ORTHOGRAPHIC ELEVATION</text>
  <text x="${stackBaseX + 20}" y="82" text-anchor="middle" fill="#7DD3FC" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" font-weight="700">${explode ? 'EXPLODED Z-AXIS ASSEMBLY STACKUP' : 'ASSEMBLED Z-AXIS CROSS SECTION'}</text>

  <!-- Front Elevation Geometry -->
  <polygon points="${chamferPolygonPoints(frontCx, frontCy, slabPxW, slabPxH, chamferPx)}" fill="rgba(14,165,233,0.06)" stroke="#38BDF8" stroke-width="2" />
  <polygon points="${chamferPolygonPoints(frontCx, frontCy, slabPxW - 14, slabPxH - 14, Math.max(4, chamferPx - 5))}" fill="none" stroke="#38BDF8" stroke-width="0.9" stroke-dasharray="6 4" opacity="0.7" />

  <!-- Upper Certification Label Bay & QR/NFC Compartment -->
  <rect x="${(frontCx - labelPxW / 2).toFixed(1)}" y="${(labelCy - labelPxH / 2).toFixed(1)}" width="${labelPxW.toFixed(1)}" height="${labelPxH.toFixed(1)}" rx="6" fill="rgba(15,23,42,0.55)" stroke="#7DD3FC" stroke-width="1.3" />
  <text x="${(frontCx - labelPxW / 2 + 12).toFixed(1)}" y="${(labelCy - 10).toFixed(1)}" fill="#F8FAFC" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" font-weight="700">${serialSafe}</text>
  <text x="${(frontCx - labelPxW / 2 + 12).toFixed(1)}" y="${(labelCy + 8).toFixed(1)}" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">${escapeXml(params.gradeLabel)}</text>

  <!-- NFC Pocket & Spiral Antenna -->
  <rect x="${(nfcCx - nfcPxW / 2).toFixed(1)}" y="${(nfcCy - nfcPxH / 2).toFixed(1)}" width="${nfcPxW.toFixed(1)}" height="${nfcPxH.toFixed(1)}" rx="4" fill="rgba(245,158,11,0.08)" stroke="#F59E0B" stroke-width="1.3" stroke-dasharray="3 2" />
  ${coilLines.join('')}
  <rect x="${(nfcCx - 5).toFixed(1)}" y="${(nfcCy - 5).toFixed(1)}" width="10" height="10" rx="1.5" fill="#F59E0B" />

  <!-- Card Retention Cradle & Trading Card Envelope -->
  <rect x="${(frontCx - cavPxW / 2).toFixed(1)}" y="${(cavCy - cavPxH / 2).toFixed(1)}" width="${cavPxW.toFixed(1)}" height="${cavPxH.toFixed(1)}" rx="6" fill="rgba(56,189,248,0.05)" stroke="#38BDF8" stroke-width="1.2" />
  <rect x="${(frontCx - cardPxW / 2).toFixed(1)}" y="${(cavCy - cardPxH / 2).toFixed(1)}" width="${cardPxW.toFixed(1)}" height="${cardPxH.toFixed(1)}" rx="4" fill="rgba(241,245,249,0.04)" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="5 3" />
  <text x="${frontCx}" y="${(cavCy - 8).toFixed(1)}" text-anchor="middle" fill="#E2E8F0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">CARD CAVITY: ${metrics.internalCavityWidthMm} × ${metrics.internalCavityHeightMm} mm</text>
  <text x="${frontCx}" y="${(cavCy + 10).toFixed(1)}" text-anchor="middle" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">CARD TARGET: ${params.cardWidthMm.toFixed(1)} × ${params.cardHeightMm.toFixed(1)} mm</text>

  <!-- 4 Tamper-Evident Micro Shear Pins -->
  <circle cx="${(frontLeft + 20).toFixed(1)}" cy="${(frontTop + 44).toFixed(1)}" r="4" fill="none" stroke="#38BDF8" stroke-width="1.5" />
  <circle cx="${(frontRight - 20).toFixed(1)}" cy="${(frontTop + 44).toFixed(1)}" r="4" fill="none" stroke="#38BDF8" stroke-width="1.5" />
  <circle cx="${(frontLeft + 20).toFixed(1)}" cy="${(frontBottom - 34).toFixed(1)}" r="4" fill="none" stroke="#38BDF8" stroke-width="1.5" />
  <circle cx="${(frontRight - 20).toFixed(1)}" cy="${(frontBottom - 34).toFixed(1)}" r="4" fill="none" stroke="#38BDF8" stroke-width="1.5" />

  <!-- Dimension Lines (Width & Height) -->
  <line x1="${frontLeft.toFixed(1)}" y1="${(frontBottom + 24).toFixed(1)}" x2="${frontRight.toFixed(1)}" y2="${(frontBottom + 24).toFixed(1)}" stroke="#38BDF8" stroke-width="1.2" marker-start="url(#arrow)" marker-end="url(#arrow)" />
  <text x="${frontCx}" y="${(frontBottom + 42).toFixed(1)}" text-anchor="middle" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" font-weight="700">W = ${params.overallWidthMm.toFixed(1)} mm (±${params.assemblyToleranceMm.toFixed(2)})</text>

  <line x1="${(frontLeft - 24).toFixed(1)}" y1="${frontTop.toFixed(1)}" x2="${(frontLeft - 24).toFixed(1)}" y2="${frontBottom.toFixed(1)}" stroke="#38BDF8" stroke-width="1.2" marker-start="url(#arrow)" marker-end="url(#arrow)" />
  <text x="${(frontLeft - 34).toFixed(1)}" y="${frontCy}" text-anchor="middle" transform="rotate(-90 ${(frontLeft - 34).toFixed(1)} ${frontCy})" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" font-weight="700">H = ${params.overallHeightMm.toFixed(1)} mm</text>

  <!-- Right Side Exploded Stackup -->
  <line x1="${stackBaseX - 115}" y1="${stackCy}" x2="${stackBaseX + 170}" y2="${stackCy}" stroke="#1E3A5F" stroke-width="1" stroke-dasharray="8 4" />
  ${layerSvg}

  ${
    showHud
      ? `<!-- Engineering Title & Specification Block -->
  <rect x="880" y="96" width="278" height="390" rx="6" fill="rgba(4,18,36,0.9)" stroke="#38BDF8" stroke-width="1.2" opacity="0.95" />
  <text x="896" y="122" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" font-weight="700">ENGINEERING PARAMETERS</text>
  <line x1="896" y1="132" x2="1142" y2="132" stroke="#1E3A5F" stroke-width="1" />
  <text x="896" y="154" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">ENVELOPE: ${params.overallWidthMm.toFixed(1)} × ${params.overallHeightMm.toFixed(1)} × ${params.overallThicknessMm.toFixed(1)} mm</text>
  <text x="896" y="176" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">SHELL WALL: ${params.wallThicknessMm.toFixed(2)} mm · DRAFT ${params.draftAngleDeg.toFixed(1)}°</text>
  <text x="896" y="198" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">CHAMFER: ${params.shoulderChamferMm.toFixed(1)} mm · R${params.cornerRadiusMm.toFixed(1)}</text>
  <text x="896" y="220" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">CAVITY DEPTH: ${metrics.internalCavityDepthMm} mm</text>
  <text x="896" y="242" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">EST. MASS: ${metrics.estimatedTotalMassG} g</text>
  <line x1="896" y1="260" x2="1142" y2="260" stroke="#1E3A5F" stroke-width="1" />
  <text x="896" y="282" fill="#F59E0B" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" font-weight="700">NFC ACCESS HARDWARE</text>
  <text x="896" y="304" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">${escapeXml(chipText)}</text>
  <text x="896" y="326" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">COIL: ${params.antennaOuterWidthMm} × ${params.antennaOuterHeightMm} mm · ${turnCount} TURNS</text>
  <text x="896" y="348" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">INDUCTANCE: ${metrics.estimatedInductanceUh} uH @ 13.56 MHz</text>
  <text x="896" y="370" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">TUNING CAP: ${metrics.requiredTuningCapacitancePf} pF</text>
  <text x="896" y="392" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">EST. READ: ~${metrics.estimatedReadRangeMm} mm</text>
  <line x1="896" y1="412" x2="1142" y2="412" stroke="#1E3A5F" stroke-width="1" />
  <text x="896" y="434" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5">NFC ACTS STRICTLY AS ACCESS KEY.</text>
  <text x="896" y="450" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5">DIGITAL CERTIFICATE LIVES OFF-CHIP.</text>
  <text x="896" y="468" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5">VCA · vcaslabs.com</text>`
      : ''
  }
</svg>`;
}
