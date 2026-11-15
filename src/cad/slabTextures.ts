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

function drawBarcode1D(
  ctx: CanvasRenderingContext2D,
  seed: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  // Deterministic crisp Code-128 style vertical bars seeded from serial number
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  ctx.fillStyle = '#090D16';
  let cursor = x;
  const end = x + w;
  let step = 0;
  // Guard bars on left
  ctx.fillRect(cursor, y, 3, h);
  cursor += 5;
  ctx.fillRect(cursor, y, 3, h);
  cursor += 6;

  while (cursor < end - 14) {
    const bits = (hash ^ (step * 2654435761)) >>> 0;
    const barW = 2 + (bits % 4);
    const gapW = 2 + ((bits >> 3) % 4);
    if (cursor + barW <= end - 12) {
      ctx.fillRect(cursor, y, barW, h);
    }
    cursor += barW + gapW;
    step++;
  }
  // Guard bars on right
  ctx.fillRect(end - 10, y, 3, h);
  ctx.fillRect(end - 5, y, 3, h);
}

function drawFugitiveInkPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Subtle pearlescent white security stock
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(x, y, w, h);

  // Faint cyan-slate guilloche wavy security lines
  ctx.strokeStyle = 'rgba(14, 116, 144, 0.11)';
  ctx.lineWidth = 1.25;
  for (let row = y - 16; row < y + h + 20; row += 10) {
    ctx.beginPath();
    for (let px = x; px <= x + w; px += 10) {
      const dy = Math.sin(px * 0.022 + row * 0.07) * 5.5 + Math.cos(px * 0.011) * 3.0;
      if (px === x) ctx.moveTo(px, row + dy);
      else ctx.lineTo(px, row + dy);
    }
    ctx.stroke();
  }

  // Subtle embossed VCA crest watermark on right half
  ctx.fillStyle = 'rgba(29, 78, 216, 0.045)';
  ctx.font = '800 130px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VCA', x + w * 0.56, y + h * 0.72);
  ctx.textAlign = 'left';

  ctx.restore();
}

/**
 * FRONT OF LABEL (Classic VCA Blue & Red Split Trim + Fugitive Ink + Barcode + Chrome VCA Hologram Badge)
 */
export function createCertLabelTexture(
  params: SlabParameters,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 712;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  const W = 1024;
  const H = 356;

  // Classic VCA Split Trim: Left Deep Royal Blue, Right Crimson Red
  const blueGrad = ctx.createLinearGradient(0, 0, W / 2, H);
  blueGrad.addColorStop(0, '#0A2E73');
  blueGrad.addColorStop(0.5, '#1D4ED8');
  blueGrad.addColorStop(1, '#0F3D99');
  ctx.fillStyle = blueGrad;
  ctx.fillRect(0, 0, W / 2, H);

  const redGrad = ctx.createLinearGradient(W / 2, 0, W, H);
  redGrad.addColorStop(0, '#B91C1C');
  redGrad.addColorStop(0.5, '#DC2626');
  redGrad.addColorStop(1, '#991B1B');
  ctx.fillStyle = redGrad;
  ctx.fillRect(W / 2, 0, W / 2, H);

  // Outer silver-chrome metallic bevel border
  const chromeOuter = ctx.createLinearGradient(0, 0, W, H);
  chromeOuter.addColorStop(0, '#E2E8F0');
  chromeOuter.addColorStop(0.5, '#94A3B8');
  chromeOuter.addColorStop(1, '#F1F5F9');
  ctx.strokeStyle = chromeOuter;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // Inner bright fugitive-ink security card window
  const insetX = 28;
  const insetY = 26;
  const insetW = W - 56;
  const insetH = H - 52;
  drawFugitiveInkPattern(ctx, insetX, insetY, insetW, insetH);

  // Fine dark pinstripe around white security insert
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.strokeRect(insetX, insetY, insetW, insetH);

  // Left Info Block: Title, Set, Subgrades, 1D Barcode
  ctx.save();
  ctx.beginPath();
  ctx.rect(42, 34, 620, 200);
  ctx.clip();

  const rawParts = params.cardTitle.split('—');
  const cardMain = (rawParts[0] || params.cardTitle).trim().toUpperCase();
  const cardSub = (rawParts[1] || 'CERTIFIED EDITION').trim().toUpperCase();

  ctx.fillStyle = '#090D16';
  ctx.font = '700 32px "Outfit", system-ui, sans-serif';
  ctx.fillText(params.cardSet.toUpperCase().slice(0, 32), 48, 82);

  ctx.font = '800 36px "Outfit", system-ui, sans-serif';
  ctx.fillText(cardMain.slice(0, 26), 48, 128);

  ctx.fillStyle = '#1E293B';
  ctx.font = '600 24px "JetBrains Mono", monospace';
  ctx.fillText(cardSub.slice(0, 30), 48, 168);

  ctx.fillStyle = '#475569';
  ctx.font = '600 17px "JetBrains Mono", monospace';
  ctx.fillText('VERIFIED CARD AUTHORITY · VCASLABS.COM', 48, 206);
  ctx.restore();

  // Bottom-Left Crisp 1D Barcode
  drawBarcode1D(ctx, params.serialNumber, 48, 224, 340, 62);

  // Right Grade & Serial Block
  const gradeParts = params.gradeLabel.split('·');
  const mainToken = (gradeParts[0] || 'VCA 10').trim();
  const gradeNumMatch = mainToken.match(/(\d+(?:\.\d+)?)/);
  const gradeNumber = gradeNumMatch ? gradeNumMatch[1] : '10';
  const gradeWords = (gradeParts[1] || 'GEM MT').trim().toUpperCase();

  ctx.textAlign = 'right';
  ctx.fillStyle = '#090D16';
  ctx.font = '700 28px "JetBrains Mono", monospace';
  ctx.fillText('#148', W - 50, 82);

  ctx.font = '800 32px "Outfit", system-ui, sans-serif';
  ctx.fillText(gradeWords, W - 50, 134);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 54px "Outfit", system-ui, sans-serif';
  ctx.fillText(gradeNumber, W - 50, 198);

  ctx.fillStyle = '#090D16';
  ctx.font = '700 32px "JetBrains Mono", monospace';
  ctx.fillText(params.serialNumber, W - 50, 276);
  ctx.textAlign = 'left';

  // Bottom-Center Chrome VCA Hologram Badge straddling the blue/red split trim
  const badgeW = 148;
  const badgeH = 66;
  const badgeX = (W - badgeW) / 2;
  const badgeY = H - badgeH - 12;

  const bezelGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
  bezelGrad.addColorStop(0, '#F8FAFC');
  bezelGrad.addColorStop(0.45, '#94A3B8');
  bezelGrad.addColorStop(1, '#E2E8F0');
  ctx.fillStyle = bezelGrad;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fill();

  const innerHoloGrad = ctx.createLinearGradient(badgeX + 6, badgeY + 6, badgeX + badgeW - 6, badgeY + badgeH - 6);
  innerHoloGrad.addColorStop(0, '#CBD5E1');
  innerHoloGrad.addColorStop(0.35, '#E0F2FE');
  innerHoloGrad.addColorStop(0.68, '#93C5FD');
  innerHoloGrad.addColorStop(1, '#CBD5E1');
  ctx.fillStyle = innerHoloGrad;
  ctx.beginPath();
  ctx.roundRect(badgeX + 6, badgeY + 6, badgeW - 12, badgeH - 12, 5);
  ctx.fill();

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(badgeX + 6, badgeY + 6, badgeW - 12, badgeH - 12);

  ctx.fillStyle = '#0B3B8C';
  ctx.font = '800 40px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VCA', W / 2, badgeY + 48);
  ctx.textAlign = 'left';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * BACK OF LABEL (Dark Navy UV VCA Watermark Band + Center Prismatic VCA Hologram + QR Code + Lower Barcode/Serial Strip)
 */
export function createCertLabelBackTexture(
  params: SlabParameters,
  maxAnisotropy: number,
  onReady?: () => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 712;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  const W = 1024;
  const H = 356;
  const topH = 262;

  // Deep Midnight Navy UV Background
  const navyGrad = ctx.createLinearGradient(0, 0, W, topH);
  navyGrad.addColorStop(0, '#040916');
  navyGrad.addColorStop(0.5, '#09152E');
  navyGrad.addColorStop(1, '#040916');
  ctx.fillStyle = navyGrad;
  ctx.fillRect(0, 0, W, topH);

  // Subtle UV Repeating VCA Pattern on Left/Back Band
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, topH);
  ctx.clip();
  ctx.fillStyle = 'rgba(186, 230, 253, 0.21)';
  ctx.font = '800 22px "Outfit", system-ui, sans-serif';
  for (let row = 28; row < topH; row += 34) {
    for (let col = 14; col < 385; col += 80) {
      ctx.fillText('VCA', col + ((row / 34) % 2) * 24, row);
    }
  }
  ctx.restore();

  // Prominent Metallic Silver VCA Logo on Left
  const silverGrad = ctx.createLinearGradient(44, 68, 296, 208);
  silverGrad.addColorStop(0, '#CBD5E1');
  silverGrad.addColorStop(0.45, '#FFFFFF');
  silverGrad.addColorStop(1, '#64748B');
  ctx.fillStyle = silverGrad;
  ctx.font = '900 112px "Outfit", system-ui, sans-serif';
  ctx.fillText('VCA', 46, 174);

  // Center Prismatic & Silver Split VCA Hologram Shield
  const shieldX = 408;
  const shieldY = 26;
  const shieldW = 228;
  const shieldH = 206;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(shieldX, shieldY);
  ctx.lineTo(shieldX + shieldW, shieldY);
  ctx.lineTo(shieldX + shieldW, shieldY + shieldH * 0.68);
  ctx.lineTo(shieldX + shieldW / 2, shieldY + shieldH);
  ctx.lineTo(shieldX, shieldY + shieldH * 0.68);
  ctx.closePath();
  ctx.clip();

  // Left rainbow diffraction + right silver flake
  const prism = ctx.createLinearGradient(shieldX, shieldY, shieldX + shieldW / 2, shieldY + shieldH);
  prism.addColorStop(0, '#0284C7');
  prism.addColorStop(0.32, '#38BDF8');
  prism.addColorStop(0.65, '#FDE047');
  prism.addColorStop(1, '#FB7185');
  ctx.fillStyle = prism;
  ctx.fillRect(shieldX, shieldY, shieldW / 2, shieldH);

  const foil = ctx.createLinearGradient(shieldX + shieldW / 2, shieldY, shieldX + shieldW, shieldY + shieldH);
  foil.addColorStop(0, '#CBD5E1');
  foil.addColorStop(0.5, '#F1F5F9');
  foil.addColorStop(1, '#94A3B8');
  ctx.fillStyle = foil;
  ctx.fillRect(shieldX + shieldW / 2, shieldY, shieldW / 2, shieldH);

  // Fine holographic micro-grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.5;
  for (let i = -200; i < 400; i += 14) {
    ctx.beginPath();
    ctx.moveTo(shieldX + i, shieldY);
    ctx.lineTo(shieldX + i + 160, shieldY + shieldH);
    ctx.stroke();
  }

  // Bi-color VCA Emblem on Hologram Shield
  ctx.font = '900 58px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F3D99';
  ctx.fillText('VCA', shieldX + shieldW / 2, shieldY + 114);
  ctx.textAlign = 'left';
  ctx.restore();

  // Right White Rounded-Corner QR Verification Container
  const qrBoxSize = 216;
  const qrBoxX = W - qrBoxSize - 38;
  const qrBoxY = 22;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16);
  ctx.fill();

  // Lower White Fugitive-Ink Strip (H: 262..356)
  drawFugitiveInkPattern(ctx, 0, topH, W, H - topH);
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(0, topH, W, 3);

  // Bottom-Left Barcode & Bottom-Right Serial Number
  drawBarcode1D(ctx, params.serialNumber, 44, topH + 15, 360, 64);
  ctx.fillStyle = '#090D16';
  ctx.font = '700 40px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(params.serialNumber, W - 40, topH + 62);
  ctx.textAlign = 'left';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;

  const qrCanvas = document.createElement('canvas');
  QRCode.toCanvas(
    qrCanvas,
    `https://vcaslabs.com/v/${params.serialNumber}`,
    { width: 392, margin: 1, errorCorrectionLevel: 'H' },
    (err) => {
      if (!err) {
        ctx.drawImage(qrCanvas, qrBoxX + 10, qrBoxY + 10, qrBoxSize - 20, qrBoxSize - 20);
        // Subtle crisp VCA emblem in center of QR code
        const cx = qrBoxX + qrBoxSize / 2;
        const cy = qrBoxY + qrBoxSize / 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cx - 24, cy - 12, 48, 24);
        ctx.fillStyle = '#0F3D99';
        ctx.font = '800 16px "Outfit", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VCA', cx, cy + 6);
        ctx.textAlign = 'left';
        tex.needsUpdate = true;
        onReady?.();
      }
    }
  );

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

  // Prismatic Left Diffraction & Silver Foil Right Split (matching VCA Hologram Shield)
  const prism = ctx.createLinearGradient(0, 0, 256, 512);
  prism.addColorStop(0, '#0284C7');
  prism.addColorStop(0.35, '#38BDF8');
  prism.addColorStop(0.68, '#FDE047');
  prism.addColorStop(1, '#FB7185');
  ctx.fillStyle = prism;
  ctx.fillRect(0, 0, 256, 512);

  const silver = ctx.createLinearGradient(256, 0, 512, 512);
  silver.addColorStop(0, '#CBD5E1');
  silver.addColorStop(0.5, '#F8FAFC');
  silver.addColorStop(1, '#94A3B8');
  ctx.fillStyle = silver;
  ctx.fillRect(256, 0, 256, 512);

  // Micro-diffraction diagonal lines
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  for (let i = -512; i < 1024; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 512, 512);
    ctx.stroke();
  }

  // Metallic VCA Hologram Emblem in center
  ctx.fillStyle = 'rgba(10, 46, 115, 0.92)';
  ctx.fillRect(54, 150, 404, 152);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.strokeRect(54, 150, 404, 152);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 84px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VCA', 256, 242);
  ctx.fillStyle = '#7DD3FC';
  ctx.font = '700 18px "JetBrains Mono", monospace';
  ctx.fillText('HOLOGRAPHIC SECURITY SEAL', 256, 282);
  ctx.textAlign = 'left';

  // Micro Serial Strip at bottom
  ctx.fillStyle = 'rgba(6, 13, 30, 0.88)';
  ctx.fillRect(54, 344, 404, 92);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '700 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(serialNumber, 256, 398);
  ctx.textAlign = 'left';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  onReady?.();

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
    // Crisp brushed silver-steel holographic border
    const borderGrad = fCtx.createLinearGradient(0, 0, 635, 889);
    borderGrad.addColorStop(0, '#CBD5E1');
    borderGrad.addColorStop(0.5, '#F8FAFC');
    borderGrad.addColorStop(1, '#94A3B8');
    fCtx.fillStyle = borderGrad;
    fCtx.fillRect(0, 0, 635, 889);

    // Deep crisp obsidian inner card frame
    fCtx.fillStyle = '#090E1A';
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
    fCtx.fillStyle = '#111827';
    fCtx.fillRect(44, 548, 547, 250);
    fCtx.strokeStyle = '#334155';
    fCtx.lineWidth = 2;
    fCtx.strokeRect(44, 548, 547, 250);

    fCtx.fillStyle = '#38BDF8';
    fCtx.font = '700 22px "Outfit", system-ui, sans-serif';
    fCtx.fillText('CRYSTAL TEMPEST  ·  180', 68, 608);

    fCtx.fillStyle = '#E2E8F0';
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
