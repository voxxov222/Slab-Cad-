import * as THREE from 'three';
import QRCode from 'qrcode';
import { SlabParameters } from './types';

export const SAMPLE_CARD_ART_PATH = '/src/assets/images/vca_sample_card_art_1794575122592.jpg';

export function createBrushedRoughnessTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#707070';
  ctx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y++) {
    const v = 96 + Math.floor(((Math.sin(y * 1.7) + Math.cos(y * 0.37)) * 0.5 + 1) * 28);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 512, 1);
  }
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 512;
    const y = (i * 139) % 512;
    const w = 36 + (i % 90);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, w, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createCertLabelTexture(
  params: SlabParameters,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 712;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  // Dark brushed obsidian metallic cardstock base
  const bg = ctx.createLinearGradient(0, 0, 1024, 356);
  bg.addColorStop(0, '#0B0F17');
  bg.addColorStop(0.5, '#131B29');
  bg.addColorStop(1, '#090D14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 356);

  // Subtle guilloche security wave lines across full plate
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.14)';
  ctx.lineWidth = 1.2;
  for (let y = 20; y < 340; y += 14) {
    ctx.beginPath();
    for (let x = 0; x <= 1024; x += 12) {
      const wave = Math.sin(x * 0.025 + y * 0.05) * 6;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  // Precision cyan architectural top/bottom accent stripes
  ctx.fillStyle = '#0EA5E9';
  ctx.fillRect(28, 22, 968, 5);
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(28, 328, 968, 3);

  // VCA Brand Emblem
  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 46px "Outfit", system-ui, sans-serif';
  ctx.fillText('VCA', 32, 84);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText('VERIFIED CARD AUTHORITY · VCASLABS.COM', 142, 78);

  // Card Title & Set (safely clipped to x < 720 so it never touches grade box)
  ctx.save();
  ctx.beginPath();
  ctx.rect(28, 96, 690, 160);
  ctx.clip();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '600 32px "Outfit", system-ui, sans-serif';
  ctx.fillText(params.cardTitle, 32, 146);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(params.cardSet, 32, 186);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText('CEN 10.0   COR 10.0   EDG 10.0   SUR 9.5', 32, 240);
  ctx.restore();

  // Serial Number & NFC Badge
  ctx.fillStyle = '#38BDF8';
  ctx.font = '600 26px "JetBrains Mono", monospace';
  ctx.fillText(params.serialNumber, 32, 302);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 19px "JetBrains Mono", monospace';
  const chipBadge = params.nfcChipConfig === 'ntag424_dna' ? 'NTAG424 AES-128' : 'NTAG215 PROTO';
  ctx.fillText(chipBadge, 285, 302);

  // Grade Box positioned cleanly at the right end of the label plate (x=754..994)
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(754, 52, 240, 256);
  ctx.strokeStyle = '#0EA5E9';
  ctx.lineWidth = 3;
  ctx.strokeRect(754, 52, 240, 256);

  const gradeParts = params.gradeLabel.split('·');
  const mainGrade = (gradeParts[0] || 'VCA 10').trim();
  const subGrade = (gradeParts[1] || 'GEM MINT').trim();

  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 50px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mainGrade, 874, 158);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.fillText(subGrade, 874, 212);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 15px "JetBrains Mono", monospace';
  ctx.fillText('CERTIFIED GRADE', 874, 266);
  ctx.textAlign = 'left';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createHoloQrSealTexture(
  serialNumber: string,
  maxAnisotropy: number,
  onReady?: () => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  // Prismatic holographic foil base
  const holo = ctx.createLinearGradient(0, 0, 512, 512);
  holo.addColorStop(0, '#0E7490');
  holo.addColorStop(0.25, '#38BDF8');
  holo.addColorStop(0.5, '#A5F3FC');
  holo.addColorStop(0.75, '#6366F1');
  holo.addColorStop(1, '#0EA5E9');
  ctx.fillStyle = holo;
  ctx.fillRect(0, 0, 512, 512);

  // Micro-diffraction diagonal lines
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  for (let i = -512; i < 1024; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 512, 512);
    ctx.stroke();
  }

  // Dark framed upper holographic VCA crest
  ctx.fillStyle = 'rgba(9, 12, 17, 0.88)';
  ctx.fillRect(28, 24, 456, 124);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 24, 456, 124);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 40px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VCA SEAL', 256, 82);
  ctx.fillStyle = '#38BDF8';
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillText('NFC + TAMPER PROTECTED', 256, 124);
  ctx.textAlign = 'left';

  // White crisp QR target box at bottom
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(106, 174, 300, 300);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;

  // Render real scannable QR code asynchronously onto the canvas
  const qrCanvas = document.createElement('canvas');
  QRCode.toCanvas(
    qrCanvas,
    `https://vcaslabs.com/v/${serialNumber}`,
    { width: 552, margin: 1, errorCorrectionLevel: 'H' },
    (err) => {
      if (!err) {
        ctx.drawImage(qrCanvas, 118, 186, 276, 276);
        tex.needsUpdate = true;
        onReady?.();
      }
    }
  );

  return tex;
}

export function createTradingCardTextures(
  params: SlabParameters,
  maxAnisotropy: number,
  onReady?: () => void
): { front: THREE.CanvasTexture; back: THREE.CanvasTexture } {
  // 1. Card Front Canvas
  const fCanvas = document.createElement('canvas');
  fCanvas.width = 635;
  fCanvas.height = 889;
  const fCtx = fCanvas.getContext('2d')!;

  const drawFrontFrame = (artImg?: HTMLImageElement) => {
    // Silver-cyan holographic foil border
    const borderGrad = fCtx.createLinearGradient(0, 0, 635, 889);
    borderGrad.addColorStop(0, '#94A3B8');
    borderGrad.addColorStop(0.5, '#E2E8F0');
    borderGrad.addColorStop(1, '#64748B');
    fCtx.fillStyle = borderGrad;
    fCtx.fillRect(0, 0, 635, 889);

    // Inner obsidian dark frame
    fCtx.fillStyle = '#0F172A';
    fCtx.fillRect(24, 24, 587, 841);

    // Artwork window
    if (artImg) {
      fCtx.drawImage(artImg, 44, 96, 547, 430);
    } else {
      const artFallback = fCtx.createLinearGradient(44, 96, 591, 526);
      artFallback.addColorStop(0, '#0C4A6E');
      artFallback.addColorStop(0.5, '#0284C7');
      artFallback.addColorStop(1, '#1E1B4B');
      fCtx.fillStyle = artFallback;
      fCtx.fillRect(44, 96, 547, 430);
    }

    // Art window metallic frame
    fCtx.strokeStyle = '#38BDF8';
    fCtx.lineWidth = 4;
    fCtx.strokeRect(44, 96, 547, 430);

    // Card header bar
    fCtx.fillStyle = '#F8FAFC';
    fCtx.font = '700 28px "Outfit", system-ui, sans-serif';
    fCtx.fillText(params.cardTitle.split('—')[0].trim().slice(0, 24), 46, 74);

    fCtx.fillStyle = '#38BDF8';
    fCtx.font = '700 26px "JetBrains Mono", monospace';
    fCtx.textAlign = 'right';
    fCtx.fillText('HP 320', 588, 74);
    fCtx.textAlign = 'left';

    // Lower card text panel
    fCtx.fillStyle = '#1E293B';
    fCtx.fillRect(44, 548, 547, 250);
    fCtx.strokeStyle = '#334155';
    fCtx.lineWidth = 2;
    fCtx.strokeRect(44, 548, 547, 250);

    fCtx.fillStyle = '#38BDF8';
    fCtx.font = '700 22px "Outfit", system-ui, sans-serif';
    fCtx.fillText('CRYSTAL TEMPEST  ·  180', 68, 608);

    fCtx.fillStyle = '#CBD5E1';
    fCtx.font = '400 18px "Plus Jakarta Sans", system-ui, sans-serif';
    fCtx.fillText('Channels azure plasma across adjacent', 68, 648);
    fCtx.fillText('benched crystalline guardians.', 68, 676);

    fCtx.fillStyle = '#94A3B8';
    fCtx.font = '600 18px "JetBrains Mono", monospace';
    fCtx.fillText(params.cardSet.slice(0, 34), 46, 838);
  };

  drawFrontFrame();
  const frontTex = new THREE.CanvasTexture(fCanvas);
  frontTex.colorSpace = THREE.SRGBColorSpace;
  frontTex.anisotropy = maxAnisotropy;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    drawFrontFrame(img);
    frontTex.needsUpdate = true;
    onReady?.();
  };
  img.src = SAMPLE_CARD_ART_PATH;

  // 2. Card Back Canvas (Geometric Precision Collector Back)
  const bCanvas = document.createElement('canvas');
  bCanvas.width = 635;
  bCanvas.height = 889;
  const bCtx = bCanvas.getContext('2d')!;

  bCtx.fillStyle = '#1E3A8A';
  bCtx.fillRect(0, 0, 635, 889);
  bCtx.fillStyle = '#0F172A';
  bCtx.fillRect(32, 32, 571, 825);
  bCtx.strokeStyle = '#60A5FA';
  bCtx.lineWidth = 6;
  bCtx.strokeRect(48, 48, 539, 793);

  // Center emblem
  bCtx.beginPath();
  bCtx.arc(317.5, 444.5, 130, 0, Math.PI * 2);
  bCtx.fillStyle = '#1D4ED8';
  bCtx.fill();
  bCtx.lineWidth = 8;
  bCtx.strokeStyle = '#93C5FD';
  bCtx.stroke();

  bCtx.fillStyle = '#F8FAFC';
  bCtx.font = '700 42px "Outfit", system-ui, sans-serif';
  bCtx.textAlign = 'center';
  bCtx.fillText('ARCHIVE', 317.5, 458);

  const backTex = new THREE.CanvasTexture(bCanvas);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.anisotropy = maxAnisotropy;

  return { front: frontTex, back: backTex };
}
