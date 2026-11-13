import { PolymerMaterialId, SlabParameters } from './types';

export interface PolymerSpec {
  id: PolymerMaterialId;
  name: string;
  gradeExample: string;
  densityGcm3: number;
  refractiveIndex: number;
  lightTransmittancePct: number;
  hazePct: number;
  tensileStrengthMpa: number;
  shoreHardness: string;
  moldShrinkageMinPct: number;
  moldShrinkageMaxPct: number;
  ultrasonicWeldability: 'Excellent' | 'Good' | 'Fair';
  uvResistance: string;
  scratchResistance: string;
  estimatedResinCostPerKgUsd: number;
  recommended: boolean;
  notes: string;
}

export const POLYMER_SPECS: Record<PolymerMaterialId, PolymerSpec> = {
  pc_makrolon: {
    id: 'pc_makrolon',
    name: 'Optical Polycarbonate (PC)',
    gradeExample: 'Covestro Makrolon LQ3187 / SABIC Lexan OQ1028 (Proposed)',
    densityGcm3: 1.2,
    refractiveIndex: 1.586,
    lightTransmittancePct: 89,
    hazePct: 0.7,
    tensileStrengthMpa: 65,
    shoreHardness: 'Rockwell M70 (High Impact)',
    moldShrinkageMinPct: 0.5,
    moldShrinkageMaxPct: 0.7,
    ultrasonicWeldability: 'Excellent',
    uvResistance: 'UV-stabilized optical grade recommended',
    scratchResistance: 'Moderate (optional polysiloxane hardcoat)',
    estimatedResinCostPerKgUsd: 5.8,
    recommended: true,
    notes:
      'Primary recommendation for mass production: superior impact toughness, clean 20 kHz ultrasonic hermetic weld, and archival rigidity without brittleness.',
  },
  petg_optical: {
    id: 'petg_optical',
    name: 'Optical-Grade PETG Copolyester',
    gradeExample: 'Eastman Eastar 6763 / SK Skygreen S2008 (Proposed)',
    densityGcm3: 1.27,
    refractiveIndex: 1.57,
    lightTransmittancePct: 90,
    hazePct: 0.9,
    tensileStrengthMpa: 50,
    shoreHardness: 'Rockwell R105',
    moldShrinkageMinPct: 0.2,
    moldShrinkageMaxPct: 0.5,
    ultrasonicWeldability: 'Good',
    uvResistance: 'Requires UV absorber additive for display',
    scratchResistance: 'Lower than PMMA/coated PC',
    estimatedResinCostPerKgUsd: 3.9,
    recommended: false,
    notes:
      'Lower material cost and low shrinkage, but softer surface scratches more easily and requires higher ultrasonic energy tuning.',
  },
  pmma_acrylic: {
    id: 'pmma_acrylic',
    name: 'Optical PMMA (Acrylic)',
    gradeExample: 'Altuglas V045 / Mitsubishi Acrypet VH (Proposed)',
    densityGcm3: 1.19,
    refractiveIndex: 1.49,
    lightTransmittancePct: 92,
    hazePct: 0.5,
    tensileStrengthMpa: 72,
    shoreHardness: 'Rockwell M95 (High Scratch Res.)',
    moldShrinkageMinPct: 0.3,
    moldShrinkageMaxPct: 0.6,
    ultrasonicWeldability: 'Good',
    uvResistance: 'Inherent UV stability (non-yellowing)',
    scratchResistance: 'High surface hardness',
    estimatedResinCostPerKgUsd: 4.4,
    recommended: false,
    notes:
      'Highest optical transmission (92%) and UV stability, but higher notch brittleness under drop impact compared to optical polycarbonate.',
  },
};

export interface EngineeringMetrics {
  // Cavity & Tolerance Stack-Up
  internalCavityWidthMm: number;
  internalCavityHeightMm: number;
  internalCavityDepthMm: number;
  effectiveCardPackageThicknessMm: number;
  zAxisPlayMm: number;
  minimumWallBehindNfcMm: number;
  structuralMarginOk: boolean;
  cavityClearanceOk: boolean;

  // Mass & Volume Estimates (Engineering Estimate — confirm with moulder)
  housingVolumeCm3: number;
  estimatedTotalMassG: number;
  projectedAreaCm2: number;
  estimatedClampingForceTons: number;
  compensatedToolWidthMm: number;
  compensatedToolHeightMm: number;
  nominalShrinkagePct: number;

  // NFC Antenna & RF Tuning Calculations (Wheeler Planar Spiral Model)
  antennaInnerWidthMm: number;
  antennaInnerHeightMm: number;
  antennaMeanLengthMm: number;
  antennaFillRatio: number;
  estimatedInductanceUh: number;
  requiredTuningCapacitancePf: number;
  estimatedDcResistanceOhm: number;
  estimatedQFactor: number;
  nfcFitInPocketOk: boolean;
  estimatedReadRangeMm: number;

  // Validation Warnings
  warnings: string[];
}

export function calculateEngineeringMetrics(params: SlabParameters): EngineeringMetrics {
  const spec = POLYMER_SPECS[params.polymerGrade];

  // 1. Cavity & Tolerance Stack-Up
  const sleeveExtraXY = params.useInnerSleeve ? 1.5 : 0;
  const internalCavityWidthMm = Number(
    (params.cardWidthMm + sleeveExtraXY + params.cavityClearanceXYMm * 2).toFixed(2)
  );
  const internalCavityHeightMm = Number(
    (params.cardHeightMm + sleeveExtraXY + params.cavityClearanceXYMm * 2).toFixed(2)
  );

  const sleeveZ = params.useInnerSleeve ? params.sleeveThicknessPerSideMm * 2 : 0;
  const effectiveCardPackageThicknessMm = Number((params.cardThicknessMm + sleeveZ).toFixed(3));
  const internalCavityDepthMm = Number(
    (effectiveCardPackageThicknessMm + params.cavityDepthAllowanceMm).toFixed(3)
  );
  const zAxisPlayMm = Number((internalCavityDepthMm - effectiveCardPackageThicknessMm).toFixed(3));

  const minimumWallBehindNfcMm = Number(
    (params.overallThicknessMm - params.wallThicknessMm - params.nfcPocketDepthMm).toFixed(2)
  );

  const structuralMarginOk =
    params.wallThicknessMm >= 1.2 &&
    minimumWallBehindNfcMm >= 1.0 &&
    internalCavityWidthMm + params.cardSupportRailWidthMm * 2 < params.overallWidthMm - 4.0 &&
    internalCavityHeightMm + params.labelHeightMm + 8.0 < params.overallHeightMm;

  const cavityClearanceOk =
    params.cavityClearanceXYMm >= 0.25 &&
    zAxisPlayMm >= 0.1 &&
    zAxisPlayMm <= 0.8;

  // 2. Volume, Mass & Injection Moulding Estimates
  const outerAreaMm2 =
    params.overallWidthMm * params.overallHeightMm -
    0.86 * params.cornerRadiusMm * params.cornerRadiusMm;
  const windowAreaMm2 = internalCavityWidthMm * internalCavityHeightMm;
  const solidShellVolumeMm3 =
    outerAreaMm2 * (params.wallThicknessMm * 2) +
    (outerAreaMm2 - windowAreaMm2) * Math.max(0.5, params.overallThicknessMm - params.wallThicknessMm * 2) -
    params.labelWidthMm * params.labelHeightMm * params.labelRecessDepthMm * 0.4;

  const housingVolumeCm3 = Number((Math.max(12, solidShellVolumeMm3 / 1000)).toFixed(2));
  const polymerMassG = housingVolumeCm3 * spec.densityGcm3;
  const electronicsAndLabelMassG = 1.85;
  const estimatedTotalMassG = Number((polymerMassG + electronicsAndLabelMassG).toFixed(1));

  const projectedAreaCm2 = Number((outerAreaMm2 / 100).toFixed(1));
  // Rule of thumb for optical PC: 0.45 - 0.55 tons/cm² per cavity (2-cavity mould estimate)
  const estimatedClampingForceTons = Math.round(projectedAreaCm2 * 0.52 * 2);

  const nominalShrinkagePct = Number(
    ((spec.moldShrinkageMinPct + spec.moldShrinkageMaxPct) / 2).toFixed(2)
  );
  const shrinkFactor = 1 + nominalShrinkagePct / 100;
  const compensatedToolWidthMm = Number((params.overallWidthMm * shrinkFactor).toFixed(3));
  const compensatedToolHeightMm = Number((params.overallHeightMm * shrinkFactor).toFixed(3));

  // 3. NFC Planar Rectangular Spiral Antenna Math (Modified Wheeler Formula)
  const pitchMm = params.antennaTraceWidthMm + params.antennaTraceSpacingMm;
  const radialSpanMm = params.antennaTurns * pitchMm;
  const antennaInnerWidthMm = Number(
    Math.max(2.0, params.antennaOuterWidthMm - 2 * radialSpanMm).toFixed(2)
  );
  const antennaInnerHeightMm = Number(
    Math.max(2.0, params.antennaOuterHeightMm - 2 * radialSpanMm).toFixed(2)
  );

  const dOutMm = (params.antennaOuterWidthMm + params.antennaOuterHeightMm) / 2;
  const dInMm = (antennaInnerWidthMm + antennaInnerHeightMm) / 2;
  const dAvgMm = (dOutMm + dInMm) / 2;
  const antennaFillRatio = Number(((dOutMm - dInMm) / (dOutMm + dInMm)).toFixed(3));

  // Wheeler planar square spiral approximation: L(uH) = 2.34 * mu0 * N^2 * d_avg / (1 + 2.75 * rho)
  // Using dAvg in meters -> convert H to uH
  const mu0 = 4 * Math.PI * 1e-7;
  const N = params.antennaTurns;
  const dAvgMeters = dAvgMm / 1000;
  const inductanceH =
    (2.34 * mu0 * N * N * dAvgMeters) / Math.max(0.2, 1 + 2.75 * antennaFillRatio);
  const estimatedInductanceUh = Number((inductanceH * 1e6).toFixed(2));

  // Resonance at f0 = 13.56 MHz: C = 1 / ((2 * pi * f0)^2 * L)
  const f0 = 13.56e6;
  const capacitanceF = 1 / (Math.pow(2 * Math.PI * f0, 2) * Math.max(1e-9, inductanceH));
  const requiredTuningCapacitancePf = Number((capacitanceF * 1e12).toFixed(1));

  // DC Resistance of copper trace
  const antennaMeanLengthMm = Number((2 * (dOutMm + dInMm) * N).toFixed(1));
  const copperRho = 1.68e-8; // Ohm*m
  const crossSectionM2 =
    (params.antennaTraceWidthMm * 1e-3) * (params.antennaCopperThicknessUm * 1e-6);
  const estimatedDcResistanceOhm = Number(
    ((copperRho * (antennaMeanLengthMm * 1e-3)) / Math.max(1e-12, crossSectionM2)).toFixed(2)
  );

  // Loaded Q factor estimate at 13.56 MHz (including typical IC + dielectric loss)
  const omegaL = 2 * Math.PI * f0 * inductanceH;
  const acSkinMultiplier = 1.45;
  const estimatedQFactor = Number(
    Math.min(65, omegaL / Math.max(0.5, estimatedDcResistanceOhm * acSkinMultiplier + 2.5)).toFixed(1)
  );

  const nfcFitInPocketOk =
    params.antennaOuterWidthMm <= params.nfcPocketWidthMm - 1.5 &&
    params.antennaOuterHeightMm <= params.nfcPocketHeightMm - 1.5;

  // Estimated smartphone coupling read distance through polymer wall (empirical scale model)
  const areaFactor = Math.sqrt(params.antennaOuterWidthMm * params.antennaOuterHeightMm) / 18.5;
  const wallAttenuationMm = Math.max(0, params.wallThicknessMm - 1.5) * 0.8;
  const qBonus = Math.min(1.15, Math.max(0.75, estimatedQFactor / 28));
  const estimatedReadRangeMm = Number(
    Math.max(4, 24 * areaFactor * qBonus - wallAttenuationMm).toFixed(1)
  );

  // 4. Engineering Design Rule Warnings
  const warnings: string[] = [];
  if (!structuralMarginOk) {
    warnings.push(
      'Wall or frame margin below minimum 1.2 mm structural threshold — adjust housing dimensions or cavity depth.'
    );
  }
  if (!cavityClearanceOk) {
    warnings.push(
      'Card cavity XY/Z clearance out of recommended 0.10–0.80 mm zero-pinch window.'
    );
  }
  if (!nfcFitInPocketOk) {
    warnings.push(
      'NFC antenna outer dimensions exceed recessed pocket clearance (require >= 0.75 mm margin per side).'
    );
  }
  if (antennaInnerWidthMm <= 3.0 || antennaInnerHeightMm <= 3.0) {
    warnings.push(
      'Spiral turn count leaves insufficient inner core aperture (< 3.0 mm) for Q-factor coupling.'
    );
  }
  if (params.draftAngleDeg < 1.0) {
    warnings.push(
      'Draft angle below 1.0° increases ejection scuff risk on optical polycarbonate surfaces.'
    );
  }

  return {
    internalCavityWidthMm,
    internalCavityHeightMm,
    internalCavityDepthMm,
    effectiveCardPackageThicknessMm,
    zAxisPlayMm,
    minimumWallBehindNfcMm,
    structuralMarginOk,
    cavityClearanceOk,
    housingVolumeCm3,
    estimatedTotalMassG,
    projectedAreaCm2,
    estimatedClampingForceTons,
    compensatedToolWidthMm,
    compensatedToolHeightMm,
    nominalShrinkagePct,
    antennaInnerWidthMm,
    antennaInnerHeightMm,
    antennaMeanLengthMm,
    antennaFillRatio,
    estimatedInductanceUh,
    requiredTuningCapacitancePf,
    estimatedDcResistanceOhm,
    estimatedQFactor,
    nfcFitInPocketOk,
    estimatedReadRangeMm,
    warnings,
  };
}

export interface BomItem {
  itemNo: number;
  partNumber: string;
  description: string;
  material: string;
  qty: number;
  unitMassG: number;
  process: string;
  specStatus: 'Proposed Spec' | 'Confirm w/ Moulder' | 'Confirm w/ Inlay Vendor';
}

export function generateBom(params: SlabParameters, metrics: EngineeringMetrics): BomItem[] {
  const poly = POLYMER_SPECS[params.polymerGrade];
  const halfShellMass = Number(((metrics.housingVolumeCm3 * poly.densityGcm3) * 0.44).toFixed(2));
  const bezelMass = Number(((metrics.housingVolumeCm3 * poly.densityGcm3) * 0.12).toFixed(2));

  return [
    {
      itemNo: 1,
      partNumber: 'VCA-HSG-FRT-01',
      description: `Front Optical Housing (${params.overallWidthMm}x${params.overallHeightMm} mm)`,
      material: poly.gradeExample,
      qty: 1,
      unitMassG: halfShellMass,
      process: 'Injection Moulding (SPI A-1 Optical)',
      specStatus: 'Confirm w/ Moulder',
    },
    {
      itemNo: 2,
      partNumber: 'VCA-HSG-RER-02',
      description: 'Rear Optical Housing w/ Integral Card Cradle & NFC Pocket',
      material: poly.gradeExample,
      qty: 1,
      unitMassG: halfShellMass,
      process: 'Injection Moulding (SPI A-1 / VDI 24)',
      specStatus: 'Confirm w/ Moulder',
    },
    {
      itemNo: 3,
      partNumber: 'VCA-BZL-GRP-03',
      description: 'Graphite Chamfered Perimeter Frame Collar',
      material: 'PC/ABS Graphite-Filled Black (UL94 V-0)',
      qty: 1,
      unitMassG: bezelMass,
      process: '2-Shot Overmould / Insert',
      specStatus: 'Confirm w/ Moulder',
    },
    {
      itemNo: 4,
      partNumber:
        params.nfcChipConfig === 'ntag424_dna' ? 'VCA-NFC-424-04' : 'VCA-NFC-215-04',
      description:
        params.nfcChipConfig === 'ntag424_dna'
          ? `NTAG424 DNA AES-128 Inlay (${params.antennaOuterWidthMm}x${params.antennaOuterHeightMm} mm, ${params.antennaTurns}T)`
          : `NTAG215 Prototype Inlay (${params.antennaOuterWidthMm}x${params.antennaOuterHeightMm} mm, ${params.antennaTurns}T)`,
      material: 'NXP IC Die + 35µm Cu / 50µm Polyimide Flex',
      qty: 1,
      unitMassG: 0.42,
      process: 'Etched Flex + Flip-Chip + PSA',
      specStatus: 'Confirm w/ Inlay Vendor',
    },
    {
      itemNo: 5,
      partNumber: 'VCA-LBL-CRT-05',
      description: `Laser-Serialized Certification Plate (${params.labelWidthMm}x${params.labelHeightMm} mm)`,
      material: 'Synthetic Teslin Archival Stock',
      qty: 1,
      unitMassG: 0.35,
      process: 'Thermal Transfer + Micro-Text Print',
      specStatus: 'Proposed Spec',
    },
    {
      itemNo: 6,
      partNumber: 'VCA-SEC-HOL-06',
      description: 'Destructible Diffractive Hologram & QR Tamper Seal',
      material: 'Tamper-Evident Metallized PET Void Film',
      qty: 1,
      unitMassG: 0.12,
      process: 'Hot-Stamp + UV Laser Etch',
      specStatus: 'Proposed Spec',
    },
    {
      itemNo: 7,
      partNumber: 'VCA-SLV-ARC-07',
      description: 'Archival Acid-Free Inner Card Sleeve (Optional)',
      material: '50 µm Biaxially Oriented Polypropylene (PVC-Free)',
      qty: params.useInnerSleeve ? 1 : 0,
      unitMassG: 0.96,
      process: 'Ultrasonic Precision Slit',
      specStatus: 'Proposed Spec',
    },
  ];
}
