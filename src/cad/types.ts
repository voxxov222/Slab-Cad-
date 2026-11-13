export type ViewPresetId =
  | 'assembled'
  | 'front'
  | 'rear'
  | 'side'
  | 'top_bottom'
  | 'exploded'
  | 'nfc_compartment'
  | 'nfc_antenna'
  | 'label_assembly'
  | 'tamper_lock'
  | 'card_cavity'
  | 'cross_section';

export type SlabComponentId =
  | 'front_housing'
  | 'rear_housing'
  | 'perimeter_bezel'
  | 'card_support_frame'
  | 'inner_sleeve'
  | 'trading_card'
  | 'nfc_compartment'
  | 'nfc_chip'
  | 'nfc_antenna'
  | 'cert_label'
  | 'hologram_qr_seal'
  | 'tamper_weld_pins';

export type PolymerMaterialId = 'pc_makrolon' | 'petg_optical' | 'pmma_acrylic';
export type NfcChipConfigId = 'ntag215' | 'ntag424_dna';

export interface SlabParameters {
  // Overall Exterior Dimensions (mm)
  overallWidthMm: number;
  overallHeightMm: number;
  overallThicknessMm: number;
  cornerRadiusMm: number;
  shoulderChamferMm: number;
  wallThicknessMm: number;
  draftAngleDeg: number;

  // Internal Card & Cavity Tolerances (mm)
  cardWidthMm: number;
  cardHeightMm: number;
  cardThicknessMm: number;
  cavityClearanceXYMm: number;
  cavityDepthAllowanceMm: number;
  useInnerSleeve: boolean;
  sleeveThicknessPerSideMm: number;
  cardSupportRailWidthMm: number;
  cornerReliefRadiusMm: number;

  // Upper Certification Label Bay (mm)
  labelWidthMm: number;
  labelHeightMm: number;
  labelRecessDepthMm: number;

  // Embedded NFC Compartment, Chip & Antenna (mm)
  nfcPocketWidthMm: number;
  nfcPocketHeightMm: number;
  nfcPocketDepthMm: number;
  nfcChipConfig: NfcChipConfigId;
  nfcChipWidthMm: number;
  nfcChipLengthMm: number;
  nfcChipHeightMm: number;
  antennaOuterWidthMm: number;
  antennaOuterHeightMm: number;
  antennaTurns: number;
  antennaTraceWidthMm: number;
  antennaTraceSpacingMm: number;
  antennaCopperThicknessUm: number;

  // Tamper-Evident Locking & Ultrasonic Weld (mm)
  weldRidgeWidthMm: number;
  weldRidgeHeightMm: number;
  interlockTongueDepthMm: number;
  assemblyToleranceMm: number;

  // Material & Certification Identity
  polymerGrade: PolymerMaterialId;
  serialNumber: string;
  cardTitle: string;
  cardSet: string;
  gradeLabel: string;
}

export const DEFAULT_SLAB_PARAMETERS: SlabParameters = {
  overallWidthMm: 84.0,
  overallHeightMm: 138.0,
  overallThicknessMm: 6.8,
  cornerRadiusMm: 4.5,
  shoulderChamferMm: 8.5,
  wallThicknessMm: 1.85,
  draftAngleDeg: 1.5,

  cardWidthMm: 63.5,
  cardHeightMm: 88.9,
  cardThicknessMm: 0.31,
  cavityClearanceXYMm: 0.45,
  cavityDepthAllowanceMm: 0.25,
  useInnerSleeve: true,
  sleeveThicknessPerSideMm: 0.05,
  cardSupportRailWidthMm: 2.2,
  cornerReliefRadiusMm: 1.4,

  labelWidthMm: 72.0,
  labelHeightMm: 25.0,
  labelRecessDepthMm: 0.85,

  nfcPocketWidthMm: 22.0,
  nfcPocketHeightMm: 22.0,
  nfcPocketDepthMm: 1.1,
  nfcChipConfig: 'ntag424_dna',
  nfcChipWidthMm: 1.6,
  nfcChipLengthMm: 1.6,
  nfcChipHeightMm: 0.45,
  antennaOuterWidthMm: 18.5,
  antennaOuterHeightMm: 18.5,
  antennaTurns: 6,
  antennaTraceWidthMm: 0.25,
  antennaTraceSpacingMm: 0.22,
  antennaCopperThicknessUm: 35,

  weldRidgeWidthMm: 0.75,
  weldRidgeHeightMm: 0.55,
  interlockTongueDepthMm: 1.15,
  assemblyToleranceMm: 0.05,

  polymerGrade: 'pc_makrolon',
  serialNumber: 'VCA-26-00202',
  cardTitle: 'Aetheris Storm Drake — Secret Holo',
  cardSet: 'Celestial Tempest #148/192',
  gradeLabel: 'VCA 10 · GEM MINT',
};

export interface ComponentMetadata {
  id: SlabComponentId;
  calloutNumber: number;
  name: string;
  shortName: string;
  subsystem: 'Housing' | 'Card Protection' | 'NFC Electronics' | 'Certification' | 'Security';
  material: string;
  process: string;
  explodeZOffsetMm: number;
  description: string;
  editableFields: (keyof SlabParameters)[];
}

export const SLAB_COMPONENTS: ComponentMetadata[] = [
  {
    id: 'front_housing',
    calloutNumber: 1,
    name: 'Front Optical Housing Shell',
    shortName: 'Front Shell',
    subsystem: 'Housing',
    material: 'Optical Polycarbonate (Makrolon LQ3187)',
    process: 'Precision Injection Moulding (SPI A-1 Optical Polish)',
    explodeZOffsetMm: 46,
    description:
      'UV-stabilized transparent front shell with chamfered VCA shoulder silhouette, perimeter interlock groove, and 0.08 mm anti-Newton-ring optical step.',
    editableFields: ['overallWidthMm', 'overallHeightMm', 'wallThicknessMm', 'cornerRadiusMm', 'shoulderChamferMm', 'draftAngleDeg'],
  },
  {
    id: 'perimeter_bezel',
    calloutNumber: 2,
    name: 'Graphite Chamfered Perimeter Frame',
    shortName: 'Graphite Frame',
    subsystem: 'Housing',
    material: 'PC/ABS Graphite-Filled Structural Insert',
    process: '2-Shot Overmoulding / Micro-Textured Cavity (VDI 27)',
    explodeZOffsetMm: 30,
    description:
      'Signature obsidian-graphite structural collar framing the card window and concealing the internal ultrasonic weld seam.',
    editableFields: ['overallWidthMm', 'overallHeightMm', 'shoulderChamferMm'],
  },
  {
    id: 'hologram_qr_seal',
    calloutNumber: 3,
    name: 'Holographic Security Foil & QR Matrix',
    shortName: 'Holo & QR Seal',
    subsystem: 'Security',
    material: 'Destructible Tamper-Evident PET Hologram Film',
    process: 'Hot-Stamping + Sub-Surface UV Laser Etch',
    explodeZOffsetMm: 22,
    description:
      'Diffractive VCA security emblem and high-contrast ECC-H QR code bridging the label bay and ultrasonic barrier rib.',
    editableFields: ['labelWidthMm', 'labelHeightMm'],
  },
  {
    id: 'cert_label',
    calloutNumber: 4,
    name: 'VCA Laser-Serialized Certification Label',
    shortName: 'Cert Label',
    subsystem: 'Certification',
    material: 'Synthetic Teslin / Micro-Perforated Security Cardstock',
    process: 'Thermal Transfer + Micro-Text Security Print',
    explodeZOffsetMm: 14,
    description:
      'Recessed archival grade plate displaying serial VCA-26-00202, card identity, subgrades, and metallic cyan accent band.',
    editableFields: ['labelWidthMm', 'labelHeightMm', 'labelRecessDepthMm'],
  },
  {
    id: 'nfc_antenna',
    calloutNumber: 5,
    name: '13.56 MHz Etched Copper Spiral Antenna',
    shortName: 'NFC Antenna',
    subsystem: 'NFC Electronics',
    material: '35 µm Electrolytic Copper on 50 µm Polyimide Flex',
    process: 'Photochemical Etching + Tuning Capacitor Bridge',
    explodeZOffsetMm: 8,
    description:
      'Multi-turn planar rectangular spiral coil tuned to 13.56 MHz for reliable smartphone read-through across polycarbonate wall.',
    editableFields: ['antennaOuterWidthMm', 'antennaOuterHeightMm', 'antennaTurns', 'antennaTraceWidthMm', 'antennaTraceSpacingMm'],
  },
  {
    id: 'nfc_chip',
    calloutNumber: 6,
    name: 'Embedded Cryptographic NFC Die / Inlay',
    shortName: 'NFC IC Die',
    subsystem: 'NFC Electronics',
    material: 'Silicon IC (QFN / Flip-Chip) + Encapsulant Glob-Top',
    process: 'Wire-Bond / ACF Flip-Chip + Pre-Seal Encoding',
    explodeZOffsetMm: 2,
    description:
      'NTAG215 (prototype) or NTAG424 DNA AES-128 SUN (production) transponder bonded directly onto the polyimide antenna pads.',
    editableFields: ['nfcChipConfig', 'nfcChipWidthMm', 'nfcChipLengthMm', 'nfcChipHeightMm'],
  },
  {
    id: 'nfc_compartment',
    calloutNumber: 7,
    name: 'Hermetic Recessed NFC Isolation Pocket',
    shortName: 'NFC Pocket',
    subsystem: 'NFC Electronics',
    material: 'Moulded Pocket in Rear Optical Shell',
    process: 'Core-Pin Recessed Cavity + Tamper Barrier Rib',
    explodeZOffsetMm: -8,
    description:
      'Dedicated upper-right isolation pocket with locating datum pins and surrounding ultrasonic seal rib protecting electronics from prying.',
    editableFields: ['nfcPocketWidthMm', 'nfcPocketHeightMm', 'nfcPocketDepthMm'],
  },
  {
    id: 'inner_sleeve',
    calloutNumber: 8,
    name: 'Archival Acid-Free Protective Inner Sleeve',
    shortName: 'Inner Sleeve',
    subsystem: 'Card Protection',
    material: '50 µm Biaxially Oriented Polypropylene (PVC-Free)',
    process: 'Precision Ultrasonic Side-Seam Slitting',
    explodeZOffsetMm: -16,
    description:
      'Optional ultra-clear archival sleeve eliminating micro-abrasion against rigid polycarbonate cavity rails during transit.',
    editableFields: ['useInnerSleeve', 'sleeveThicknessPerSideMm'],
  },
  {
    id: 'trading_card',
    calloutNumber: 9,
    name: 'Certified Collectible Trading Card',
    shortName: 'Trading Card',
    subsystem: 'Card Protection',
    material: '300 gsm Multi-Layer Blue-Core Cardstock',
    process: 'Encapsulated Specimen (63.5 × 88.9 mm)',
    explodeZOffsetMm: -24,
    description:
      'Standard 63.5 × 88.9 mm collectible card suspended in a zero-pinch perimeter cavity with corner relief pockets.',
    editableFields: ['cardWidthMm', 'cardHeightMm', 'cardThicknessMm'],
  },
  {
    id: 'card_support_frame',
    calloutNumber: 10,
    name: 'Stepped Card Retention & Corner Relief Cradle',
    shortName: 'Card Cradle',
    subsystem: 'Card Protection',
    material: 'Optical Polycarbonate Integral Ribbing',
    process: 'CNC-Milled Mould Core + 1.5° Draft Relief',
    explodeZOffsetMm: -32,
    description:
      'Internal perimeter support rails with radial corner clearance pockets preventing card shift, edge dings, and surface Newton rings.',
    editableFields: ['cavityClearanceXYMm', 'cavityDepthAllowanceMm', 'cardSupportRailWidthMm', 'cornerReliefRadiusMm'],
  },
  {
    id: 'tamper_weld_pins',
    calloutNumber: 11,
    name: 'Ultrasonic Energy Director & Shear Pins',
    shortName: 'Weld & Pins',
    subsystem: 'Security',
    material: 'Integral Sacrificial Polycarbonate Energy Director',
    process: '20 kHz Ultrasonic Fusion + Micro-Shear Dowels',
    explodeZOffsetMm: -40,
    description:
      '45° triangular sacrificial weld bead + 4 tamper-evident shear pins around the NFC bay that craze/fracture upon forced separation.',
    editableFields: ['weldRidgeWidthMm', 'weldRidgeHeightMm', 'interlockTongueDepthMm', 'assemblyToleranceMm'],
  },
  {
    id: 'rear_housing',
    calloutNumber: 12,
    name: 'Rear Optical Housing Shell',
    shortName: 'Rear Shell',
    subsystem: 'Housing',
    material: 'Optical Polycarbonate (Makrolon LQ3187)',
    process: 'Precision Injection Moulding (SPI A-1 Optical Polish)',
    explodeZOffsetMm: -52,
    description:
      'Rigid rear enclosure featuring perimeter tongue-and-groove interlock wall, card cradle cavity, and recessed NFC/label isolation bay.',
    editableFields: ['overallThicknessMm', 'wallThicknessMm', 'draftAngleDeg'],
  },
];

export interface ViewPreset {
  id: ViewPresetId;
  label: string;
  shortLabel: string;
  description: string;
  cameraPos: [number, number, number];
  target: [number, number, number];
  defaultExplode: number;
  enableSection: boolean;
  highlightComponent?: SlabComponentId;
}

export const VIEW_PRESETS: ViewPreset[] = [
  {
    id: 'assembled',
    label: '1. Complete Assembled Slab',
    shortLabel: 'Assembled',
    description: 'Full 3D inspection of the proprietary VCA beveled silhouette with optical housing and NFC badge.',
    cameraPos: [140, 42, 245],
    target: [0, -14, 0],
    defaultExplode: 0,
    enableSection: false,
  },
  {
    id: 'front',
    label: '2. Front Elevation',
    shortLabel: 'Front',
    description: 'Orthogonal front view verifying card window framing, VCA certification label, and optical clarity.',
    cameraPos: [0, -14, 275],
    target: [0, -14, 0],
    defaultExplode: 0,
    enableSection: false,
  },
  {
    id: 'rear',
    label: '3. Rear Elevation',
    shortLabel: 'Rear',
    description: 'Rear housing inspection showing ultrasonic perimeter track, rear NFC bay seal, and card back visibility.',
    cameraPos: [0, -14, -275],
    target: [0, -14, 0],
    defaultExplode: 0,
    enableSection: false,
  },
  {
    id: 'side',
    label: '4. Side Profile',
    shortLabel: 'Side Profile',
    description: 'Profile thickness inspection (6.8 mm target) showing chamfered shoulder transitions and tongue-groove seam.',
    cameraPos: [235, -10, 12],
    target: [0, -10, 0],
    defaultExplode: 0,
    enableSection: false,
  },
  {
    id: 'top_bottom',
    label: '5. Top & Bottom Views',
    shortLabel: 'Top / Bottom',
    description: 'Elevated top edge inspection showing upper shoulder bevel, NFC bay top clearance, and stack symmetry.',
    cameraPos: [0, 235, 85],
    target: [0, 15, 0],
    defaultExplode: 0,
    enableSection: false,
  },
  {
    id: 'exploded',
    label: '6. Exploded Assembly',
    shortLabel: 'Exploded',
    description: 'All 12 engineered layers separated along the Z-axis in factory assembly sequence.',
    cameraPos: [185, 50, 200],
    target: [0, -12, 0],
    defaultExplode: 1,
    enableSection: false,
  },
  {
    id: 'nfc_compartment',
    label: '7. Internal NFC Compartment',
    shortLabel: 'NFC Pocket',
    description: 'Close-up of the recessed upper-right NFC pocket, barrier rib, and locating pins.',
    cameraPos: [38, 62, 68],
    target: [20, 48, 0],
    defaultExplode: 0.48,
    enableSection: false,
    highlightComponent: 'nfc_compartment',
  },
  {
    id: 'nfc_antenna',
    label: '8. NFC Antenna Close-Up',
    shortLabel: 'Antenna Coil',
    description: 'Macro inspection of the 13.56 MHz copper spiral coil, tuning bridge, and IC die bond pads.',
    cameraPos: [28, 54, 42],
    target: [20, 48, 4],
    defaultExplode: 0.55,
    enableSection: false,
    highlightComponent: 'nfc_antenna',
  },
  {
    id: 'label_assembly',
    label: '9. Certification Label Assembly',
    shortLabel: 'Label Bay',
    description: 'Inspection of the recessed security label, QR matrix, and holographic tamper seal.',
    cameraPos: [-12, 64, 78],
    target: [0, 48, 8],
    defaultExplode: 0.42,
    enableSection: false,
    highlightComponent: 'cert_label',
  },
  {
    id: 'tamper_lock',
    label: '10. Tamper-Evident Locking',
    shortLabel: 'Tamper Lock',
    description: 'Macro corner view of the tongue-and-groove interlock, 45° ultrasonic energy director, and shear pins.',
    cameraPos: [58, -50, 52],
    target: [36, -58, 0],
    defaultExplode: 0.35,
    enableSection: false,
    highlightComponent: 'tamper_weld_pins',
  },
  {
    id: 'card_cavity',
    label: '11. Internal Card Cavity',
    shortLabel: 'Card Cavity',
    description: 'Inspection of the stepped retention cradle, corner relief chamfers, and archival sleeve gap.',
    cameraPos: [-45, -18, 82],
    target: [0, -14, -4],
    defaultExplode: 0.52,
    enableSection: false,
    highlightComponent: 'card_support_frame',
  },
  {
    id: 'cross_section',
    label: '12. Cross-Sectional View',
    shortLabel: 'Cross-Section',
    description: 'Active X-Z plane cut revealing internal cavity clearance, wall thickness, and NFC recess stack-up.',
    cameraPos: [135, 22, 145],
    target: [0, -12, 0],
    defaultExplode: 0,
    enableSection: true,
  },
];

export interface AssemblyStep {
  stepNumber: number;
  title: string;
  componentIds: SlabComponentId[];
  explodePreview: number;
  cameraTarget: ViewPresetId;
  instruction: string;
  qcGate: string;
}

export const ASSEMBLY_SEQUENCE: AssemblyStep[] = [
  {
    stepNumber: 1,
    title: 'Rear Optical Shell Staging & Cleanroom Ionization',
    componentIds: ['rear_housing', 'card_support_frame'],
    explodePreview: 0.85,
    cameraTarget: 'card_cavity',
    instruction:
      'Place injection-moulded rear optical polycarbonate shell onto anti-static vacuum nest. Ionize cavity with filtered air knife to remove particulate dust.',
    qcGate: 'Zero particulate >= 50 µm in viewing window; optical haze < 1.0%.',
  },
  {
    stepNumber: 2,
    title: 'NFC Inlay Pre-Encoding & Pocket Placement',
    componentIds: ['nfc_compartment', 'nfc_chip', 'nfc_antenna'],
    explodePreview: 0.65,
    cameraTarget: 'nfc_antenna',
    instruction:
      'Seat pre-tested 13.56 MHz polyimide antenna + IC assembly onto datum pins inside the recessed NFC isolation pocket using low-outgassing pressure-sensitive acrylic adhesive.',
    qcGate: 'Verify 13.56 MHz resonance (13.3–13.8 MHz) and write/lock initial NDEF/AES-128 keys.',
  },
  {
    stepNumber: 3,
    title: 'Certification Label & Destructible Hologram Application',
    componentIds: ['cert_label', 'hologram_qr_seal'],
    explodePreview: 0.5,
    cameraTarget: 'label_assembly',
    instruction:
      'Insert laser-serialized Teslin certification plate into upper recess. Bind VCA holographic tamper foil and ECC-H QR matrix across the label/NFC barrier rib.',
    qcGate: 'Optical barcode scanner confirms QR string matches NFC UID + VCA serial VCA-26-00202.',
  },
  {
    stepNumber: 4,
    title: 'Card Sleeving & Zero-Pinch Cavity Loading',
    componentIds: ['trading_card', 'inner_sleeve'],
    explodePreview: 0.35,
    cameraTarget: 'card_cavity',
    instruction:
      'Insert authenticated card into 50 µm PVC-free archival inner sleeve (if enabled) and seat into stepped perimeter cradle with 0.45 mm XY relief.',
    qcGate: 'Laser height sensor confirms card sits below perimeter weld datum with >= 0.15 mm clearance.',
  },
  {
    stepNumber: 5,
    title: 'Front Optical Shell & Perimeter Bezel Alignment',
    componentIds: ['front_housing', 'perimeter_bezel'],
    explodePreview: 0.18,
    cameraTarget: 'tamper_lock',
    instruction:
      'Engage front polycarbonate shell + graphite overmoulded frame into rear tongue-and-groove perimeter track and register 4 tamper-evident shear pins.',
    qcGate: 'Seam gap <= 0.08 mm around full 360° perimeter prior to ultrasonic horn descent.',
  },
  {
    stepNumber: 6,
    title: '20 kHz Ultrasonic Fusion & Final NFC/Visual Audit',
    componentIds: ['tamper_weld_pins'],
    explodePreview: 0,
    cameraTarget: 'assembled',
    instruction:
      'Apply controlled 20 kHz ultrasonic horn (0.35 s weld / 0.50 s hold) collapsing the 45° energy director ridge for permanent hermetic sealing.',
    qcGate: 'Post-weld NFC read distance >= 18 mm through closed housing; destructive pull sample > 220 N.',
  },
];
