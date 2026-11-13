import {
  DEFAULT_EXPLAINER_SCENES,
  EXPLAINER_DURATION_SEC,
  ExplainerFrameState,
  ExplainerSegment,
  MaleVoiceId,
  SceneSfxStyle,
  VIDEO_RESOLUTIONS,
  VideoResolutionId,
  formatTimecode,
} from './explainerTimeline';

export type VoiceEngineMode = 'checking' | 'gemini' | 'browser-speech';

export function selectMaleSpeechVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const maleHints = [
    'google uk english male',
    'google us english male',
    'microsoft david',
    'microsoft mark',
    'microsoft guy',
    'daniel',
    'alex',
    'aaron',
    'arthur',
    'oliver',
    'ryan',
    'thomas',
    'male',
  ];

  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = englishVoices.length ? englishVoices : voices;

  for (const hint of maleHints) {
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

export const REFERENCE_VIDEO_URL = '/assets/aistudio/gemini_generated_video_62c11474_c3301979.mp4';
export type ExportMediaFormat = 'mp4-regular' | 'mp4-hd' | 'mp4-4k' | 'mp3';

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
      ? 'Launch-Audio'
      : format === 'mp4-regular'
        ? 'Launch-Regular-480p'
        : format === 'mp4-4k'
          ? 'Launch-4K-2160p'
          : 'Launch-HD-1080p';
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

export class ExplainerAudioDirector {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private refVideoGain: GainNode | null = null;
  private attachedVideos = new WeakSet<HTMLVideoElement>();
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private padOscs: OscillatorNode[] = [];
  private padFilter: BiquadFilterNode | null = null;
  private pulseTimer: number | null = null;
  private cache = new Map<string, AudioBuffer>();
  private inFlight = new Map<string, Promise<VoiceEngineMode>>();
  private mode: VoiceEngineMode = 'checking';
  private muted = false;
  private ducked = false;

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

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = 1.0;

      this.refVideoGain = this.ctx.createGain();
      this.refVideoGain.gain.value = 1.0;

      this.streamDest = this.ctx.createMediaStreamDestination();

      this.musicGain.connect(this.masterGain);
      this.voiceGain.connect(this.masterGain);
      this.refVideoGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.streamDest);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public attachReferenceVideo(videoEl: HTMLVideoElement): void {
    const ctx = this.ensureContext();
    if (!this.refVideoGain || this.attachedVideos.has(videoEl)) return;
    try {
      const src = ctx.createMediaElementSource(videoEl);
      src.connect(this.refVideoGain);
      this.attachedVideos.add(videoEl);
    } catch {
      // Ignore if element was already attached in another context
    }
  }

  public setSoundtrackDucked(ducked: boolean): void {
    this.ducked = ducked;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(ducked ? 0.0 : 0.24, this.ctx.currentTime, 0.15);
    }
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

  public startSoundtrack(): void {
    const ctx = this.ensureContext();
    if (!this.musicGain || this.padOscs.length > 0) return;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 1.2;

    const padBus = ctx.createGain();
    padBus.gain.value = 0.0;
    padBus.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 1.8);

    filter.connect(padBus);
    padBus.connect(this.musicGain);

    // Warm C-minor / suspended hybrid orchestral drone + fifths
    const freqs = [65.41, 98.0, 130.81, 155.56, 196.0];
    freqs.forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx < 2 ? 'sine' : idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.value = hz;
      osc.detune.value = (idx - 2) * 5;
      osc.connect(filter);
      osc.start();
      this.padOscs.push(osc);
    });
    this.padFilter = filter;

    // Subtle electronic pulse clock
    let step = 0;
    const pulseNotes = [130.81, 196.0, 261.63, 155.56];
    this.pulseTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.muted || this.ducked) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = pulseNotes[step % pulseNotes.length];
      step += 1;

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.055, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.36);

      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.38);
    }, 500);
  }

  public modulateSoundtrack(sceneIndex: number): void {
    if (!this.ctx || !this.padFilter) return;
    const cutoff = sceneIndex === 1 ? 340 : sceneIndex <= 4 ? 680 : sceneIndex === 5 ? 880 : 380;
    this.padFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.6);
  }

  public playSceneSfx(sceneId: string, sfxStyle?: SceneSfxStyle): void {
    const ctx = this.ensureContext();
    if (!this.musicGain || this.muted) return;
    const now = ctx.currentTime;

    const resolvedStyle: SceneSfxStyle | null =
      sfxStyle ||
      (sceneId === 'scene-01-reveal' || sceneId === 'scene-07-finale'
        ? 'impact'
        : sceneId === 'scene-02-protection'
          ? 'mechanical'
          : sceneId === 'scene-03-nfc' || sceneId === 'scene-06-experience'
            ? 'nfc'
            : sceneId === 'scene-04-blockchain'
              ? 'telemetry'
              : sceneId === 'scene-05-manufacturing'
                ? 'laser'
                : null);

    if (resolvedStyle === 'impact') {
      // Deep cinematic sub-bass impact
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(76, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 1.4);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 1.85);
      return;
    }

    if (resolvedStyle === 'mechanical') {
      // Mechanical servo glide
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(290, now + 0.65);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.8);
      return;
    }

    if (resolvedStyle === 'nfc') {
      // Clean electronic NFC handshake chime
      [880, 1318.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + idx * 0.09;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.48);
        osc.connect(gain);
        gain.connect(this.musicGain!);
        osc.start(start);
        osc.stop(start + 0.5);
      });
      return;
    }

    if (resolvedStyle === 'telemetry') {
      // Rising telemetry shimmer
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const start = now + idx * 0.08;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.connect(gain);
        gain.connect(this.musicGain!);
        osc.start(start);
        osc.stop(start + 0.38);
      });
      return;
    }

    if (resolvedStyle === 'laser') {
      // Ultrasonic & laser scan sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.9);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 1.0);
    }
  }

  public stopSoundtrack(): void {
    if (this.pulseTimer !== null) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    this.padOscs.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // ignore
      }
      osc.disconnect();
    });
    this.padOscs = [];
    this.padFilter?.disconnect();
    this.padFilter = null;
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
    voiceName: MaleVoiceId
  ): Promise<VoiceEngineMode> {
    const key = `${voiceName}:${segmentId}:${text}`;
    if (this.cache.has(key)) {
      this.mode = 'gemini';
      return 'gemini';
    }
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const request = (async (): Promise<VoiceEngineMode> => {
      try {
        const res = await fetch('/api/explainer-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceName,
            style:
              'Deep, authoritative, sophisticated male documentary narrator for a luxury engineering launch commercial',
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
    voiceName: MaleVoiceId,
    scenes: ExplainerSegment[] = DEFAULT_EXPLAINER_SCENES,
    onProgress?: (readyCount: number) => void
  ): Promise<VoiceEngineMode> {
    let count = 0;
    const first = await this.prefetchSegment(scenes[0].id, scenes[0].narration, voiceName);
    count += 1;
    onProgress?.(count);

    if (first !== 'gemini') {
      return 'browser-speech';
    }

    for (let i = 1; i < scenes.length; i++) {
      await new Promise((r) => window.setTimeout(r, 400));
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
    voiceName: MaleVoiceId
  ): Promise<VoiceEngineMode> {
    this.stopSpeech();

    const key = `${voiceName}:${segmentId}:${text}`;
    let buffer = this.cache.get(key);

    if (!buffer && this.mode !== 'browser-speech') {
      await this.prefetchSegment(segmentId, text, voiceName);
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
      const utterance = new SpeechSynthesisUtterance(text);
      const maleVoice = selectMaleSpeechVoice();
      if (maleVoice) utterance.voice = maleVoice;
      utterance.pitch = 0.84;
      utterance.rate = 0.96;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
    return 'browser-speech';
  }

  public async renderFullAudioMixWav(
    voiceName: MaleVoiceId,
    scenes: ExplainerSegment[] = DEFAULT_EXPLAINER_SCENES,
    includeReferenceIntro = true
  ): Promise<Blob> {
    await this.prefetchAll(voiceName, scenes);
    const totalSec = scenes[scenes.length - 1]?.endSec || EXPLAINER_DURATION_SEC;
    const sampleRate = 48000;
    const offline = new OfflineAudioContext(2, Math.ceil(totalSec * sampleRate), sampleRate);

    const musicBus = offline.createGain();
    musicBus.gain.setValueAtTime(includeReferenceIntro ? 0.0 : 0.24, 0);
    if (includeReferenceIntro) {
      musicBus.gain.setValueAtTime(0.0, 9.4);
      musicBus.gain.linearRampToValueAtTime(0.24, 10.4);
    }
    musicBus.gain.setValueAtTime(0.24, Math.max(0, totalSec - 1.5));
    musicBus.gain.linearRampToValueAtTime(0.0, totalSec);
    musicBus.connect(offline.destination);

    const filter = offline.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 560;
    filter.Q.value = 1.2;
    filter.connect(musicBus);

    const freqs = [65.41, 98.0, 130.81, 155.56, 196.0];
    freqs.forEach((hz, idx) => {
      const osc = offline.createOscillator();
      osc.type = idx < 2 ? 'sine' : idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.value = hz;
      osc.detune.value = (idx - 2) * 5;
      const g = offline.createGain();
      g.gain.value = 0.24;
      osc.connect(g);
      g.connect(filter);
      osc.start(0);
      osc.stop(totalSec);
    });

    // Reference intro audio track (0..10s)
    let refDecoded = false;
    if (includeReferenceIntro) {
      try {
        const res = await fetch(REFERENCE_VIDEO_URL);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const decoded = await offline.decodeAudioData(buf);
          const refSrc = offline.createBufferSource();
          refSrc.buffer = decoded;
          refSrc.connect(offline.destination);
          refSrc.start(0, 0, Math.min(10.0, decoded.duration));
          refDecoded = true;
        }
      } catch {
        refDecoded = false;
      }
    }

    // Schedule Gemini voiceover segments
    scenes.forEach((seg, idx) => {
      if (idx === 0 && includeReferenceIntro && refDecoded) return;
      const key = `${voiceName}:${seg.id}:${seg.narration}`;
      const voiceBuf = this.cache.get(key);
      if (voiceBuf) {
        const src = offline.createBufferSource();
        src.buffer = voiceBuf;
        src.connect(offline.destination);
        src.start(seg.startSec + 0.35);
      }
    });

    const rendered = await offline.startRendering();
    return encodeWavFromAudioBuffer(rendered);
  }

  public dispose(): void {
    this.stopSpeech();
    this.stopSoundtrack();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.cache.clear();
    this.inFlight.clear();
  }
}

export interface CompositedRecorderHandle {
  stop: () => Promise<Blob>;
  updateOverlayFrame: (frame: ExplainerFrameState, serialNumber: string, totalDurationSec?: number) => void;
}

export function startExplainerVideoRecorder(
  sourceCanvas: HTMLCanvasElement,
  audioStream: MediaStream | null,
  resolutionId: VideoResolutionId = '1080p',
  options?: {
    getRefVideo?: () => HTMLVideoElement | null;
    includeReferenceIntro?: boolean;
  }
): CompositedRecorderHandle {
  const resSpec = VIDEO_RESOLUTIONS[resolutionId] || VIDEO_RESOLUTIONS['1080p'];
  const width = resSpec.width;
  const height = resSpec.height;
  const s = width / 1280; // layout scale relative to 720p base

  const compCanvas = document.createElement('canvas');
  compCanvas.width = width;
  compCanvas.height = height;
  const ctx = compCanvas.getContext('2d');

  let latestFrame: ExplainerFrameState | null = null;
  let serial = 'VCA-26-00202';
  let totalDur = EXPLAINER_DURATION_SEC;
  let rafId = 0;
  let stopped = false;

  const drawFrame = () => {
    if (stopped || !ctx) return;
    ctx.fillStyle = '#03050A';
    ctx.fillRect(0, 0, width, height);

    const drawFitted = (el: HTMLCanvasElement | HTMLVideoElement, srcW: number, srcH: number, alpha = 1) => {
      if (!srcW || !srcH) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      const scale = Math.max(width / srcW, height / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      ctx.drawImage(el, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
      ctx.restore();
    };

    const includeIntro = Boolean(options?.includeReferenceIntro);
    const refVideo = options?.getRefVideo?.() || null;
    const inIntroWindow =
      includeIntro &&
      latestFrame !== null &&
      latestFrame.timeSec < 10.0 &&
      refVideo !== null &&
      refVideo.readyState >= 2;

    if (inIntroWindow && refVideo && latestFrame) {
      const fadeOut = latestFrame.timeSec > 9.3 ? Math.max(0, (10.0 - latestFrame.timeSec) / 0.7) : 1;
      if (fadeOut < 1) {
        drawFitted(sourceCanvas, sourceCanvas.width || 1280, sourceCanvas.height || 720, 1);
      }
      drawFitted(refVideo, refVideo.videoWidth || 1280, refVideo.videoHeight || 720, fadeOut);
    } else {
      drawFitted(sourceCanvas, sourceCanvas.width || 1280, sourceCanvas.height || 720, 1);
    }

    if (latestFrame && !inIntroWindow) {
      const seg = latestFrame.segment;
      const accent = latestFrame.accentHex || '#38BDF8';

      // Top-left editorial header
      ctx.fillStyle = accent;
      ctx.font = `700 ${Math.round(14 * s)}px "JetBrains Mono", monospace`;
      ctx.fillText(`VCA · ${serial}  |  ${seg.title}`, 36 * s, 42 * s);

      // Custom Creative HUD Overlay or Built-in Reference Scenes
      if (seg.hudHeadline) {
        const metricsList = seg.hudMetrics || [];
        const cardH = (92 + metricsList.length * 22) * s;
        ctx.fillStyle = 'rgba(5, 16, 30, 0.88)';
        ctx.fillRect(36 * s, 64 * s, 390 * s, cardH);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5 * s;
        ctx.strokeRect(36 * s, 64 * s, 390 * s, cardH);

        ctx.fillStyle = accent;
        ctx.font = `700 ${Math.round(20 * s)}px "Outfit", sans-serif`;
        ctx.fillText(seg.hudHeadline, 54 * s, 98 * s);

        if (seg.hudSubline) {
          ctx.fillStyle = '#E2E8F0';
          ctx.font = `600 ${Math.round(12 * s)}px "JetBrains Mono", monospace`;
          ctx.fillText(seg.hudSubline, 54 * s, 122 * s);
        }

        metricsList.forEach((line, mIdx) => {
          ctx.fillStyle = '#94A3B8';
          ctx.font = `500 ${Math.round(11 * s)}px "JetBrains Mono", monospace`;
          ctx.fillText(line, 54 * s, (150 + mIdx * 22) * s);
        });
      } else if (seg.id === 'scene-01-reveal') {
        ctx.fillStyle = '#F8FAFC';
        ctx.font = `700 ${Math.round(44 * s)}px "Outfit", sans-serif`;
        ctx.fillText('VCA', 36 * s, 108 * s);
        ctx.fillStyle = '#38BDF8';
        ctx.font = `600 ${Math.round(15 * s)}px "JetBrains Mono", monospace`;
        ctx.fillText('VERIFIED CARD AUTHORITY', 36 * s, 134 * s);
      } else if ((seg.id === 'scene-03-nfc' || seg.id === 'scene-06-experience') && latestFrame.segmentLocalT > 0.25) {
        ctx.fillStyle = 'rgba(8, 22, 38, 0.86)';
        ctx.fillRect(width - 378 * s, 36 * s, 342 * s, 110 * s);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.5 * s;
        ctx.strokeRect(width - 378 * s, 36 * s, 342 * s, 110 * s);
        ctx.fillStyle = '#38BDF8';
        ctx.font = `700 ${Math.round(22 * s)}px "Outfit", sans-serif`;
        ctx.fillText('VCA AUTHENTICATED', width - 356 * s, 72 * s);
        ctx.fillStyle = '#34D399';
        ctx.font = `600 ${Math.round(12 * s)}px "JetBrains Mono", monospace`;
        ctx.fillText(`NFC VERIFIED · ${serial}`, width - 356 * s, 98 * s);
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('13.56 MHz · NTAG424 DNA', width - 356 * s, 122 * s);
      } else if (seg.id === 'scene-07-finale') {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#38BDF8';
        ctx.font = `800 ${Math.round(88 * s)}px "Outfit", sans-serif`;
        ctx.fillText('VCA', width / 2, height * 0.56);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = `700 ${Math.round(18 * s)}px "JetBrains Mono", monospace`;
        ctx.fillText('VERIFIED CARD AUTHORITY', width / 2, height * 0.62);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = `500 ${Math.round(16 * s)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText('THE FUTURE OF COLLECTIBLE AUTHENTICATION.', width / 2, height * 0.68);
        ctx.fillStyle = '#38BDF8';
        ctx.font = `700 ${Math.round(14 * s)}px "JetBrains Mono", monospace`;
        ctx.fillText('VCASLABS.COM', width / 2, height * 0.73);
        ctx.textAlign = 'left';
      }

      // Lower-third broadcast narration bar
      const boxH = 92 * s;
      const boxY = height - boxH - 22 * s;
      ctx.fillStyle = 'rgba(13, 18, 27, 0.90)';
      ctx.fillRect(28 * s, boxY, width - 56 * s, boxH);
      ctx.strokeStyle = '#1B2332';
      ctx.lineWidth = 1.5 * s;
      ctx.strokeRect(28 * s, boxY, width - 56 * s, boxH);

      ctx.fillStyle = accent;
      ctx.fillRect(28 * s, boxY, (width - 56 * s) * latestFrame.progress, 3 * s);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#94A3B8';
      ctx.font = `600 ${Math.round(13 * s)}px "JetBrains Mono", monospace`;
      ctx.fillText(
        `${formatTimecode(latestFrame.timeSec)} / ${formatTimecode(totalDur)}`,
        width - 46 * s,
        boxY + 26 * s
      );
      ctx.textAlign = 'left';

      ctx.font = `500 ${Math.round(17 * s)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#F1F5F9';
      const words = seg.narration.split(' ');
      let line1 = '';
      let line2 = '';
      for (const word of words) {
        if ((line1 + ' ' + word).length <= 92 && !line2) {
          line1 = line1 ? `${line1} ${word}` : word;
        } else {
          line2 = line2 ? `${line2} ${word}` : word;
        }
      }
      ctx.fillText(line1, 46 * s, boxY + 48 * s);
      if (line2) {
        ctx.fillText(line2, 46 * s, boxY + 74 * s);
      }

      // Black fade-in / fade-out envelope
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
    updateOverlayFrame(frame: ExplainerFrameState, serialNumber: string, totalDurationSec?: number) {
      latestFrame = frame;
      serial = serialNumber;
      if (totalDurationSec && totalDurationSec > 0) {
        totalDur = totalDurationSec;
      }
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
