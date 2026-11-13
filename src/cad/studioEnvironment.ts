import * as THREE from 'three';
import { createBrushedRoughnessTexture } from './slabTextures';
import { SlabParameters } from './types';

export interface StudioStageHandles {
  root: THREE.Group;
  plinthGroup: THREE.Group;
  phoneGroup: THREE.Group;
  updatePhoneTap: (
    approach: number,
    verifiedProgress: number,
    slabRotationY: number,
    params: SlabParameters
  ) => void;
  updatePhoneSerial: (serialNumber: string) => void;
  dispose: () => void;
}

/**
 * Generates a commercial dark-room photography environment map with crisp softbox light strips
 * so transparent polycarbonate bevels and brushed graphite edges catch realistic studio reflections.
 */
export function buildStudioReflectionEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x030508);

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const addSoftbox = (
    w: number,
    h: number,
    colorHex: number,
    intensity: number,
    pos: [number, number, number],
    lookAt: [number, number, number]
  ) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    geos.push(geo);
    mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.lookAt(...lookAt);
    envScene.add(mesh);
  };

  // Large soft overhead diffuser strip (sculpts top chamfers & glass face)
  addSoftbox(28, 8, 0xf8fafc, 3.8, [0, 18, 6], [0, 0, 0]);
  // Crisp camera-left warm-neutral key strip
  addSoftbox(9, 26, 0xfff5e6, 3.4, [-16, 4, 12], [0, 0, 0]);
  // Camera-right cool fill strip
  addSoftbox(7, 24, 0xe0f2fe, 2.1, [17, 2, 10], [0, 0, 0]);
  // Rear cyan architectural edge rim strip
  addSoftbox(24, 5, 0x38bdf8, 2.8, [0, 9, -18], [0, 0, 0]);
  // Subtle lower studio bounce floor
  addSoftbox(32, 32, 0x0f172a, 0.7, [0, -14, 0], [0, 0, 0]);

  const rt = pmrem.fromScene(envScene, 0.025);

  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  pmrem.dispose();

  return rt.texture;
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.45, 'rgba(2, 6, 14, 0.45)');
  grad.addColorStop(1, 'rgba(2, 6, 14, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createRoundedPhoneShape(w: number, h: number, r: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

function drawPhoneVerificationCanvas(
  canvas: HTMLCanvasElement,
  serialNumber: string,
  verified: boolean
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#060910';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle top speaker pill & status bar
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(204, 24, 104, 16, 8);
  ctx.fill();

  ctx.fillStyle = '#64748B';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText('VCASLABS.COM', 40, 88);

  if (!verified) {
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '600 30px "Outfit", sans-serif';
    ctx.fillText('Ready to Read', 40, 160);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '400 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Hold top edge over VCA label', 40, 200);

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(256, 440, 68, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(256, 440, 40, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
    return;
  }

  // Verified state
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(36, 128, 440, 198, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#34D399';
  ctx.font = '700 22px "JetBrains Mono", monospace';
  ctx.fillText('NFC AUTHENTICATED', 64, 178);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 30px "Outfit", sans-serif';
  ctx.fillText(serialNumber, 64, 224);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText('NTAG424 SUN CMAC VALID', 64, 266);
  ctx.fillText('RECORD LINKED ON-CHAIN', 64, 298);

  // Asset Details
  ctx.fillStyle = '#0B101A';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(36, 362, 440, 560, 18);
  ctx.fill();
  ctx.stroke();

  const rows: [string, string, string][] = [
    ['ASSET', 'Aetheris Storm Drake', '#F8FAFC'],
    ['GRADE', 'VCA 10 · GEM MINT', '#38BDF8'],
    ['SEAL STATUS', 'INTACT · NO TAMPER', '#34D399'],
    ['ACCESS MODEL', 'NFC KEY → LEDGER', '#CBD5E1'],
    ['REGISTRY', 'VCASLABS.COM', '#94A3B8'],
  ];

  rows.forEach(([k, v, color], idx) => {
    const y = 424 + idx * 96;
    ctx.fillStyle = '#64748B';
    ctx.font = '600 17px "JetBrains Mono", monospace';
    ctx.fillText(k, 64, y);
    ctx.fillStyle = color;
    ctx.font = '600 24px "Outfit", sans-serif';
    ctx.fillText(v, 64, y + 34);
  });
}

export function buildStudioStage(
  initialSerial: string,
  maxAnisotropy: number
): StudioStageHandles {
  const root = new THREE.Group();
  root.visible = false;

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];

  const brushedTex = createBrushedRoughnessTexture(maxAnisotropy);
  texs.push(brushedTex);

  // 1. Commercial Studio Pedestal & Seamless Floor Shadow
  const plinthGroup = new THREE.Group();

  const floorGeo = new THREE.CircleGeometry(320, 48);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x06080d,
    roughness: 0.78,
    metalness: 0.12,
  });
  geos.push(floorGeo);
  mats.push(floorMat);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -76;
  floorMesh.receiveShadow = true;
  plinthGroup.add(floorMesh);

  const shadowTex = createRadialShadowTexture();
  texs.push(shadowTex);
  const contactGeo = new THREE.PlaneGeometry(165, 165);
  const contactMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  geos.push(contactGeo);
  mats.push(contactMat);
  const contactMesh = new THREE.Mesh(contactGeo, contactMat);
  contactMesh.rotation.x = -Math.PI / 2;
  contactMesh.position.y = -75.95;
  plinthGroup.add(contactMesh);

  // Chamfered precision anodized optical plinth directly beneath the slab (-75.9 -> -71.5)
  const lathePts = [
    new THREE.Vector2(0, -75.9),
    new THREE.Vector2(62, -75.9),
    new THREE.Vector2(62, -73.4),
    new THREE.Vector2(57, -71.2),
    new THREE.Vector2(0, -71.2),
  ];
  const plinthGeo = new THREE.LatheGeometry(lathePts, 64);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x111722,
    roughness: 0.36,
    roughnessMap: brushedTex,
    metalness: 0.68,
    envMapIntensity: 1.35,
  });
  geos.push(plinthGeo);
  mats.push(plinthMat);
  const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
  plinthMesh.receiveShadow = true;
  plinthMesh.castShadow = true;
  plinthGroup.add(plinthMesh);

  root.add(plinthGroup);

  // 2. 1:1 Scale Physical Smartphone NFC Reader (71 x 146 x 7.6 mm)
  const phoneGroup = new THREE.Group();
  const phoneShape = createRoundedPhoneShape(71, 146, 9);
  const phoneBodyGeo = new THREE.ExtrudeGeometry(phoneShape, {
    depth: 6.4,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.6,
    bevelSegments: 3,
    curveSegments: 16,
  });
  const phoneBodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    roughness: 0.28,
    roughnessMap: brushedTex,
    metalness: 0.88,
    envMapIntensity: 1.6,
  });
  geos.push(phoneBodyGeo);
  mats.push(phoneBodyMat);
  const phoneBodyMesh = new THREE.Mesh(phoneBodyGeo, phoneBodyMat);
  phoneBodyMesh.position.z = -3.2;
  phoneBodyMesh.castShadow = true;
  phoneGroup.add(phoneBodyMesh);

  // Front OLED Glass Display
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512;
  screenCanvas.height = 1024;
  drawPhoneVerificationCanvas(screenCanvas, initialSerial, false);
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = maxAnisotropy;
  texs.push(screenTex);

  const screenShape = createRoundedPhoneShape(66.5, 140, 7.2);
  const screenGeo = new THREE.ShapeGeometry(screenShape, 16);
  // Normalize UVs onto [0..1]
  const posAttr = screenGeo.attributes.position;
  const uvs = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    uvs[i * 2] = (posAttr.getX(i) + 33.25) / 66.5;
    uvs[i * 2 + 1] = (posAttr.getY(i) + 70) / 140;
  }
  screenGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geos.push(screenGeo);

  const screenMat = new THREE.MeshPhysicalMaterial({
    map: screenTex,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    emissive: 0xffffff,
    emissiveMap: screenTex,
    emissiveIntensity: 0.42,
  });
  mats.push(screenMat);

  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.z = 3.85;
  phoneGroup.add(screenMesh);

  // Rear machined camera island
  const camIslandGeo = new THREE.BoxGeometry(24, 24, 1.8);
  const camIslandMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.25,
    metalness: 0.75,
  });
  geos.push(camIslandGeo);
  mats.push(camIslandMat);
  const camIsland = new THREE.Mesh(camIslandGeo, camIslandMat);
  camIsland.position.set(-16, 50, -4.4);
  phoneGroup.add(camIsland);

  phoneGroup.visible = false;
  root.add(phoneGroup);

  let currentSerial = initialSerial;
  let lastVerifiedState = false;

  const updatePhoneSerial = (serialNumber: string) => {
    if (serialNumber !== currentSerial) {
      currentSerial = serialNumber;
      drawPhoneVerificationCanvas(screenCanvas, currentSerial, lastVerifiedState);
      screenTex.needsUpdate = true;
    }
  };

  const updatePhoneTap = (
    approach: number,
    verifiedProgress: number,
    slabRotationY: number,
    params: SlabParameters
  ) => {
    if (params.serialNumber !== currentSerial) {
      currentSerial = params.serialNumber;
      drawPhoneVerificationCanvas(screenCanvas, currentSerial, lastVerifiedState);
      screenTex.needsUpdate = true;
    }

    const isVerified = verifiedProgress >= 0.45;
    if (isVerified !== lastVerifiedState) {
      lastVerifiedState = isVerified;
      drawPhoneVerificationCanvas(screenCanvas, currentSerial, isVerified);
      screenTex.needsUpdate = true;
    }

    if (approach <= 0.02) {
      phoneGroup.visible = false;
      return;
    }

    phoneGroup.visible = true;
    // Align top NFC coil region of the phone cleanly over the upper-right NFC pocket
    // without obstructing the card window on the lower half of the slab.
    const nfcBayX = params.labelWidthMm / 2 - params.nfcPocketWidthMm / 2 - 1.5;
    const nfcBayY = params.overallHeightMm / 2 - params.labelHeightMm / 2 - 6.0;

    // Position the phone cleanly angled beside/over the upper NFC bay
    const targetX = nfcBayX + 38;
    const targetY = nfcBayY - 22;
    const targetZ = 14;

    const ease = approach;
    phoneGroup.position.set(
      targetX + (1 - ease) * 90,
      targetY + (1 - ease) * 32,
      targetZ + (1 - ease) * 65
    );
    phoneGroup.rotation.set(
      -0.18 * ease,
      slabRotationY - 0.32 * ease,
      0.14 * ease
    );
  };

  const dispose = () => {
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((t) => t.dispose());
  };

  return {
    root,
    plinthGroup,
    phoneGroup,
    updatePhoneTap,
    updatePhoneSerial,
    dispose,
  };
}
