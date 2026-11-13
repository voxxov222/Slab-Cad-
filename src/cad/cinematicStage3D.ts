import * as THREE from 'three';
import { ExplainerFrameState } from './explainerTimeline';
import { SlabParameters } from './types';

export interface CinematicStageHandles {
  root: THREE.Group;
  update: (frame: ExplainerFrameState, params: SlabParameters) => void;
  dispose: () => void;
}

function createPhoneScreenTexture(serialNumber: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Deep slate phone UI
    ctx.fillStyle = '#070B12';
    ctx.fillRect(0, 0, 512, 1024);

    // Top status / VCA header
    ctx.fillStyle = '#0EA5E9';
    ctx.fillRect(36, 56, 440, 4);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 22px monospace';
    ctx.fillText('VCASLABS.COM', 36, 104);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 34px sans-serif';
    ctx.fillText('NFC DETECTED', 36, 168);

    // NFC badge card
    ctx.fillStyle = '#0E1726';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(36, 206, 440, 210, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#7DD3FC';
    ctx.font = '600 20px monospace';
    ctx.fillText(`VCA ID: ${serialNumber}`, 64, 258);

    ctx.fillStyle = '#34D399';
    ctx.font = '700 26px sans-serif';
    ctx.fillText('DIGITAL CERTIFICATE FOUND', 64, 308);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 20px monospace';
    ctx.fillText('AES-128 SUN CRYPTO VERIFIED', 64, 356);
    ctx.fillText('INTERFACE: NTAG424 DNA', 64, 390);

    // Certificate summary block
    ctx.fillStyle = '#0D131F';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(36, 452, 440, 470, 18);
    ctx.fill();
    ctx.stroke();

    const rows: [string, string, string][] = [
      ['CARD', 'Aetheris Storm Drake #148', '#F8FAFC'],
      ['GRADE', 'VCA 10 · GEM MINT', '#38BDF8'],
      ['CERT DATE', '2026-11-12', '#CBD5E1'],
      ['STATUS', 'AUTHENTIC · UNTAMPERED', '#34D399'],
      ['NFT RECORD', 'LINKED ON-CHAIN #0202', '#38BDF8'],
      ['OWNERSHIP', 'VERIFIED HOLDER REGISTRY', '#CBD5E1'],
    ];

    rows.forEach(([k, v, color], idx) => {
      const y = 510 + idx * 68;
      ctx.fillStyle = '#64748B';
      ctx.font = '600 18px monospace';
      ctx.fillText(k, 64, y);
      ctx.fillStyle = color;
      ctx.font = '700 22px sans-serif';
      ctx.fillText(v, 64, y + 30);
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function buildCinematicStage(initialSerial: string): CinematicStageHandles {
  const root = new THREE.Group();
  root.visible = false;

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  // 1. Volumetric Floating Dust Particles
  const particleCount = 320;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.sin(i * 12.9898) * 0.5) * 320;
    positions[i * 3 + 1] = ((Math.cos(i * 78.233) * 0.5)) * 220;
    positions[i * 3 + 2] = (Math.sin(i * 45.164) * 0.5) * 260;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometries.push(dustGeo);

  const dustMat = new THREE.PointsMaterial({
    color: 0x7dd3fc,
    size: 1.5,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(dustMat);
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  root.add(dustPoints);

  // Volumetric sweeping light beam plane
  const beamGeo = new THREE.PlaneGeometry(34, 240);
  geometries.push(beamGeo);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(beamMat);
  const sweepBeam = new THREE.Mesh(beamGeo, beamMat);
  sweepBeam.rotation.z = -0.22;
  sweepBeam.position.set(0, 0, 14);
  root.add(sweepBeam);

  // 2. Animated Electromagnetic NFC RF Field Rings
  const rfGroup = new THREE.Group();
  rfGroup.position.set(18, 44, 4);
  const rfRings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  const ringGeo = new THREE.TorusGeometry(11, 0.32, 10, 48);
  geometries.push(ringGeo);

  for (let i = 0; i < 4; i++) {
    const rMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    materials.push(rMat);
    const ring = new THREE.Mesh(ringGeo, rMat);
    rfGroup.add(ring);
    rfRings.push({ mesh: ring, mat: rMat });
  }
  root.add(rfGroup);

  // 3. Sleek 3D Smartphone Prop
  const phoneGroup = new THREE.Group();
  const phoneBodyGeo = new THREE.BoxGeometry(64, 132, 6.5);
  geometries.push(phoneBodyGeo);
  const phoneBodyMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.85,
    roughness: 0.25,
  });
  materials.push(phoneBodyMat);
  const phoneBody = new THREE.Mesh(phoneBodyGeo, phoneBodyMat);
  phoneGroup.add(phoneBody);

  const screenGeo = new THREE.PlaneGeometry(59, 125);
  geometries.push(screenGeo);
  const screenTex = createPhoneScreenTexture(initialSerial);
  textures.push(screenTex);
  const screenMat = new THREE.MeshBasicMaterial({
    map: screenTex,
  });
  materials.push(screenMat);
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.z = 3.35;
  phoneGroup.add(screenMesh);
  phoneGroup.scale.setScalar(0.62);
  phoneGroup.visible = false;
  root.add(phoneGroup);

  // 4. Luminous Blue Data Stream & 5 Blockchain Network Nodes (Scene 04)
  const streamGroup = new THREE.Group();
  const streamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(18, 44, 4),
    new THREE.Vector3(28, 54, 42),
    new THREE.Vector3(-42, 42, 74),
    new THREE.Vector3(-102, 16, 48),
    new THREE.Vector3(-118, -18, -16),
  ]);
  const streamGeo = new THREE.TubeGeometry(streamCurve, 56, 0.55, 8, false);
  geometries.push(streamGeo);
  const streamMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(streamMat);
  const streamTube = new THREE.Mesh(streamGeo, streamMat);
  streamGroup.add(streamTube);

  const nodeGeo = new THREE.OctahedronGeometry(4.2, 1);
  geometries.push(nodeGeo);
  const nodeMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    wireframe: true,
    transparent: true,
    opacity: 0,
  });
  materials.push(nodeMat);

  const nodePoints: [number, number, number][] = [
    [18, 44, 4],
    [28, 54, 42],
    [-42, 42, 74],
    [-102, 16, 48],
    [-118, -18, -16],
  ];
  const nodeMeshes: THREE.Mesh[] = [];
  for (const pos of nodePoints) {
    const nm = new THREE.Mesh(nodeGeo, nodeMat);
    nm.position.set(...pos);
    streamGroup.add(nm);
    nodeMeshes.push(nm);
  }

  const pulseGeo = new THREE.SphereGeometry(1.8, 12, 12);
  geometries.push(pulseGeo);
  const pulseMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0,
  });
  materials.push(pulseMat);
  const pulseSpheres = [
    new THREE.Mesh(pulseGeo, pulseMat),
    new THREE.Mesh(pulseGeo, pulseMat),
    new THREE.Mesh(pulseGeo, pulseMat),
  ];
  pulseSpheres.forEach((s) => streamGroup.add(s));
  streamGroup.visible = false;
  root.add(streamGroup);

  // 5. Industrial Precision Manufacturing Rig (Scene 05)
  const mfgGroup = new THREE.Group();
  const platenGeo = new THREE.BoxGeometry(108, 162, 12);
  geometries.push(platenGeo);
  const platenMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x075985,
    emissiveIntensity: 0.28,
    metalness: 0.72,
    roughness: 0.25,
    transparent: true,
    opacity: 0.38,
  });
  materials.push(platenMat);

  const platenEdgesGeo = new THREE.EdgesGeometry(platenGeo);
  geometries.push(platenEdgesGeo);
  const platenEdgeMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.55,
  });
  materials.push(platenEdgeMat);

  const platenFront = new THREE.Mesh(platenGeo, platenMat);
  platenFront.add(new THREE.LineSegments(platenEdgesGeo, platenEdgeMat));
  const platenRear = new THREE.Mesh(platenGeo, platenMat);
  platenRear.add(new THREE.LineSegments(platenEdgesGeo, platenEdgeMat));
  mfgGroup.add(platenFront);
  mfgGroup.add(platenRear);

  // Robotic NFC vacuum pick-and-place nozzle head
  const nozzleGeo = new THREE.CylinderGeometry(3.5, 2.2, 26, 20);
  geometries.push(nozzleGeo);
  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.9,
    roughness: 0.2,
  });
  materials.push(nozzleMat);
  const nozzleMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzleMesh.rotation.x = Math.PI / 2;
  mfgGroup.add(nozzleMesh);

  // Optical quality inspection laser scan plane
  const laserGeo = new THREE.PlaneGeometry(108, 3.2);
  geometries.push(laserGeo);
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(laserMat);
  const laserBar = new THREE.Mesh(laserGeo, laserMat);
  laserBar.position.set(0, 0, 8);
  mfgGroup.add(laserBar);

  mfgGroup.visible = false;
  root.add(mfgGroup);

  // 6. Electric-Blue Chamfered Outline Trace (Scene 01 & Scene 07)
  const w = 42.6;
  const h = 69.6;
  const ch = 6.5;
  const outlinePts = [
    new THREE.Vector3(-w + ch, h, 3.8),
    new THREE.Vector3(w - ch, h, 3.8),
    new THREE.Vector3(w, h - ch, 3.8),
    new THREE.Vector3(w, -h + ch, 3.8),
    new THREE.Vector3(w - ch, -h, 3.8),
    new THREE.Vector3(-w + ch, -h, 3.8),
    new THREE.Vector3(-w, -h + ch, 3.8),
    new THREE.Vector3(-w, h - ch, 3.8),
  ];
  const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts);
  geometries.push(outlineGeo);
  const outlineMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
  });
  materials.push(outlineMat);
  const outlineLoop = new THREE.LineLoop(outlineGeo, outlineMat);
  root.add(outlineLoop);

  const scratchPos = new THREE.Vector3();
  const scratchAccent = new THREE.Color(0x38bdf8);

  const update = (frame: ExplainerFrameState, params: SlabParameters) => {
    root.visible = true;
    const t = frame.timeSec;
    scratchAccent.set(frame.accentHex || '#38bdf8');

    beamMat.color.copy(scratchAccent);
    outlineMat.color.copy(scratchAccent);
    streamMat.color.copy(scratchAccent);
    nodeMat.color.copy(scratchAccent).lerp(new THREE.Color(0xffffff), 0.25);
    laserMat.color.copy(scratchAccent);
    rfRings.forEach((entry) => entry.mat.color.copy(scratchAccent));

    // Dust subtle drift
    dustPoints.rotation.y = t * 0.035;
    dustMat.opacity = (0.28 + 0.14 * Math.sin(t * 0.8)) * frame.fadeOpacity;

    // Volumetric light sweep (Scene 01 or outline-lit reveals)
    if (frame.segment.id === 'scene-01-reveal' || frame.outlineTraceProgress > 0.35) {
      sweepBeam.visible = true;
      const sweepPhase = Math.sin(frame.segmentLocalT * Math.PI);
      sweepBeam.position.x = -75 + frame.segmentLocalT * 150;
      beamMat.opacity = 0.22 * sweepPhase * frame.fadeOpacity;
    } else {
      sweepBeam.visible = false;
      beamMat.opacity = 0;
    }

    // Perimeter outline trace (Scenes 01, 06, 07, and custom reveals)
    outlineLoop.visible = frame.outlineTraceProgress > 0.01;
    outlineMat.opacity = frame.outlineTraceProgress * 0.85 * frame.fadeOpacity;
    const scaleX = params.overallWidthMm / 84;
    const scaleY = params.overallHeightMm / 138;
    outlineLoop.scale.set(scaleX, scaleY, 1);

    // RF Field Rings
    if (frame.rfFieldIntensity > 0.01) {
      rfGroup.visible = true;
      rfRings.forEach((entry, idx) => {
        const cycle = (t * 0.85 + idx * 0.25) % 1;
        const scale = 0.45 + cycle * 1.45;
        entry.mesh.scale.set(scale, scale, 1);
        entry.mesh.position.z = cycle * 10;
        entry.mat.opacity = (1 - cycle) * 0.65 * frame.rfFieldIntensity * frame.fadeOpacity;
      });
    } else {
      rfGroup.visible = false;
    }

    // Smartphone approach from top-right (matching reference video tap shot)
    if (frame.phoneApproach > 0.02) {
      phoneGroup.visible = true;
      const ease = frame.phoneApproach;
      phoneGroup.position.set(
        52 + (1 - ease) * 58,
        28 + (1 - ease) * 26,
        14 + (1 - ease) * 32
      );
      phoneGroup.rotation.set(
        -0.12 * ease,
        -0.32 + 0.14 * ease,
        0.18 * ease
      );
    } else {
      phoneGroup.visible = false;
    }

    // Data Stream & Network Constellation (Scene 04)
    if (frame.dataStreamProgress > 0.02) {
      streamGroup.visible = true;
      const p = frame.dataStreamProgress;
      streamMat.opacity = 0.52 * p * frame.fadeOpacity;
      nodeMat.opacity = 0.82 * p * frame.fadeOpacity;
      pulseMat.opacity = 0.95 * p * frame.fadeOpacity;
      nodeMeshes.forEach((m, idx) => {
        m.rotation.y = t * 1.1 + idx * 0.7;
        m.rotation.x = t * 0.6;
      });
      pulseSpheres.forEach((s, idx) => {
        const u = (t * 0.45 + idx * 0.33) % 1;
        streamCurve.getPointAt(u, scratchPos);
        s.position.copy(scratchPos);
      });
    } else {
      streamGroup.visible = false;
    }

    // Industrial Manufacturing Sequence (Scene 05)
    if (frame.mfgStageProgress > 0.01) {
      mfgGroup.visible = true;
      const m = frame.mfgStageProgress;
      // Platens close around slab during moulding (0..0.45) then retract
      const platenGap = m < 0.45 ? 16 + Math.abs(0.22 - m) * 145 : 74;
      platenFront.position.set(0, 0, platenGap);
      platenRear.position.set(0, 0, -platenGap);
      platenFront.visible = m < 0.65;
      platenRear.visible = m < 0.65;

      // Robotic nozzle places NFC die during middle phase (0.35..0.72)
      nozzleMesh.visible = m >= 0.3 && m <= 0.75;
      nozzleMesh.position.set(18, 44, 24 + Math.sin(m * Math.PI * 3) * 10);

      // Laser optical scan sweeps vertically across finished slab (0.68..1.0)
      if (m >= 0.65) {
        laserBar.visible = true;
        const scanT = (m - 0.65) / 0.35;
        laserBar.position.y = 70 - scanT * 140;
        laserMat.opacity = 0.95 * frame.fadeOpacity;
      } else {
        laserBar.visible = false;
      }
    } else {
      mfgGroup.visible = false;
    }
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return { root, update, dispose };
}
