import * as THREE from 'three';
import { EngineeringMetrics, POLYMER_SPECS } from './engineeringMath';
import {
  createBrushedRoughnessTexture,
  createCertLabelBackTexture,
  createCertLabelTexture,
  createHoloQrSealTexture,
  createTradingCardTextures,
} from './slabTextures';
import { SLAB_COMPONENTS, SlabComponentId, SlabParameters } from './types';

export interface AssemblyChoreography {
  frontHousingZMm: number;
  rearHousingZMm: number;
  cardOffsetMm: [number, number, number];
  cradleZMm: number;
  nfcPocketZMm: number;
  antennaOffsetMm: [number, number, number];
  chipOffsetMm: [number, number, number];
  labelOffsetMm: [number, number, number];
  weldPinsZMm: number;
}

export const ASSEMBLED_CHOREOGRAPHY: AssemblyChoreography = {
  frontHousingZMm: 0,
  rearHousingZMm: 0,
  cardOffsetMm: [0, 0, 0],
  cradleZMm: 0,
  nfcPocketZMm: 0,
  antennaOffsetMm: [0, 0, 0],
  chipOffsetMm: [0, 0, 0],
  labelOffsetMm: [0, 0, 0],
  weldPinsZMm: 0,
};

export interface SlabAssemblyHandles {
  root: THREE.Group;
  components: Record<SlabComponentId, THREE.Group>;
  materialsToHighlight: Map<SlabComponentId, THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>;
  disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[]; textures: THREE.Texture[] };
  updateExplode: (explodeT: number) => void;
  applyAssemblyChoreography: (choreo: AssemblyChoreography) => void;
  setSelectedComponent: (selected: SlabComponentId | null) => void;
  setClipPlane: (plane: THREE.Plane | null) => void;
  setHousingXray: (opacityFactor: number) => void;
  setBlueprintStyle: (enabled: boolean) => void;
}

/**
 * Creates a proprietary VCA octagonal-beveled 2D silhouette shape with rounded transitions.
 */
function createVcaSilhouetteShape(width: number, height: number, chamfer: number): THREE.Shape {
  const hw = width / 2;
  const hh = height / 2;
  const c = Math.min(chamfer, hw * 0.38, hh * 0.22);
  const bc = c * 0.58; // subtler bottom chamfer for distinctive top-heavy architectural stance

  const shape = new THREE.Shape();
  shape.moveTo(-hw + bc, -hh);
  shape.lineTo(hw - bc, -hh);
  shape.lineTo(hw, -hh + bc);
  shape.lineTo(hw, hh - c);
  shape.lineTo(hw - c, hh);
  shape.lineTo(-hw + c, hh);
  shape.lineTo(-hw, hh - c);
  shape.lineTo(-hw, -hh + bc);
  shape.closePath();
  return shape;
}

function createRoundedRectPath(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Path {
  const hw = w / 2;
  const hh = h / 2;
  const rad = Math.min(r, hw * 0.45, hh * 0.45);
  const path = new THREE.Path();
  path.moveTo(cx - hw + rad, cy - hh);
  path.lineTo(cx + hw - rad, cy - hh);
  path.quadraticCurveTo(cx + hw, cy - hh, cx + hw, cy - hh + rad);
  path.lineTo(cx + hw, cy + hh - rad);
  path.quadraticCurveTo(cx + hw, cy + hh, cx + hw - rad, cy + hh);
  path.lineTo(cx - hw + rad, cy + hh);
  path.quadraticCurveTo(cx - hw, cy + hh, cx - hw, cy + hh - rad);
  path.lineTo(cx - hw, cy - hh + rad);
  path.quadraticCurveTo(cx - hw, cy - hh, cx - hw + rad, cy - hh);
  return path;
}

export function buildVcaSlabAssembly(
  params: SlabParameters,
  metrics: EngineeringMetrics,
  options: {
    isSoftwareGl: boolean;
    maxAnisotropy: number;
    onTextureReady?: () => void;
  }
): SlabAssemblyHandles {
  const { isSoftwareGl, maxAnisotropy, onTextureReady } = options;
  const disposables = {
    geometries: [] as THREE.BufferGeometry[],
    materials: [] as THREE.Material[],
    textures: [] as THREE.Texture[],
  };

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposables.textures.push(t);
    return t;
  };

  const root = new THREE.Group();
  root.name = 'vca_slab_root';

  const components = {} as Record<SlabComponentId, THREE.Group>;
  const materialsToHighlight = new Map<
    SlabComponentId,
    THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial
  >();

  for (const meta of SLAB_COMPONENTS) {
    const grp = new THREE.Group();
    grp.name = meta.id;
    grp.userData.componentId = meta.id;
    components[meta.id] = grp;
    root.add(grp);
  }

  const poly = POLYMER_SPECS[params.polymerGrade];
  const halfT = params.overallThicknessMm / 2;
  const cardCenterY = -14.0;
  const labelCenterY = params.overallHeightMm / 2 - params.labelHeightMm / 2 - 6.0;

  // Shared optical polymer material for front/rear shells
  const opticalColor =
    params.polymerGrade === 'pmma_acrylic'
      ? 0xe8f6ff
      : params.polymerGrade === 'petg_optical'
        ? 0xdceef8
        : 0xd8effc;

  const brushedRoughTex = trackTex(createBrushedRoughnessTexture(maxAnisotropy));

  // Water-clear SPI A-1 optical polycarbonate: crisp transparency with pure specular bevel catchlights
  const frontOpticalMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.0,
      ior: poly.refractiveIndex,
      transmission: 0,
      transparent: true,
      opacity: 0.065,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      reflectivity: 0.9,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      depthWrite: false,
      envMapIntensity: 0.85,
    })
  );

  const rearOpticalMat = trackMat(frontOpticalMat.clone());

  const cradleOpticalMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      metalness: 0.0,
      roughness: 0.02,
      transparent: true,
      opacity: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01,
      envMapIntensity: 0.9,
      depthWrite: false,
    })
  );

  // 1. FRONT HOUSING SHELL
  const frontOuterShape = createVcaSilhouetteShape(
    params.overallWidthMm,
    params.overallHeightMm,
    params.shoulderChamferMm
  );
  const frontShellGeo = trackGeo(
    new THREE.ExtrudeGeometry(frontOuterShape, {
      depth: params.wallThicknessMm,
      bevelEnabled: true,
      bevelThickness: 0.35,
      bevelSize: 0.35,
      bevelSegments: 3,
      curveSegments: 16,
    })
  );
  const frontShellMesh = new THREE.Mesh(frontShellGeo, frontOpticalMat);
  frontShellMesh.position.z = halfT - params.wallThicknessMm;
  frontShellMesh.renderOrder = 4;
  frontShellMesh.userData.componentId = 'front_housing';
  components.front_housing.add(frontShellMesh);

  // Crisp optical polycarbonate chamfer catchlight
  const frontEdgeGeo = trackGeo(new THREE.EdgesGeometry(frontShellGeo, 24));
  const opticalEdgeMat = trackMat(
    new THREE.LineBasicMaterial({
      color: 0xe2f1ff,
      transparent: true,
      opacity: 0.44,
    })
  );
  const frontEdgeLines = new THREE.LineSegments(frontEdgeGeo, opticalEdgeMat);
  frontEdgeLines.position.copy(frontShellMesh.position);
  components.front_housing.add(frontEdgeLines);

  materialsToHighlight.set('front_housing', frontOpticalMat);

  // 2. GRAPHITE CHAMFERED PERIMETER FRAME + ELECTRIC CYAN INLAY ACCENT
  const bezelShape = createVcaSilhouetteShape(
    params.overallWidthMm - 1.2,
    params.overallHeightMm - 1.2,
    params.shoulderChamferMm - 0.5
  );
  const innerWindowPath = createRoundedRectPath(
    metrics.internalCavityWidthMm + 2.4,
    metrics.internalCavityHeightMm + 2.4,
    params.cornerRadiusMm * 0.6,
    0,
    cardCenterY
  );
  const innerLabelHolePath = createRoundedRectPath(
    params.labelWidthMm + 1.0,
    params.labelHeightMm + 1.0,
    2.0,
    0,
    labelCenterY
  );
  bezelShape.holes.push(innerWindowPath, innerLabelHolePath);

  const bezelDepth = Math.max(1.2, params.overallThicknessMm - 1.4);
  const bezelGeo = trackGeo(
    new THREE.ExtrudeGeometry(bezelShape, {
      depth: bezelDepth,
      bevelEnabled: true,
      bevelThickness: 0.25,
      bevelSize: 0.25,
      bevelSegments: 2,
    })
  );
  const graphiteMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      roughness: 0.02,
      metalness: 0.0,
      transparent: true,
      opacity: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01,
      envMapIntensity: 0.9,
      depthWrite: false,
    })
  );
  const bezelMesh = new THREE.Mesh(bezelGeo, graphiteMat);
  bezelMesh.position.z = -bezelDepth / 2;
  bezelMesh.renderOrder = 2;
  bezelMesh.userData.componentId = 'perimeter_bezel';
  components.perimeter_bezel.add(bezelMesh);

  const bezelEdgeGeo = trackGeo(new THREE.EdgesGeometry(bezelGeo, 26));
  const bezelEdgeMat = trackMat(
    new THREE.LineBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.32,
    })
  );
  const bezelEdgeLines = new THREE.LineSegments(bezelEdgeGeo, bezelEdgeMat);
  bezelEdgeLines.position.copy(bezelMesh.position);
  components.perimeter_bezel.add(bezelEdgeLines);

  // Clean Hairline Window Collar around card pocket
  const cyanCollarShape = createRoundedRectPath(
    metrics.internalCavityWidthMm + 3.0,
    metrics.internalCavityHeightMm + 3.0,
    params.cornerRadiusMm * 0.65,
    0,
    cardCenterY
  );
  const cyanInnerHole = createRoundedRectPath(
    metrics.internalCavityWidthMm + 2.4,
    metrics.internalCavityHeightMm + 2.4,
    params.cornerRadiusMm * 0.6,
    0,
    cardCenterY
  );
  const cyanShape = new THREE.Shape(cyanCollarShape.getPoints(32));
  cyanShape.holes.push(cyanInnerHole);
  const cyanCollarGeo = trackGeo(
    new THREE.ExtrudeGeometry(cyanShape, { depth: 0.4, bevelEnabled: false })
  );
  const cyanAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.15,
      metalness: 0.35,
      transparent: true,
      opacity: 0.38,
    })
  );
  const cyanCollarMesh = new THREE.Mesh(cyanCollarGeo, cyanAccentMat);
  cyanCollarMesh.position.z = halfT - params.wallThicknessMm - 0.15;
  cyanCollarMesh.userData.componentId = 'perimeter_bezel';
  components.perimeter_bezel.add(cyanCollarMesh);
  materialsToHighlight.set('perimeter_bezel', graphiteMat);

  // 3. CERTIFICATION LABEL PLATE (Front Blue/Red VCA Trim + Back Dark-Navy UV/QR Strip)
  const labelFrontTex = trackTex(createCertLabelTexture(params, maxAnisotropy));
  const labelBackTex = trackTex(
    createCertLabelBackTexture(params, maxAnisotropy, onTextureReady)
  );
  const labelPlateW = params.labelWidthMm - 1.2;
  const labelFrontMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: labelFrontTex,
      roughness: 0.56,
      metalness: 0.06,
      envMapIntensity: 0.32,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const labelBackMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: labelBackTex,
      roughness: 0.48,
      metalness: 0.14,
      envMapIntensity: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const labelEdgeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.45,
      metalness: 0.1,
    })
  );
  const labelCarrierZ = halfT - params.wallThicknessMm - 0.36;
  const labelGeo = trackGeo(new THREE.BoxGeometry(labelPlateW, params.labelHeightMm - 1.2, 0.86));
  const labelMesh = new THREE.Mesh(labelGeo, [
    labelEdgeMat,
    labelEdgeMat,
    labelEdgeMat,
    labelEdgeMat,
    labelFrontMat,
    labelBackMat,
  ]);
  labelMesh.position.set(0, labelCenterY, labelCarrierZ);
  labelMesh.userData.componentId = 'cert_label';
  components.cert_label.add(labelMesh);
  materialsToHighlight.set('cert_label', labelFrontMat);

  // 4. HOLOGRAPHIC VCA SECURITY FOIL (Laminated inside label carrier when assembled; separates cleanly between Frame and Cert Label when exploded)
  const holoTex = trackTex(createHoloQrSealTexture(params.serialNumber, maxAnisotropy, onTextureReady));
  const holoMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: holoTex,
      roughness: 0.16,
      metalness: 0.72,
      iridescence: 0.9,
      iridescenceIOR: 1.45,
      clearcoat: 1.0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const nfcCenterX = params.labelWidthMm / 2 - params.nfcPocketWidthMm / 2 - 1.5;
  const holoGeo = trackGeo(new THREE.BoxGeometry(16.5, 14.5, 0.08));
  const holoMesh = new THREE.Mesh(holoGeo, holoMat);
  holoMesh.position.set(0, labelCenterY + 0.5, labelCarrierZ + 0.16);
  holoMesh.userData.componentId = 'hologram_qr_seal';
  components.hologram_qr_seal.add(holoMesh);
  materialsToHighlight.set('hologram_qr_seal', holoMat);

  // 5. EMBEDDED NFC ANTENNA (Polyimide Flex + Multi-Turn Copper Rectangular Spiral)
  const flexMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb45309, // Amber polyimide Kapton substrate
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.88,
    })
  );
  const flexGeo = trackGeo(
    new THREE.BoxGeometry(params.antennaOuterWidthMm + 1.2, params.antennaOuterHeightMm + 1.2, 0.08)
  );
  const flexMesh = new THREE.Mesh(flexGeo, flexMat);
  const nfcPlaneZ = labelCarrierZ;
  flexMesh.position.set(nfcCenterX, labelCenterY, nfcPlaneZ - 0.04);
  flexMesh.userData.componentId = 'nfc_antenna';
  components.nfc_antenna.add(flexMesh);

  const copperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe68a3e,
      roughness: 0.22,
      metalness: 0.92,
    })
  );

  // Build actual procedural spiral coil turns
  const pitch = params.antennaTraceWidthMm + params.antennaTraceSpacingMm;
  const traceH = 0.07;
  for (let t = 0; t < params.antennaTurns; t++) {
    const w = Math.max(2.0, params.antennaOuterWidthMm - t * 2 * pitch);
    const h = Math.max(2.0, params.antennaOuterHeightMm - t * 2 * pitch);
    const tw = params.antennaTraceWidthMm;

    const topBar = trackGeo(new THREE.BoxGeometry(w, tw, traceH));
    const botBar = trackGeo(new THREE.BoxGeometry(w, tw, traceH));
    const leftBar = trackGeo(new THREE.BoxGeometry(tw, h, traceH));
    const rightBar = trackGeo(new THREE.BoxGeometry(tw, h, traceH));

    const mTop = new THREE.Mesh(topBar, copperMat);
    mTop.position.set(nfcCenterX, labelCenterY + h / 2 - tw / 2, nfcPlaneZ);
    const mBot = new THREE.Mesh(botBar, copperMat);
    mBot.position.set(nfcCenterX, labelCenterY - h / 2 + tw / 2, nfcPlaneZ);
    const mLeft = new THREE.Mesh(leftBar, copperMat);
    mLeft.position.set(nfcCenterX - w / 2 + tw / 2, labelCenterY, nfcPlaneZ);
    const mRight = new THREE.Mesh(rightBar, copperMat);
    mRight.position.set(nfcCenterX + w / 2 - tw / 2, labelCenterY, nfcPlaneZ);

    [mTop, mBot, mLeft, mRight].forEach((m) => {
      m.userData.componentId = 'nfc_antenna';
      components.nfc_antenna.add(m);
    });
  }
  materialsToHighlight.set('nfc_antenna', copperMat);

  // 6. EMBEDDED NFC CHIP DIE + BOND PADS + GLOB-TOP
  const chipMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: params.nfcChipConfig === 'ntag424_dna' ? 0x0284c7 : 0x334155,
      roughness: 0.25,
      metalness: 0.55,
    })
  );
  const chipGeo = trackGeo(
    new THREE.BoxGeometry(
      params.nfcChipWidthMm,
      params.nfcChipLengthMm,
      Math.min(0.32, params.nfcChipHeightMm)
    )
  );
  const chipMesh = new THREE.Mesh(chipGeo, chipMat);
  chipMesh.position.set(
    nfcCenterX,
    labelCenterY - params.antennaOuterHeightMm / 2 + 2.8,
    nfcPlaneZ + 0.04
  );
  chipMesh.userData.componentId = 'nfc_chip';
  components.nfc_chip.add(chipMesh);

  // Gold solder bond pads flanking the IC
  const goldMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.95 })
  );
  const padGeo = trackGeo(new THREE.BoxGeometry(0.65, 0.45, 0.1));
  [-1, 1].forEach((side) => {
    const pad = new THREE.Mesh(padGeo, goldMat);
    pad.position.set(
      chipMesh.position.x + side * (params.nfcChipWidthMm / 2 + 0.45),
      chipMesh.position.y,
      nfcPlaneZ + 0.02
    );
    pad.userData.componentId = 'nfc_chip';
    components.nfc_chip.add(pad);
  });
  materialsToHighlight.set('nfc_chip', chipMat);

  // 7. HERMETIC RECESSED NFC ISOLATION POCKET (Barrier Rib + Datum Pins)
  const pocketShape = new THREE.Shape();
  const pw = params.nfcPocketWidthMm / 2 + 1.1;
  const ph = params.nfcPocketHeightMm / 2 + 1.1;
  pocketShape.moveTo(-pw, -ph);
  pocketShape.lineTo(pw, -ph);
  pocketShape.lineTo(pw, ph);
  pocketShape.lineTo(-pw, ph);
  pocketShape.closePath();

  const innerPocketHole = new THREE.Path();
  const ipw = params.nfcPocketWidthMm / 2;
  const iph = params.nfcPocketHeightMm / 2;
  innerPocketHole.moveTo(-ipw, -iph);
  innerPocketHole.lineTo(ipw, -iph);
  innerPocketHole.lineTo(ipw, iph);
  innerPocketHole.lineTo(-ipw, iph);
  innerPocketHole.closePath();
  pocketShape.holes.push(innerPocketHole);

  const pocketDepth = Math.min(0.68, params.nfcPocketDepthMm);
  const pocketGeo = trackGeo(
    new THREE.ExtrudeGeometry(pocketShape, {
      depth: pocketDepth,
      bevelEnabled: false,
    })
  );
  const pocketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.35,
      metalness: 0.25,
      transparent: true,
      opacity: 0.72,
    })
  );
  const pocketMesh = new THREE.Mesh(pocketGeo, pocketMat);
  pocketMesh.position.set(nfcCenterX, labelCenterY, nfcPlaneZ - pocketDepth / 2);
  pocketMesh.userData.componentId = 'nfc_compartment';
  components.nfc_compartment.add(pocketMesh);
  materialsToHighlight.set('nfc_compartment', pocketMat);

  // 8. INNER ARCHIVAL PROTECTIVE SLEEVE
  if (params.useInnerSleeve) {
    const sleeveMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.01,
        metalness: 0.0,
        transparent: true,
        opacity: 0.04,
        depthWrite: false,
      })
    );
    const sleeveGeo = trackGeo(
      new THREE.BoxGeometry(
        params.cardWidthMm + 1.4,
        params.cardHeightMm + 1.4,
        metrics.effectiveCardPackageThicknessMm
      )
    );
    const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveMat);
    sleeveMesh.position.set(0, cardCenterY, 0);
    sleeveMesh.renderOrder = 2;
    sleeveMesh.userData.componentId = 'inner_sleeve';
    components.inner_sleeve.add(sleeveMesh);
    materialsToHighlight.set('inner_sleeve', sleeveMat);
  }

  // 9. CERTIFIED TRADING CARD
  const cardTextures = createTradingCardTextures(params, maxAnisotropy, onTextureReady);
  trackTex(cardTextures.front);
  trackTex(cardTextures.back);

  const cardFrontMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: cardTextures.front,
      roughness: 0.46,
      metalness: 0.08,
      envMapIntensity: 0.42,
    })
  );
  const cardBackMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: cardTextures.back,
      roughness: 0.48,
      metalness: 0.06,
      envMapIntensity: 0.42,
    })
  );
  const cardEdgeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.65,
      metalness: 0.05,
    })
  );

  const cardGeo = trackGeo(
    new THREE.BoxGeometry(params.cardWidthMm, params.cardHeightMm, params.cardThicknessMm)
  );
  const cardMesh = new THREE.Mesh(cardGeo, [
    cardEdgeMat,
    cardEdgeMat,
    cardEdgeMat,
    cardEdgeMat,
    cardFrontMat,
    cardBackMat,
  ]);
  cardMesh.position.set(0, cardCenterY, 0);
  cardMesh.castShadow = true;
  cardMesh.receiveShadow = true;
  cardMesh.userData.componentId = 'trading_card';
  components.trading_card.add(cardMesh);
  materialsToHighlight.set('trading_card', cardFrontMat);

  // 10. STEPPED CARD RETENTION CRADLE & CORNER RELIEF RAILS
  const cradleOuter = createRoundedRectPath(
    metrics.internalCavityWidthMm + params.cardSupportRailWidthMm * 2,
    metrics.internalCavityHeightMm + params.cardSupportRailWidthMm * 2,
    params.cornerRadiusMm * 0.5,
    0,
    cardCenterY
  );
  const cradleShape = new THREE.Shape(cradleOuter.getPoints(32));
  const cradleHole = createRoundedRectPath(
    metrics.internalCavityWidthMm,
    metrics.internalCavityHeightMm,
    params.cornerReliefRadiusMm,
    0,
    cardCenterY
  );
  cradleShape.holes.push(cradleHole);

  const cradleGeo = trackGeo(
    new THREE.ExtrudeGeometry(cradleShape, {
      depth: metrics.internalCavityDepthMm + 0.5,
      bevelEnabled: false,
    })
  );
  const cradleMesh = new THREE.Mesh(cradleGeo, cradleOpticalMat);
  cradleMesh.position.z = -(metrics.internalCavityDepthMm + 0.5) / 2;
  cradleMesh.userData.componentId = 'card_support_frame';
  components.card_support_frame.add(cradleMesh);
  materialsToHighlight.set('card_support_frame', cradleOpticalMat);

  // 11. ULTRASONIC ENERGY DIRECTOR PERIMETER RIDGE + 4 ANTI-PRY SHEAR PINS
  const weldOuter = createVcaSilhouetteShape(
    params.overallWidthMm - 3.6,
    params.overallHeightMm - 3.6,
    params.shoulderChamferMm - 1.2
  );
  const weldInner = createVcaSilhouetteShape(
    params.overallWidthMm - 3.6 - params.weldRidgeWidthMm * 2,
    params.overallHeightMm - 3.6 - params.weldRidgeWidthMm * 2,
    params.shoulderChamferMm - 1.5
  );
  weldOuter.holes.push(weldInner);

  const weldGeo = trackGeo(
    new THREE.ExtrudeGeometry(weldOuter, {
      depth: params.weldRidgeHeightMm,
      bevelEnabled: true,
      bevelThickness: 0.18,
      bevelSize: 0.15,
      bevelSegments: 1,
    })
  );
  const weldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      roughness: 0.06,
      metalness: 0.15,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    })
  );
  const weldMesh = new THREE.Mesh(weldGeo, weldMat);
  weldMesh.position.z = -params.weldRidgeHeightMm / 2;
  weldMesh.userData.componentId = 'tamper_weld_pins';
  components.tamper_weld_pins.add(weldMesh);

  // 4 Micro-Shear Pins around NFC bay + lower corners
  const pinGeo = trackGeo(new THREE.CylinderGeometry(0.65, 0.55, params.interlockTongueDepthMm + 0.8, 12));
  const pinOffsets: [number, number][] = [
    [-params.overallWidthMm / 2 + 5.5, params.overallHeightMm / 2 - 12],
    [params.overallWidthMm / 2 - 5.5, params.overallHeightMm / 2 - 12],
    [-params.overallWidthMm / 2 + 5.5, -params.overallHeightMm / 2 + 9],
    [params.overallWidthMm / 2 - 5.5, -params.overallHeightMm / 2 + 9],
  ];
  pinOffsets.forEach(([px, py]) => {
    const pin = new THREE.Mesh(pinGeo, weldMat);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(px, py, 0);
    pin.userData.componentId = 'tamper_weld_pins';
    components.tamper_weld_pins.add(pin);
  });
  materialsToHighlight.set('tamper_weld_pins', weldMat);

  // 12. REAR OPTICAL HOUSING SHELL
  const rearOuterShape = createVcaSilhouetteShape(
    params.overallWidthMm,
    params.overallHeightMm,
    params.shoulderChamferMm
  );
  const rearShellGeo = trackGeo(
    new THREE.ExtrudeGeometry(rearOuterShape, {
      depth: params.wallThicknessMm,
      bevelEnabled: true,
      bevelThickness: 0.35,
      bevelSize: 0.35,
      bevelSegments: 2,
      curveSegments: 12,
    })
  );
  const rearShellMesh = new THREE.Mesh(rearShellGeo, rearOpticalMat);
  rearShellMesh.position.z = -halfT;
  rearShellMesh.renderOrder = 1;
  rearShellMesh.userData.componentId = 'rear_housing';
  components.rear_housing.add(rearShellMesh);
  materialsToHighlight.set('rear_housing', rearOpticalMat);

  const rearEdgeGeo = trackGeo(new THREE.EdgesGeometry(rearShellGeo, 28));
  const rearEdgeLines = new THREE.LineSegments(rearEdgeGeo, opticalEdgeMat);
  rearEdgeLines.position.copy(rearShellMesh.position);
  components.rear_housing.add(rearEdgeLines);

  // Store initial emissive & opacity so highlighting and X-ray fade restore cleanly
  materialsToHighlight.forEach((mat) => {
    mat.userData.baseEmissive = mat.emissive.getHex();
    mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
    mat.userData.baseOpacity = mat.opacity;
    mat.userData.baseTransparent = mat.transparent;
  });

  const resetComponentPositions = () => {
    for (const meta of SLAB_COMPONENTS) {
      components[meta.id].position.set(0, 0, 0);
    }
  };

  const updateExplode = (explodeT: number) => {
    for (const meta of SLAB_COMPONENTS) {
      components[meta.id].position.set(0, 0, meta.explodeZOffsetMm * explodeT);
    }
  };

  const applyAssemblyChoreography = (choreo: AssemblyChoreography) => {
    resetComponentPositions();
    components.front_housing.position.z = choreo.frontHousingZMm;
    components.rear_housing.position.z = choreo.rearHousingZMm;
    components.trading_card.position.set(...choreo.cardOffsetMm);
    components.inner_sleeve.position.set(...choreo.cardOffsetMm);
    components.card_support_frame.position.z = choreo.cradleZMm;
    components.nfc_compartment.position.z = choreo.nfcPocketZMm;
    components.nfc_antenna.position.set(...choreo.antennaOffsetMm);
    components.nfc_chip.position.set(...choreo.chipOffsetMm);
    components.cert_label.position.set(...choreo.labelOffsetMm);
    components.hologram_qr_seal.position.set(...choreo.labelOffsetMm);
    components.tamper_weld_pins.position.z = choreo.weldPinsZMm;
  };

  const setSelectedComponent = (selected: SlabComponentId | null) => {
    materialsToHighlight.forEach((mat, id) => {
      if (selected && id === selected) {
        mat.emissive.setHex(0x0ea5e9);
        mat.emissiveIntensity = 0.65;
      } else {
        mat.emissive.setHex(mat.userData.baseEmissive ?? 0x000000);
        mat.emissiveIntensity = mat.userData.baseEmissiveIntensity ?? 0;
      }
    });
  };

  const setClipPlane = (plane: THREE.Plane | null) => {
    const planes = plane ? [plane] : [];
    disposables.materials.forEach((mat) => {
      mat.clippingPlanes = planes;
      mat.clipShadows = true;
      mat.needsUpdate = true;
    });
  };

  const xrayTargets: SlabComponentId[] = [
    'front_housing',
    'rear_housing',
    'cert_label',
    'hologram_qr_seal',
    'perimeter_bezel',
  ];

  const setHousingXray = (opacityFactor: number) => {
    const f = Math.max(0.1, Math.min(1, opacityFactor));
    for (const id of xrayTargets) {
      const mat = materialsToHighlight.get(id);
      if (!mat) continue;
      const baseOp = typeof mat.userData.baseOpacity === 'number' ? mat.userData.baseOpacity : 1;
      const baseTr = Boolean(mat.userData.baseTransparent);
      if (f < 0.99) {
        mat.transparent = true;
        mat.opacity = Math.max(0.025, baseOp * f);
      } else {
        mat.transparent = baseTr;
        mat.opacity = baseOp;
      }
    }
  };

  let blueprintActive = false;
  const setBlueprintStyle = (enabled: boolean) => {
    if (blueprintActive === enabled) return;
    blueprintActive = enabled;
    if (enabled) {
      opticalEdgeMat.color.setHex(0x38bdf8);
      opticalEdgeMat.opacity = 0.92;
      bezelEdgeMat.color.setHex(0x38bdf8);
      bezelEdgeMat.opacity = 0.72;
      cradleOpticalMat.color.setHex(0x38bdf8);
      cradleOpticalMat.opacity = 0.48;
    } else {
      opticalEdgeMat.color.setHex(0xe2f1ff);
      opticalEdgeMat.opacity = 0.44;
      bezelEdgeMat.color.setHex(0xcbd5e1);
      bezelEdgeMat.opacity = 0.32;
      cradleOpticalMat.color.setHex(0xe0f2fe);
      cradleOpticalMat.opacity = 0.14;
    }
  };

  return {
    root,
    components,
    materialsToHighlight,
    disposables,
    updateExplode,
    applyAssemblyChoreography,
    setSelectedComponent,
    setClipPlane,
    setHousingXray,
    setBlueprintStyle,
  };
}
