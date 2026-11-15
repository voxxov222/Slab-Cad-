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

/**
 * Generates a self-contained animated 3D isometric CAD SVG compatible with GitHub README <img> rendering
 * (pure CSS keyframes + SVG geometry, zero external scripts).
 */
export function generateAnimatedCadSvg(
  params: SlabParameters,
  metrics: EngineeringMetrics,
  contactEmail: string = 'tosmond@vcaslabs.com'
): string {
  const W = 1200;
  const H = 640;
  const poly = POLYMER_SPECS[params.polymerGrade];
  const serialSafe = escapeXml(params.serialNumber);
  const emailSafe = escapeXml(contactEmail.trim() || 'tosmond@vcaslabs.com');
  const turnCount = Math.max(3, Math.min(10, Math.round(params.antennaTurns)));
  const chipLabel =
    params.nfcChipConfig === 'ntag424_dna'
      ? 'NTAG424 DNA · AES-128 SUN'
      : 'NTAG215 · STATIC NDEF';

  // Proportional slab sizing for isometric 3D card presentation
  const scale = 2.45;
  const pw = params.overallWidthMm * scale;
  const ph = params.overallHeightMm * scale;
  const pchamfer = Math.min(params.shoulderChamferMm, params.overallWidthMm * 0.24) * scale;
  const cavW = metrics.internalCavityWidthMm * scale;
  const cavH = metrics.internalCavityHeightMm * scale;
  const cardW = params.cardWidthMm * scale;
  const cardH = params.cardHeightMm * scale;
  const labelW = params.labelWidthMm * scale;
  const labelH = params.labelHeightMm * scale;
  const nfcW = params.nfcPocketWidthMm * scale;
  const nfcH = params.nfcPocketHeightMm * scale;

  const isoBaseX = 415;
  const isoBaseY = 368;
  const slabPts = chamferPolygonPoints(0, 0, pw, ph, pchamfer);
  const innerRimPts = chamferPolygonPoints(0, 0, pw - 14, ph - 14, Math.max(4, pchamfer - 4));
  const cradlePts = chamferPolygonPoints(0, 0, pw - 18, ph - 18, Math.max(4, pchamfer - 5));

  // Oblique isometric projection vector along +Z assembly axis
  const dx = 36;
  const dy = -13;

  // Build coil spiral SVG lines centered on upper-right NFC pocket
  const labelCenterY = -ph / 2 + (6 + params.labelHeightMm / 2) * scale;
  const nfcCenterX = (params.labelWidthMm / 2 - params.nfcPocketWidthMm / 2 - 2) * scale;
  const coilMax = Math.min(params.antennaOuterWidthMm, params.antennaOuterHeightMm) * scale;
  const coilShapes: string[] = [];
  for (let i = 0; i < turnCount; i++) {
    const frac = 1 - (i * 0.62) / turnCount;
    const sz = coilMax * frac;
    coilShapes.push(
      `<rect x="${(nfcCenterX - sz / 2).toFixed(1)}" y="${(labelCenterY - sz / 2).toFixed(1)}" width="${sz.toFixed(1)}" height="${sz.toFixed(1)}" rx="2" fill="none" stroke="#F59E0B" stroke-width="1.3" opacity="0.95" />`
    );
  }

  // Generate 7 animated Z-layers keyframes (assembled at 0-12%, exploded inspection 35-68%, collapsed 88-100%)
  const layerFactors = [-3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.1];
  const keyframeCss = layerFactors
    .map((f, idx) => {
      const tx = (f * dx).toFixed(1);
      const ty = (f * dy).toFixed(1);
      const restTx = (f * dx * 0.16).toFixed(1);
      const restTy = (f * dy * 0.16).toFixed(1);
      return `
      @keyframes vcaLayer${idx} {
        0%, 10% { transform: translate(${restTx}px, ${restTy}px); }
        34%, 68% { transform: translate(${tx}px, ${ty}px); }
        90%, 100% { transform: translate(${restTx}px, ${restTy}px); }
      }
      .vca-l${idx} { animation: vcaLayer${idx} 8.5s cubic-bezier(0.45, 0.05, 0.25, 1) infinite; }`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="VCA Live 3D Animated CAD Specification ${serialSafe}">
  <defs>
    <style>
      ${keyframeCss}
      @keyframes vcaRfPulse {
        0%, 100% { opacity: 0.15; transform: scale(0.85); }
        50% { opacity: 0.9; transform: scale(1.25); }
      }
      @keyframes vcaScanSweep {
        0% { transform: translateY(-170px); opacity: 0; }
        15% { opacity: 0.85; }
        85% { opacity: 0.85; }
        100% { transform: translateY(170px); opacity: 0; }
      }
      @keyframes vcaOrbitBeacon {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 1; }
      }
      .vca-rf-wave {
        transform-box: fill-box;
        transform-origin: center;
        animation: vcaRfPulse 2.4s ease-in-out infinite;
      }
      .vca-scan {
        animation: vcaScanSweep 4.2s linear infinite;
      }
      .vca-live-dot {
        animation: vcaOrbitBeacon 1.6s ease-in-out infinite;
      }
    </style>
    <pattern id="isoMinor" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#0C223B" stroke-width="0.6" />
    </pattern>
    <pattern id="isoMajor" width="120" height="120" patternUnits="userSpaceOnUse">
      <rect width="120" height="120" fill="url(#isoMinor)" />
      <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#14375C" stroke-width="1.1" />
    </pattern>
    <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.24" />
      <stop offset="48%" stop-color="#0EA5E9" stop-opacity="0.06" />
      <stop offset="100%" stop-color="#E0F2FE" stop-opacity="0.22" />
    </linearGradient>
    <linearGradient id="scanBeamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0" />
      <stop offset="50%" stop-color="#38BDF8" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="stageGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0EA5E9" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#040B16" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Deep Graphite Blueprint Canvas -->
  <rect width="${W}" height="${H}" fill="#040B16" />
  <rect width="${W}" height="${H}" fill="url(#isoMajor)" />
  <ellipse cx="420" cy="565" rx="340" ry="44" fill="url(#stageGlow)" />

  <!-- Outer CAD Drafting Sheet Border -->
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="8" fill="none" stroke="#1E3A5F" stroke-width="1.4" />
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="6" fill="none" stroke="#0F2640" stroke-width="0.9" />

  <!-- Top Telemetry Title Strip -->
  <circle cx="44" cy="48" r="5" fill="#10B981" class="vca-live-dot" />
  <text x="58" y="52" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" font-weight="700" letter-spacing="1.6">VCA — VERIFIED CARD AUTHORITY · LIVE 3D EXPLODED CAD PREVIEW</text>
  <text x="42" y="72" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">PROTOTYPE ${serialSafe} · ${escapeXml(poly.name)} · CLICK TO LAUNCH INTERACTIVE 3D VIEWPORT</text>

  <!-- Isometric Z-Axis Explosion Guide Line -->
  <line x1="${isoBaseX - dx * 6.2}" y1="${isoBaseY - dy * 6.2}" x2="${isoBaseX + dx * 6.4}" y2="${isoBaseY + dy * 6.4}" stroke="#1E3A5F" stroke-width="1.4" stroke-dasharray="6 5" />
  <text x="${isoBaseX - dx * 6.2}" y="${isoBaseY - dy * 6.2 + 22}" fill="#64748B" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">-Z REAR SHELL</text>
  <text x="${isoBaseX + dx * 4.5}" y="${isoBaseY + dy * 4.5 - 12}" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">+Z FRONT SHELL</text>

  <!-- Animated 3D Oblique Slab Assembly (7 Z-Axis Layers) -->
  <g transform="translate(${isoBaseX}, ${isoBaseY}) skewY(-13) scale(0.86, 1)">

    <!-- Layer 0: #12 Rear Optical Polycarbonate Shell -->
    <g class="vca-l0">
      <polygon points="${slabPts}" fill="url(#glassGrad)" stroke="#38BDF8" stroke-width="1.8" />
      <polygon points="${innerRimPts}" fill="none" stroke="#7DD3FC" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.65" />
      <text x="0" y="${(ph / 2 - 14).toFixed(1)}" text-anchor="middle" fill="#7DD3FC" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9" font-weight="700">#12 REAR OPTICAL SHELL</text>
    </g>

    <!-- Layer 1: #11 Ultrasonic Energy Director + 4 Corner Shear Pins -->
    <g class="vca-l1">
      <polygon points="${innerRimPts}" fill="rgba(56,189,248,0.06)" stroke="#7DD3FC" stroke-width="1.4" stroke-dasharray="8 4" />
      <circle cx="${(-pw / 2 + 16).toFixed(1)}" cy="${(-ph / 2 + 34).toFixed(1)}" r="4" fill="#38BDF8" />
      <circle cx="${(pw / 2 - 16).toFixed(1)}" cy="${(-ph / 2 + 34).toFixed(1)}" r="4" fill="#38BDF8" />
      <circle cx="${(-pw / 2 + 16).toFixed(1)}" cy="${(ph / 2 - 24).toFixed(1)}" r="4" fill="#38BDF8" />
      <circle cx="${(pw / 2 - 16).toFixed(1)}" cy="${(ph / 2 - 24).toFixed(1)}" r="4" fill="#38BDF8" />
      <text x="0" y="${(ph / 2 - 12).toFixed(1)}" text-anchor="middle" fill="#93C5FD" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="8.5">#11 20kHz WELD RIDGE + 4 PINS</text>
    </g>

    <!-- Layer 2: #10 Zero-Pinch Card Retention Cradle -->
    <g class="vca-l2">
      <polygon points="${cradlePts}" fill="rgba(15,23,42,0.45)" stroke="#60A5FA" stroke-width="1.4" />
      <rect x="${(-cavW / 2).toFixed(1)}" y="${(14 * scale - cavH / 2).toFixed(1)}" width="${cavW.toFixed(1)}" height="${cavH.toFixed(1)}" rx="5" fill="rgba(4,18,36,0.65)" stroke="#38BDF8" stroke-width="1.3" />
      <text x="0" y="${(14 * scale + cavH / 2 - 10).toFixed(1)}" text-anchor="middle" fill="#93C5FD" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="8.5">#10 RETENTION CRADLE</text>
    </g>

    <!-- Layer 3: #08 / #09 Archival Inner Sleeve + Encapsulated Trading Card -->
    <g class="vca-l3">
      <rect x="${(-cardW / 2 - 4).toFixed(1)}" y="${(14 * scale - cardH / 2 - 4).toFixed(1)}" width="${(cardW + 8).toFixed(1)}" height="${(cardH + 8).toFixed(1)}" rx="4" fill="rgba(226,232,240,0.08)" stroke="#94A3B8" stroke-width="1" stroke-dasharray="4 2" />
      <rect x="${(-cardW / 2).toFixed(1)}" y="${(14 * scale - cardH / 2).toFixed(1)}" width="${cardW.toFixed(1)}" height="${cardH.toFixed(1)}" rx="3" fill="rgba(30,58,95,0.62)" stroke="#E2E8F0" stroke-width="1.4" />
      <rect x="${(-cardW / 2 + 12).toFixed(1)}" y="${(14 * scale - cardH / 2 + 16).toFixed(1)}" width="${(cardW - 24).toFixed(1)}" height="${(cardH * 0.48).toFixed(1)}" rx="2" fill="rgba(56,189,248,0.16)" stroke="#38BDF8" stroke-width="0.9" />
      <text x="0" y="${(14 * scale + 34).toFixed(1)}" text-anchor="middle" fill="#F8FAFC" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5" font-weight="700">#09 CERTIFIED CARD</text>
      <text x="0" y="${(14 * scale + 49).toFixed(1)}" text-anchor="middle" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="8">${params.cardWidthMm} × ${params.cardHeightMm} mm</text>
    </g>

    <!-- Layer 4: #05 / #06 / #07 Upper Certification Label + Recessed NFC Bay + 13.56 MHz Spiral Coil -->
    <g class="vca-l4">
      <rect x="${(-labelW / 2).toFixed(1)}" y="${(labelCenterY - labelH / 2).toFixed(1)}" width="${labelW.toFixed(1)}" height="${labelH.toFixed(1)}" rx="5" fill="rgba(15,23,42,0.88)" stroke="#7DD3FC" stroke-width="1.5" />
      <text x="${(-labelW / 2 + 10).toFixed(1)}" y="${(labelCenterY - 7).toFixed(1)}" fill="#F8FAFC" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5" font-weight="700">${serialSafe}</text>
      <text x="${(-labelW / 2 + 10).toFixed(1)}" y="${(labelCenterY + 8).toFixed(1)}" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="8">${escapeXml(params.gradeLabel)}</text>
      <rect x="${(nfcCenterX - nfcW / 2).toFixed(1)}" y="${(labelCenterY - nfcH / 2).toFixed(1)}" width="${nfcW.toFixed(1)}" height="${nfcH.toFixed(1)}" rx="3" fill="rgba(245,158,11,0.12)" stroke="#F59E0B" stroke-width="1.3" />
      ${coilShapes.join('')}
      <rect x="${(nfcCenterX - 4.5).toFixed(1)}" y="${(labelCenterY - 4.5).toFixed(1)}" width="9" height="9" rx="1.5" fill="#F59E0B" />
      <!-- Pulsing 13.56 MHz RF Coupling Field Rings -->
      <circle cx="${nfcCenterX.toFixed(1)}" cy="${labelCenterY.toFixed(1)}" r="24" fill="none" stroke="#38BDF8" stroke-width="1.4" stroke-dasharray="4 3" class="vca-rf-wave" />
      <circle cx="${nfcCenterX.toFixed(1)}" cy="${labelCenterY.toFixed(1)}" r="34" fill="none" stroke="#F59E0B" stroke-width="1" stroke-dasharray="3 4" class="vca-rf-wave" />
    </g>

    <!-- Layer 5: #02 Graphite Structural Perimeter Frame Collar -->
    <g class="vca-l5">
      <polygon points="${slabPts}" fill="none" stroke="#475569" stroke-width="7" opacity="0.72" />
      <polygon points="${slabPts}" fill="none" stroke="#94A3B8" stroke-width="1.1" />
      <text x="0" y="${(ph / 2 + 16).toFixed(1)}" text-anchor="middle" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="8.5">#02 2-SHOT GRAPHITE COLLAR</text>
    </g>

    <!-- Layer 6: #01 Front Crystal-Clear Optical Shell + Optical Scan Sweep -->
    <g class="vca-l6">
      <polygon points="${slabPts}" fill="url(#glassGrad)" stroke="#38BDF8" stroke-width="2.1" />
      <rect x="${(-pw / 2 + 8).toFixed(1)}" y="-14" width="${(pw - 16).toFixed(1)}" height="28" fill="url(#scanBeamGrad)" class="vca-scan" />
      <text x="0" y="${(ph / 2 + 30).toFixed(1)}" text-anchor="middle" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5" font-weight="700">#01 FRONT OPTICAL HOUSING (${params.wallThicknessMm.toFixed(2)} mm)</text>
    </g>

  </g>

  <!-- Right-Side Manufacturer Specification & Contact Card -->
  <rect x="780" y="96" width="386" height="504" rx="8" fill="rgba(6,17,32,0.94)" stroke="#1E3A5F" stroke-width="1.4" />
  <rect x="780" y="96" width="386" height="36" rx="8" fill="rgba(14,165,233,0.12)" />
  <text x="798" y="119" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11.5" font-weight="700">MANUFACTURING &amp; CAD REQUIREMENTS</text>

  <text x="798" y="156" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">EXTERIOR ENVELOPE (PROPOSED)</text>
  <text x="798" y="174" fill="#F8FAFC" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" font-weight="700">${params.overallWidthMm.toFixed(1)} × ${params.overallHeightMm.toFixed(1)} × ${params.overallThicknessMm.toFixed(1)} mm (±${params.assemblyToleranceMm.toFixed(2)})</text>

  <text x="798" y="204" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">OPTICAL POLYMER &amp; TOOL FINISH</text>
  <text x="798" y="222" fill="#E2E8F0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">${escapeXml(poly.name)}</text>
  <text x="798" y="239" fill="#7DD3FC" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">SPI A-1 Polish Window · VDI 24–27 Matte Rim</text>

  <text x="798" y="269" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">ZERO-PINCH CAVITY &amp; ULTRASONIC SEAL</text>
  <text x="798" y="287" fill="#E2E8F0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">Cavity: ${metrics.internalCavityWidthMm} × ${metrics.internalCavityHeightMm} × ${metrics.internalCavityDepthMm} mm</text>
  <text x="798" y="304" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">20 kHz Weld (${params.weldRidgeWidthMm.toFixed(2)}×${params.weldRidgeHeightMm.toFixed(2)}mm) + 4 Shear Pins</text>

  <text x="798" y="334" fill="#F59E0B" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10" font-weight="700">13.56 MHz NFC ACCESS HARDWARE</text>
  <text x="798" y="352" fill="#E2E8F0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">${escapeXml(chipLabel)}</text>
  <text x="798" y="369" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">Spiral: ${params.antennaOuterWidthMm}×${params.antennaOuterHeightMm} mm · ${turnCount}T · ${metrics.estimatedInductanceUh} uH</text>

  <text x="798" y="399" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">MOULD SHRINKAGE &amp; CLAMP ESTIMATE</text>
  <text x="798" y="417" fill="#E2E8F0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">${metrics.nominalShrinkagePct}% (${metrics.compensatedToolWidthMm}×${metrics.compensatedToolHeightMm} mm tool)</text>
  <text x="798" y="434" fill="#CBD5E1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5">Est. Mass: ${metrics.estimatedTotalMassG} g · ~${metrics.estimatedClampingForceTons} US Tons (2-Cav)</text>

  <line x1="798" y1="454" x2="1148" y2="454" stroke="#1E3A5F" stroke-width="1" />

  <!-- Contact Banner -->
  <rect x="798" y="468" width="350" height="72" rx="6" fill="rgba(14,165,233,0.12)" stroke="#38BDF8" stroke-width="1.1" />
  <text x="812" y="490" fill="#7DD3FC" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10" font-weight="700">MANUFACTURER &amp; ENGINEERING CONTACT</text>
  <text x="812" y="512" fill="#FFFFFF" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13.5" font-weight="700">${emailSafe}</text>
  <text x="812" y="530" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5">vcaslabs.com · Formal DFM Confirmation Required</text>

  <!-- Interactive Launch Hint -->
  <text x="798" y="574" fill="#38BDF8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5" font-weight="700">▶ CLICK PREVIEW TO ORBIT LIVE 3D CAD &amp; DOWNLOAD</text>
  <text x="798" y="590" fill="#64748B" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5">Downloads: STL · DXF · OpenSCAD · BOM CSV · RFQ Spec</text>
</svg>`;
}

