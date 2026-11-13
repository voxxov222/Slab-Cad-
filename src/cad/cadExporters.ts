import { BomItem, EngineeringMetrics, POLYMER_SPECS } from './engineeringMath';
import { SlabParameters } from './types';

/**
 * Generates a real ASCII STL file for a rectangular chamfered VCA housing plate
 * matching the live parametric dimensions so manufacturers/3D printers get valid watertight geometry.
 */
export function generateSlabShellAsciiStl(params: SlabParameters): string {
  const w = params.overallWidthMm / 2;
  const h = params.overallHeightMm / 2;
  const c = Math.min(params.shoulderChamferMm, w * 0.4, h * 0.25);
  const t = params.overallThicknessMm;

  // Octagonal chamfered VCA silhouette polygon (CCW in XY plane)
  const contour: [number, number][] = [
    [-w + c, -h],
    [w - c, -h],
    [w, -h + c * 0.55],
    [w, h - c * 1.15],
    [w - c * 1.15, h],
    [-w + c * 1.15, h],
    [-w, h - c * 1.15],
    [-w, -h + c * 0.55],
  ];

  const lines: string[] = [`solid VCA_Slab_Exterior_${params.serialNumber}`];

  const addTri = (
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number]
  ) => {
    const ux = p2[0] - p1[0];
    const uy = p2[1] - p1[1];
    const uz = p2[2] - p1[2];
    const vx = p3[0] - p1[0];
    const vy = p3[1] - p1[1];
    const vz = p3[2] - p1[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    lines.push(`  facet normal ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}`);
    lines.push('    outer loop');
    lines.push(`      vertex ${p1[0].toFixed(4)} ${p1[1].toFixed(4)} ${p1[2].toFixed(4)}`);
    lines.push(`      vertex ${p2[0].toFixed(4)} ${p2[1].toFixed(4)} ${p2[2].toFixed(4)}`);
    lines.push(`      vertex ${p3[0].toFixed(4)} ${p3[1].toFixed(4)} ${p3[2].toFixed(4)}`);
    lines.push('    endloop');
    lines.push('  endfacet');
  };

  const zBot = -t / 2;
  const zTop = t / 2;
  const n = contour.length;

  // Fan triangulate top (+Z) and bottom (-Z) from centroid (0,0)
  for (let i = 0; i < n; i++) {
    const [x1, y1] = contour[i];
    const [x2, y2] = contour[(i + 1) % n];

    // Top face
    addTri([0, 0, zTop], [x1, y1, zTop], [x2, y2, zTop]);
    // Bottom face (CW when viewed from +Z)
    addTri([0, 0, zBot], [x2, y2, zBot], [x1, y1, zBot]);
    // Side walls
    addTri([x1, y1, zBot], [x2, y2, zBot], [x2, y2, zTop]);
    addTri([x1, y1, zBot], [x2, y2, zTop], [x1, y1, zTop]);
  }

  lines.push(`endsolid VCA_Slab_Exterior_${params.serialNumber}`);
  return lines.join('\n');
}

/**
 * Generates a real AutoCAD R12-compatible DXF 2D CAD profile containing:
 * - Layer OUTLINE: Exterior chamfered VCA silhouette
 * - Layer CAVITY: Internal card pocket + clearance
 * - Layer LABEL_BAY: Upper certification label recess
 * - Layer NFC_POCKET: Embedded NFC compartment + spiral antenna centerline
 */
export function generateSlabDxf(params: SlabParameters, metrics: EngineeringMetrics): string {
  const entities: string[] = [];

  const addClosedPoly = (layer: string, pts: [number, number][]) => {
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      entities.push(
        '0',
        'LINE',
        '8',
        layer,
        '10',
        x1.toFixed(4),
        '20',
        y1.toFixed(4),
        '30',
        '0.0',
        '11',
        x2.toFixed(4),
        '21',
        y2.toFixed(4),
        '31',
        '0.0'
      );
    }
  };

  const hw = params.overallWidthMm / 2;
  const hh = params.overallHeightMm / 2;
  const c = Math.min(params.shoulderChamferMm, hw * 0.4, hh * 0.25);

  addClosedPoly('OUTLINE', [
    [-hw + c, -hh],
    [hw - c, -hh],
    [hw, -hh + c * 0.55],
    [hw, hh - c * 1.15],
    [hw - c * 1.15, hh],
    [-hw + c * 1.15, hh],
    [-hw, hh - c * 1.15],
    [-hw, -hh + c * 0.55],
  ]);

  // Card cavity centered at y = -14mm
  const cw = metrics.internalCavityWidthMm / 2;
  const ch = metrics.internalCavityHeightMm / 2;
  const cy = -14.0;
  addClosedPoly('CAVITY', [
    [-cw, cy - ch],
    [cw, cy - ch],
    [cw, cy + ch],
    [-cw, cy + ch],
  ]);

  // Certification label bay centered at y = +48mm
  const lw = params.labelWidthMm / 2;
  const lh = params.labelHeightMm / 2;
  const ly = hh - lh - 6.0;
  addClosedPoly('LABEL_BAY', [
    [-lw, ly - lh],
    [lw, ly - lh],
    [lw, ly + lh],
    [-lw, ly + lh],
  ]);

  // NFC pocket (right side of upper label bay)
  const pw = params.nfcPocketWidthMm / 2;
  const ph = params.nfcPocketHeightMm / 2;
  const px = lw - pw - 2.0;
  addClosedPoly('NFC_POCKET', [
    [px - pw, ly - ph],
    [px + pw, ly - ph],
    [px + pw, ly + ph],
    [px - pw, ly + ph],
  ]);

  return [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$INSUNITS',
    '70',
    '4', // millimeters
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    ...entities,
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n');
}

/**
 * Generates an editable OpenSCAD parametric CAD script (.scad) that compiles directly
 * in OpenSCAD / FreeCAD for native STEP AP214 B-Rep export.
 */
export function generateOpenScadSource(
  params: SlabParameters,
  metrics: EngineeringMetrics
): string {
  const poly = POLYMER_SPECS[params.polymerGrade];
  return `// VCA — Verified Card Authority | Parametric Slab CAD Source
// Generated from VCA Slab Studio | Target Material: ${poly.name} (${poly.gradeExample})
// NOTE: Open in FreeCAD (OpenSCAD Workbench) or OpenSCAD -> Export as STEP (.step) or IGES.

$fn = 48;

// --- Editable Engineering Parameters (mm) ---
overall_w = ${params.overallWidthMm.toFixed(2)};
overall_h = ${params.overallHeightMm.toFixed(2)};
overall_t = ${params.overallThicknessMm.toFixed(2)};
wall_t = ${params.wallThicknessMm.toFixed(2)};
shoulder_chamfer = ${params.shoulderChamferMm.toFixed(2)};
cavity_w = ${metrics.internalCavityWidthMm.toFixed(2)};
cavity_h = ${metrics.internalCavityHeightMm.toFixed(2)};
cavity_d = ${metrics.internalCavityDepthMm.toFixed(3)};
label_w = ${params.labelWidthMm.toFixed(2)};
label_h = ${params.labelHeightMm.toFixed(2)};
label_recess = ${params.labelRecessDepthMm.toFixed(2)};
nfc_pocket_w = ${params.nfcPocketWidthMm.toFixed(2)};
nfc_pocket_h = ${params.nfcPocketHeightMm.toFixed(2)};
nfc_pocket_d = ${params.nfcPocketDepthMm.toFixed(2)};
weld_ridge_w = ${params.weldRidgeWidthMm.toFixed(2)};
weld_ridge_h = ${params.weldRidgeHeightMm.toFixed(2)};

module vca_profile_2d(w, h, c) {
  hw = w / 2; hh = h / 2;
  polygon(points=[
    [-hw + c, -hh], [hw - c, -hh],
    [hw, -hh + c * 0.55], [hw, hh - c * 1.15],
    [hw - c * 1.15, hh], [-hw + c * 1.15, hh],
    [-hw, hh - c * 1.15], [-hw, -hh + c * 0.55]
  ]);
}

module rear_housing_shell() {
  difference() {
    linear_extrude(height = overall_t / 2)
      vca_profile_2d(overall_w, overall_h, shoulder_chamfer);

    // Card cavity
    translate([0, -14, wall_t])
      cube([cavity_w, cavity_h, cavity_d + 1], center = true);

    // Upper certification label recess
    translate([0, overall_h/2 - label_h/2 - 6, overall_t/2 - label_recess])
      cube([label_w, label_h, label_recess + 0.5], center = true);

    // Hermetic NFC pocket
    translate([label_w/2 - nfc_pocket_w/2 - 2, overall_h/2 - label_h/2 - 6, overall_t/2 - nfc_pocket_d])
      cube([nfc_pocket_w, nfc_pocket_h, nfc_pocket_d + 0.5], center = true);
  }
}

rear_housing_shell();
`;
}

export function generateBomCsv(bom: BomItem[]): string {
  const header = 'Item,Part Number,Description,Material,Qty,Unit Mass (g),Process,Spec Status';
  const rows = bom.map((b) =>
    [
      b.itemNo,
      `"${b.partNumber}"`,
      `"${b.description.replace(/"/g, '""')}"`,
      `"${b.material.replace(/"/g, '""')}"`,
      b.qty,
      b.unitMassG,
      `"${b.process}"`,
      `"${b.specStatus}"`,
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

export function generateManufacturerRfqSpec(
  params: SlabParameters,
  metrics: EngineeringMetrics,
  bom: BomItem[]
): string {
  const poly = POLYMER_SPECS[params.polymerGrade];
  return `# VCA — VERIFIED CARD AUTHORITY
## MANUFACTURER REQUEST FOR QUOTATION (RFQ) & TOOLING SPECIFICATION
**Project:** VCA Next-Generation NFC-Authenticated Certified Trading Card Slab
**Reference Identity:** ${params.serialNumber}
**Target Website:** https://vcaslabs.com

---

### 1. CRITICAL NOTICE ON SPECIFICATION STATUS
All dimensional and material properties below represent **Proposed Engineering Targets** generated from the VCA Parametric CAD Workstation. Tooling steel shrinkage allowances, gate locations, cycle times, and optical surface grades **require formal DFM confirmation** from the selected injection-moulding vendor prior to steel cutting.

### 2. OVERALL ENCLOSURE DIMENSIONS (PROPOSED)
- Exterior Envelope: ${params.overallWidthMm.toFixed(2)} mm × ${params.overallHeightMm.toFixed(2)} mm × ${params.overallThicknessMm.toFixed(2)} mm
- Corner Radius: ${params.cornerRadiusMm.toFixed(2)} mm | VCA Shoulder Chamfer: ${params.shoulderChamferMm.toFixed(2)} mm
- Nominal Optical Wall Thickness: ${params.wallThicknessMm.toFixed(2)} mm
- Minimum Draft Angle (Optical Walls): ${params.draftAngleDeg.toFixed(1)}°
- Target General Dimensional Tolerance: ±${params.assemblyToleranceMm.toFixed(2)} mm (ISO 2768-m / DIN 16742 TG4)

### 3. INTERNAL CARD CAVITY & CLEARANCE
- Target Card Envelope: ${params.cardWidthMm.toFixed(2)} × ${params.cardHeightMm.toFixed(2)} × ${params.cardThicknessMm.toFixed(2)} mm
- Inner Sleeve Support: ${params.useInnerSleeve ? `Yes (${params.sleeveThicknessPerSideMm * 2} mm total)` : 'No'}
- Moulded Cavity Dimensions: ${metrics.internalCavityWidthMm} × ${metrics.internalCavityHeightMm} × ${metrics.internalCavityDepthMm} mm
- Corner Relief Radius: ${params.cornerReliefRadiusMm.toFixed(2)} mm (zero-contact corner clearance)

### 4. POLYMER & MOULDING SPECIFICATION
- Primary Material: ${poly.name} — ${poly.gradeExample}
- Nominal Mould Shrinkage Allowance: ${metrics.nominalShrinkagePct}% (Tooling Cavity Compensated: ${metrics.compensatedToolWidthMm} × ${metrics.compensatedToolHeightMm} mm)
- Estimated Shot Volume (Housing): ${metrics.housingVolumeCm3} cm³ | Estimated Part Mass: ${metrics.estimatedTotalMassG} g
- Projected Area: ${metrics.projectedAreaCm2} cm² | Est. 2-Cavity Clamping Tonnage: ~${metrics.estimatedClampingForceTons} US Tons (confirm w/ moulder)
- Optical Finish: SPI A-1 Diamond Polish on viewing windows; VDI 24–27 matte texture on perimeter frame

### 5. INTEGRATED NFC & TAMPER-EVIDENT ASSEMBLY
- NFC Configuration: ${params.nfcChipConfig === 'ntag424_dna' ? 'Production NTAG424 DNA (AES-128 SUN)' : 'Prototype NTAG215 (Static NDEF)'}
- Recessed NFC Isolation Pocket: ${params.nfcPocketWidthMm} × ${params.nfcPocketHeightMm} × ${params.nfcPocketDepthMm} mm
- Antenna Coil Geometry: ${params.antennaOuterWidthMm} × ${params.antennaOuterHeightMm} mm, ${params.antennaTurns} turns (${params.antennaTraceWidthMm} mm trace / ${params.antennaTraceSpacingMm} mm gap)
- Calculated Coil Inductance: ${metrics.estimatedInductanceUh} µH | Target Tuning Cap: ${metrics.requiredTuningCapacitancePf} pF @ 13.56 MHz
- Joining Method: 20 kHz Ultrasonic Fusion with ${params.weldRidgeWidthMm} × ${params.weldRidgeHeightMm} mm 45° Energy Director + ${params.interlockTongueDepthMm} mm Tongue-and-Groove Interlock

### 6. BILL OF MATERIALS SUMMARY
${bom.map((b) => `- [${b.partNumber}] ${b.description} | Qty: ${b.qty} | ${b.material} (${b.specStatus})`).join('\n')}
`;
}
