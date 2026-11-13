import {
  CreatedVideoFrameState,
  CreatedVideoScene,
  PositionedLeaderCallout,
  StudioVoiceId,
  STUDIO_VOICES,
  VIDEO_RESOLUTIONS,
  VideoResolutionId,
  formatTimecode,
} from './videoCreator';

export type VoiceEngineMode = 'checking' | 'gemini' | 'browser-speech';
export type ExportMediaFormat = 'mp4-regular' | 'mp4-hd' | 'mp4-4k' | 'mp3';

function selectStudioSpeechVoice(voiceId: StudioVoiceId): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = englishVoices.length ? englishVoices : voices;
  const preferFemale = voiceId === 'Kore' || voiceId === 'Zephyr';

  const hints = preferFemale
    ? ['google us english', 'samantha', 'victoria', 'zira', 'karen', 'female']
    : ['google uk english male', 'google us english male', 'microsoft david', 'microsoft mark', 'daniel', 'alex', 'male'];

  for (const hint of hints) {
    const match = pool.find((v) => v.name.toLowerCase().includes(hint));
    if (match) return match;
  }
  return pool[0] || null;
}

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function encodeWavFromAudioBuffer(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

export async function transcodeMediaBlob(
  blob: Blob,
  format: ExportMediaFormat,
  serialNumber: string
): Promise<{ blob: Blob; filename: string }> {
  const ext = format === 'mp3' ? 'mp3' : 'mp4';
  const suffix =
    format === 'mp3'
      ? 'Voiceover-Audio'
      : format === 'mp4-regular'
        ? 'Presentation-Regular-480p'
        : format === 'mp4-4k'
          ? 'Presentation-4K-2160p'
          : 'Presentation-HD-1080p';
  const filename = `${serialNumber}-${suffix}.${ext}`;

  const res = await fetch(
    `/api/export-media?format=${encodeURIComponent(format)}&serial=${encodeURIComponent(serialNumber)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Export transcode failed');
    throw new Error(errText || `Export failed (${res.status})`);
  }
  const outBlob = await res.blob();
  return { blob: outBlob, filename };
}

/**
 * Pure voiceover audio director — strictly human-sounding narration ONLY.
 * Contains zero background music synthesizers and zero sound effects.
 */
export class VoiceoverAudioDirector {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private cache = new Map<string, AudioBuffer>();
  private inFlight = new Map<string, Promise<VoiceEngineMode>>();
  private mode: VoiceEngineMode = 'checking';
  private muted = false;

  public getMode(): VoiceEngineMode {
    return this.mode;
  }

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = 1.0;

      this.streamDest = this.ctx.createMediaStreamDestination();

      this.voiceGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.streamDest);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public getOutputMediaStream(): MediaStream | null {
    this.ensureContext();
    return this.streamDest?.stream || null;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.04);
    }
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public stopSpeech(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch {
        // ignore
      }
      this.activeSource.disconnect();
      this.activeSource = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public async prefetchSegment(
    segmentId: string,
    text: string,
    voiceName: StudioVoiceId
  ): Promise<VoiceEngineMode> {
    const cleanText = text.trim();
    if (!cleanText) return this.mode;

    const key = `${voiceName}:${segmentId}:${cleanText}`;
    if (this.cache.has(key)) {
      this.mode = 'gemini';
      return 'gemini';
    }
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const voiceMeta = STUDIO_VOICES.find((v) => v.id === voiceName) || STUDIO_VOICES[0];

    const request = (async (): Promise<VoiceEngineMode> => {
      try {
        const res = await fetch('/api/voiceover-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            voiceName,
            style: `${voiceMeta.tone} recording clean studio voiceover with natural pacing and zero background audio`,
          }),
        });

        if (!res.ok) {
          if (this.mode === 'checking') this.mode = 'browser-speech';
          return 'browser-speech';
        }

        const data = (await res.json()) as { available?: boolean; audioBase64?: string };
        if (!data.available || !data.audioBase64) {
          if (this.mode === 'checking') this.mode = 'browser-speech';
          return 'browser-speech';
        }

        const ctx = this.ensureContext();
        const arrayBuf = decodeBase64ToArrayBuffer(data.audioBase64);
        const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
        this.cache.set(key, audioBuf);
        this.mode = 'gemini';
        return 'gemini';
      } catch {
        if (this.mode === 'checking') this.mode = 'browser-speech';
        return 'browser-speech';
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, request);
    return request;
  }

  public async prefetchAll(
    voiceName: StudioVoiceId,
    scenes: CreatedVideoScene[],
    onProgress?: (readyCount: number) => void
  ): Promise<VoiceEngineMode> {
    if (scenes.length === 0) return 'browser-speech';
    let count = 0;
    const first = await this.prefetchSegment(scenes[0].id, scenes[0].narration, voiceName);
    count += 1;
    onProgress?.(count);

    if (first !== 'gemini') {
      return 'browser-speech';
    }

    for (let i = 1; i < scenes.length; i++) {
      await new Promise((r) => window.setTimeout(r, 280));
      const seg = scenes[i];
      await this.prefetchSegment(seg.id, seg.narration, voiceName);
      count += 1;
      onProgress?.(count);
    }
    return this.mode;
  }

  public async speakSegment(
    segmentId: string,
    text: string,
    voiceName: StudioVoiceId
  ): Promise<VoiceEngineMode> {
    this.stopSpeech();
    const cleanText = text.trim();
    if (!cleanText) return this.mode;

    const key = `${voiceName}:${segmentId}:${cleanText}`;
    let buffer = this.cache.get(key);

    if (!buffer && this.mode !== 'browser-speech') {
      await this.prefetchSegment(segmentId, cleanText, voiceName);
      buffer = this.cache.get(key);
    }

    if (buffer && this.ctx && this.voiceGain) {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.voiceGain);
      src.start();
      this.activeSource = src;
      return 'gemini';
    }

    if (!this.muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const picked = selectStudioSpeechVoice(voiceName);
      if (picked) utterance.voice = picked;
      utterance.pitch = voiceName === 'Kore' || voiceName === 'Zephyr' ? 1.0 : 0.88;
      utterance.rate = 0.96;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
    return 'browser-speech';
  }

  public async renderVoiceoverOnlyWav(
    voiceName: StudioVoiceId,
    scenes: CreatedVideoScene[]
  ): Promise<Blob> {
    await this.prefetchAll(voiceName, scenes);
    const totalSec = scenes[scenes.length - 1]?.endSec || 36;
    const sampleRate = 48000;
    const offline = new OfflineAudioContext(2, Math.ceil(totalSec * sampleRate), sampleRate);

    scenes.forEach((seg) => {
      const key = `${voiceName}:${seg.id}:${seg.narration.trim()}`;
      const voiceBuf = this.cache.get(key);
      if (voiceBuf) {
        const src = offline.createBufferSource();
        src.buffer = voiceBuf;
        src.connect(offline.destination);
        src.start(seg.startSec + 0.2);
      }
    });

    const rendered = await offline.startRendering();
    return encodeWavFromAudioBuffer(rendered);
  }

  public dispose(): void {
    this.stopSpeech();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.cache.clear();
    this.inFlight.clear();
  }
}

export interface VideoRecorderHandle {
  stop: () => Promise<Blob>;
  updateOverlayFrame: (frame: CreatedVideoFrameState, serialNumber: string) => void;
}

export function startVideoCanvasRecorder(
  sourceCanvas: HTMLCanvasElement,
  audioStream: MediaStream | null,
  resolutionId: VideoResolutionId = '1080p',
  getLiveCallouts?: () => {
    callouts: PositionedLeaderCallout[];
    viewportW: number;
    viewportH: number;
  }
): VideoRecorderHandle {
  const resSpec = VIDEO_RESOLUTIONS[resolutionId] || VIDEO_RESOLUTIONS['1080p'];
  const width = resSpec.width;
  const height = resSpec.height;
  const s = width / 1280;

  const compCanvas = document.createElement('canvas');
  compCanvas.width = width;
  compCanvas.height = height;
  const ctx = compCanvas.getContext('2d');

  let latestFrame: CreatedVideoFrameState | null = null;
  let serial = 'VCA-26-00202';
  let rafId = 0;
  let stopped = false;

  const drawFrame = () => {
    if (stopped || !ctx) return;
    const vStyle = latestFrame?.visualStyle || 'studio';
    const isBlueprint = vStyle === 'blueprint' || vStyle === 'exploded-blueprint';

    ctx.fillStyle = isBlueprint ? '#041224' : '#03050A';
    ctx.fillRect(0, 0, width, height);

    const srcW = sourceCanvas.width || 1280;
    const srcH = sourceCanvas.height || 720;
    const scale = Math.max(width / srcW, height / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    ctx.drawImage(sourceCanvas, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);

    // Subtle drafting grid for CAD blueprint scenes
    if (isBlueprint) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1 * s;
      const step = 42 * s;
      for (let gx = step; gx < width; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = step; gy < height; gy += step) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
      ctx.lineWidth = 1.5 * s;
      ctx.strokeRect(20 * s, 20 * s, width - 40 * s, height - 40 * s);
      ctx.restore();
    }

    // Bake live 3D-to-2D component indexing labels & elbow leader lines
    if (latestFrame?.showCallouts && getLiveCallouts) {
      const { callouts, viewportW, viewportH } = getLiveCallouts();
      if (callouts.length > 0 && viewportW > 0 && viewportH > 0) {
        const sx = width / viewportW;
        const sy = height / viewportH;
        const accent = latestFrame.accentHex || '#38BDF8';
        ctx.save();
        for (const c of callouts) {
          const px = c.px * sx;
          const py = c.py * sy;
          const lx = c.lx * sx;
          const ly = c.ly * sy;
          const elbowX = c.side === 'left' ? lx + 148 * s : lx - 148 * s;

          ctx.strokeStyle = c.id === latestFrame.highlightComponent ? '#F59E0B' : accent;
          ctx.lineWidth = 1.4 * s;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(elbowX, ly);
          ctx.lineTo(lx, ly);
          ctx.stroke();

          ctx.fillStyle = c.id === latestFrame.highlightComponent ? '#F59E0B' : '#38BDF8';
          ctx.beginPath();
          ctx.arc(px, py, 3.2 * s, 0, Math.PI * 2);
          ctx.fill();

          const labelText = `#${String(c.calloutNumber).padStart(2, '0')} ${c.shortName.toUpperCase()}`;
          ctx.font = `600 ${Math.round(11 * s)}px "JetBrains Mono", monospace`;
          const textW = ctx.measureText(labelText).width;
          const pillW = textW + 16 * s;
          const pillH = 22 * s;
          const pillX = c.side === 'left' ? lx : lx - pillW;
          const pillY = ly - pillH / 2;

          ctx.fillStyle = 'rgba(5, 16, 30, 0.92)';
          ctx.fillRect(pillX, pillY, pillW, pillH);
          ctx.strokeStyle = c.id === latestFrame.highlightComponent ? '#F59E0B' : 'rgba(56,189,248,0.65)';
          ctx.lineWidth = 1.1 * s;
          ctx.strokeRect(pillX, pillY, pillW, pillH);

          ctx.fillStyle = '#F8FAFC';
          ctx.fillText(labelText, pillX + 8 * s, pillY + 15 * s);
        }
        ctx.restore();
      }
    }

    if (latestFrame) {
      const seg = latestFrame.segment;
      const accent = latestFrame.accentHex || '#38BDF8';

      // Top-left editorial header
      ctx.fillStyle = accent;
      ctx.font = `700 ${Math.round(14 * s)}px "JetBrains Mono", monospace`;
      ctx.fillText(`VCA · ${serial}  |  ${seg.title.toUpperCase()}`, 34 * s, 40 * s);

      // Scene HUD Telemetry Card
      if (seg.hudHeadline) {
        const metricsList = seg.hudMetrics || [];
        const cardH = (84 + metricsList.length * 20) * s;
        ctx.fillStyle = 'rgba(5, 16, 30, 0.88)';
        ctx.fillRect(34 * s, 56 * s, 370 * s, cardH);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.4 * s;
        ctx.strokeRect(34 * s, 56 * s, 370 * s, cardH);

        ctx.fillStyle = accent;
        ctx.font = `700 ${Math.round(18 * s)}px "Outfit", sans-serif`;
        ctx.fillText(seg.hudHeadline, 50 * s, 86 * s);

        if (seg.hudSubline) {
          ctx.fillStyle = '#E2E8F0';
          ctx.font = `600 ${Math.round(11 * s)}px "JetBrains Mono", monospace`;
          ctx.fillText(seg.hudSubline, 50 * s, 108 * s);
        }

        metricsList.forEach((line, mIdx) => {
          ctx.fillStyle = '#94A3B8';
          ctx.font = `500 ${Math.round(11 * s)}px "JetBrains Mono", monospace`;
          ctx.fillText(line, 50 * s, (132 + mIdx * 20) * s);
        });
      }

      // Lower-third broadcast narration bar
      const boxH = 88 * s;
      const boxY = height - boxH - 20 * s;
      ctx.fillStyle = 'rgba(13, 18, 27, 0.92)';
      ctx.fillRect(28 * s, boxY, width - 56 * s, boxH);
      ctx.strokeStyle = '#1B2332';
      ctx.lineWidth = 1.4 * s;
      ctx.strokeRect(28 * s, boxY, width - 56 * s, boxH);

      ctx.fillStyle = accent;
      ctx.fillRect(28 * s, boxY, (width - 56 * s) * latestFrame.progress, 3 * s);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#94A3B8';
      ctx.font = `600 ${Math.round(12 * s)}px "JetBrains Mono", monospace`;
      ctx.fillText(
        `${formatTimecode(latestFrame.timeSec)} / ${formatTimecode(latestFrame.totalDurationSec)}`,
        width - 44 * s,
        boxY + 24 * s
      );
      ctx.textAlign = 'left';

      ctx.font = `500 ${Math.round(16 * s)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#F1F5F9';
      const words = seg.narration.split(' ');
      let line1 = '';
      let line2 = '';
      for (const word of words) {
        if ((line1 + ' ' + word).length <= 96 && !line2) {
          line1 = line1 ? `${line1} ${word}` : word;
        } else {
          line2 = line2 ? `${line2} ${word}` : word;
        }
      }
      ctx.fillText(line1, 44 * s, boxY + 46 * s);
      if (line2) {
        ctx.fillText(line2, 44 * s, boxY + 70 * s);
      }

      if (latestFrame.fadeOpacity < 0.999) {
        ctx.fillStyle = `rgba(0, 0, 0, ${1 - latestFrame.fadeOpacity})`;
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

  const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: preferredMime,
    videoBitsPerSecond: resSpec.bitrate,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  recorder.start(250);

  return {
    updateOverlayFrame(frame: CreatedVideoFrameState, serialNumber: string) {
      latestFrame = frame;
      serial = serialNumber;
    },
    stop(): Promise<Blob> {
      return new Promise((resolve) => {
        stopped = true;
        cancelAnimationFrame(rafId);
        if (recorder.state === 'inactive') {
          resolve(new Blob(chunks, { type: preferredMime }));
          return;
        }
        recorder.onstop = () => {
          videoStream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: preferredMime }));
        };
        recorder.stop();
      });
    },
  };
}
