import {
  FilmFrameState,
  VIDEO_RESOLUTIONS,
  VideoResolutionId,
} from './filmProduction';

export interface VideoExportHandle {
  updateFrame: (frame: FilmFrameState, serialNumber: string) => void;
  stop: () => Promise<Blob>;
}

/**
 * Clean 16:9 commercial video recorder. Burns in only minimal opening/finale typography
 * and transition opacity envelopes (zero debug telemetry or HUD clutter).
 */
export function startFilmVideoExport(
  sourceCanvas: HTMLCanvasElement,
  audioStream: MediaStream | null,
  resolutionId: VideoResolutionId = '1080p'
): VideoExportHandle {
  const resSpec = VIDEO_RESOLUTIONS[resolutionId] || VIDEO_RESOLUTIONS['1080p'];
  const width = resSpec.width;
  const height = resSpec.height;
  const s = width / 1280;

  const compCanvas = document.createElement('canvas');
  compCanvas.width = width;
  compCanvas.height = height;
  const ctx = compCanvas.getContext('2d');

  let latestFrame: FilmFrameState | null = null;
  let stopped = false;
  let rafId = 0;

  const drawFrame = () => {
    if (stopped || !ctx) return;
    ctx.fillStyle = '#05070B';
    ctx.fillRect(0, 0, width, height);

    const srcW = sourceCanvas.width || 1280;
    const srcH = sourceCanvas.height || 720;
    const scale = Math.max(width / srcW, height / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    ctx.drawImage(sourceCanvas, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);

    if (latestFrame) {
      if (latestFrame.scene.showTitleOverlay === 'opening') {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
        ctx.font = `700 ${Math.round(48 * s)}px "Outfit", sans-serif`;
        ctx.fillText('VCA', 64 * s, 118 * s);
        ctx.fillStyle = '#38BDF8';
        ctx.font = `600 ${Math.round(14 * s)}px "JetBrains Mono", monospace`;
        ctx.fillText('VERIFIED CARD AUTHORITY', 64 * s, 148 * s);
      } else if (latestFrame.scene.showTitleOverlay === 'finale') {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.98)';
        ctx.font = `700 ${Math.round(50 * s)}px "Outfit", sans-serif`;
        ctx.fillText('VCA', 64 * s, height * 0.42);
        ctx.fillStyle = '#38BDF8';
        ctx.font = `600 ${Math.round(15 * s)}px "JetBrains Mono", monospace`;
        ctx.fillText('VERIFIED CARD AUTHORITY', 64 * s, height * 0.42 + 34 * s);
        ctx.fillStyle = '#CBD5E1';
        ctx.font = `500 ${Math.round(18 * s)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText('Trust what you collect.  ·  vcaslabs.com', 64 * s, height * 0.42 + 72 * s);
      }

      if (latestFrame.videoOpacity < 0.999) {
        ctx.fillStyle = `rgba(3, 5, 8, ${1 - latestFrame.videoOpacity})`;
        ctx.fillRect(0, 0, width, height);
      }
    }

    rafId = requestAnimationFrame(drawFrame);
  };
  rafId = requestAnimationFrame(drawFrame);

  const videoStream = compCanvas.captureStream(30);
  const combinedStream = new MediaStream();
  videoStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));
  if (audioStream) {
    audioStream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
  }

  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: mime,
    videoBitsPerSecond: resSpec.bitrate,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(250);

  return {
    updateFrame(frame: FilmFrameState) {
      latestFrame = frame;
    },
    stop(): Promise<Blob> {
      return new Promise((resolve) => {
        stopped = true;
        cancelAnimationFrame(rafId);
        if (recorder.state === 'inactive') {
          resolve(new Blob(chunks, { type: mime }));
          return;
        }
        recorder.onstop = () => {
          videoStream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: mime }));
        };
        recorder.stop();
      });
    },
  };
}
