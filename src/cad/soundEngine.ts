import { MaleVoiceId, SfxCueType } from './filmProduction';

export type TrackId = 'vo' | 'music' | 'sfx';

export interface TrackMixState {
  gain: number;
  muted: boolean;
  solo: boolean;
}

export type MixerState = Record<TrackId, TrackMixState>;

export const DEFAULT_MIXER_STATE: MixerState = {
  vo: { gain: 1.0, muted: false, solo: false },
  music: { gain: 0.45, muted: false, solo: false },
  sfx: { gain: 0.78, muted: false, solo: false },
};

export interface VoiceClipAsset {
  sceneId: string;
  sourceType: 'human-upload' | 'neural-gemini';
  label: string;
  durationSec: number;
  peaks: number[];
  buffer: AudioBuffer;
}

export interface MusicAsset {
  label: string;
  durationSec: number;
  buffer: AudioBuffer;
}

export function computeTrackEffectiveGain(mixer: MixerState, track: TrackId): number {
  const anySolo = mixer.vo.solo || mixer.music.solo || mixer.sfx.solo;
  const t = mixer[track];
  if (t.muted) return 0;
  if (anySolo && !t.solo) return 0;
  return Math.max(0, Math.min(1.5, t.gain));
}

export function extractWaveformPeaks(buffer: AudioBuffer, barCount = 44): number[] {
  const channel = buffer.getChannelData(0);
  if (!channel.length) return Array(barCount).fill(0.05);
  const blockSize = Math.max(1, Math.floor(channel.length / barCount));
  const raw: number[] = [];
  let maxPeak = 0.001;

  for (let i = 0; i < barCount; i++) {
    const start = i * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channel[j]);
      if (abs > peak) peak = abs;
    }
    if (peak > maxPeak) maxPeak = peak;
    raw.push(peak);
  }
  return raw.map((p) => Math.max(0.06, Math.min(1, p / maxPeak)));
}

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class FilmSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private voGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicDuckGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;

  private activeVoSource: AudioBufferSourceNode | null = null;
  private activeMusicSource: AudioBufferSourceNode | null = null;
  private padOscs: OscillatorNode[] = [];
  private padFilter: BiquadFilterNode | null = null;
  private pulseTimer: number | null = null;

  private mixer: MixerState = structuredClone(DEFAULT_MIXER_STATE);
  private autoDucking = true;
  private voClips = new Map<string, VoiceClipAsset>();
  private customMusic: MusicAsset | null = null;
  private inFlightTts = new Map<string, Promise<{ ok: boolean; clip?: VoiceClipAsset; reason?: string }>>();

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;

      this.voGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.musicDuckGain = this.ctx.createGain();
      this.musicDuckGain.gain.value = 1.0;
      this.sfxGain = this.ctx.createGain();

      this.streamDest = this.ctx.createMediaStreamDestination();

      this.voGain.connect(this.masterGain);
      this.musicDuckGain.connect(this.musicGain);
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);

      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.streamDest);
      this.applyMixerGains();
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

  public setMixer(next: MixerState, autoDucking = this.autoDucking): void {
    this.mixer = next;
    this.autoDucking = autoDucking;
    this.applyMixerGains();
  }

  private applyMixerGains(): void {
    if (!this.ctx || !this.voGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.voGain.gain.setTargetAtTime(computeTrackEffectiveGain(this.mixer, 'vo'), now, 0.03);
    this.musicGain.gain.setTargetAtTime(
      computeTrackEffectiveGain(this.mixer, 'music') * 0.42,
      now,
      0.04
    );
    this.sfxGain.gain.setTargetAtTime(computeTrackEffectiveGain(this.mixer, 'sfx'), now, 0.03);
  }

  public getVoiceClip(sceneId: string): VoiceClipAsset | null {
    return this.voClips.get(sceneId) || null;
  }

  public getCustomMusic(): MusicAsset | null {
    return this.customMusic;
  }

  public async importSceneVoiceFile(sceneId: string, file: File): Promise<VoiceClipAsset> {
    const ctx = this.ensureContext();
    const arrayBuf = await file.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
    const clip: VoiceClipAsset = {
      sceneId,
      sourceType: 'human-upload',
      label: file.name,
      durationSec: audioBuf.duration,
      peaks: extractWaveformPeaks(audioBuf, 44),
      buffer: audioBuf,
    };
    this.voClips.set(sceneId, clip);
    return clip;
  }

  public removeSceneVoiceClip(sceneId: string): void {
    this.voClips.delete(sceneId);
  }

  public async importCustomMusicFile(file: File): Promise<MusicAsset> {
    const ctx = this.ensureContext();
    const arrayBuf = await file.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
    this.customMusic = {
      label: file.name,
      durationSec: audioBuf.duration,
      buffer: audioBuf,
    };
    return this.customMusic;
  }

  public clearCustomMusic(): void {
    this.stopMusic();
    this.customMusic = null;
  }

  public async generateNeuralVoiceForScene(
    sceneId: string,
    narration: string,
    voiceName: MaleVoiceId
  ): Promise<{ ok: boolean; clip?: VoiceClipAsset; reason?: string }> {
    const key = `${voiceName}:${sceneId}:${narration}`;
    const existingClip = this.voClips.get(sceneId);
    if (
      existingClip &&
      existingClip.sourceType === 'neural-gemini' &&
      existingClip.label === `${voiceName} Studio Take`
    ) {
      return { ok: true, clip: existingClip };
    }

    const pending = this.inFlightTts.get(key);
    if (pending) return pending;

    const req = (async () => {
      try {
        const res = await fetch('/api/explainer-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: narration,
            voiceName,
            style:
              'Natural, unhurried English-speaking male documentary narrator. Warm baritone, subtle human breathing pauses, restrained confidence.',
          }),
        });
        if (!res.ok) {
          return {
            ok: false,
            reason: `Neural voice endpoint returned HTTP ${res.status}. Upload a human recording instead.`,
          };
        }
        const data = (await res.json()) as {
          available?: boolean;
          audioBase64?: string;
          modelUsed?: string;
          reason?: string;
        };
        if (!data.available || !data.audioBase64) {
          return {
            ok: false,
            reason:
              data.reason ||
              'Neural voice service unavailable. Import a human voice recording (.wav/.mp3).',
          };
        }

        const ctx = this.ensureContext();
        const arrayBuf = decodeBase64ToArrayBuffer(data.audioBase64);
        const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
        const clip: VoiceClipAsset = {
          sceneId,
          sourceType: 'neural-gemini',
          label: `${voiceName} (${data.modelUsed || 'Neural'})`,
          durationSec: audioBuf.duration,
          peaks: extractWaveformPeaks(audioBuf, 44),
          buffer: audioBuf,
        };
        this.voClips.set(sceneId, clip);
        return { ok: true, clip };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Failed to load neural narration.',
        };
      } finally {
        this.inFlightTts.delete(key);
      }
    })();

    this.inFlightTts.set(key, req);
    return req;
  }

  public playVoiceForScene(sceneId: string, offsetWithinClipSec = 0): boolean {
    this.stopVoice();
    const clip = this.voClips.get(sceneId);
    if (!clip) return false;

    const ctx = this.ensureContext();
    if (!this.voGain || !this.musicDuckGain) return false;
    if (offsetWithinClipSec >= clip.buffer.duration - 0.05) return false;

    const src = ctx.createBufferSource();
    src.buffer = clip.buffer;
    src.connect(this.voGain);

    const remaining = Math.max(0.05, clip.buffer.duration - Math.max(0, offsetWithinClipSec));
    if (this.autoDucking) {
      const now = ctx.currentTime;
      this.musicDuckGain.gain.cancelScheduledValues(now);
      this.musicDuckGain.gain.setTargetAtTime(0.45, now, 0.14);
      this.musicDuckGain.gain.setTargetAtTime(1.0, now + remaining, 0.45);
    }

    src.onended = () => {
      if (this.activeVoSource === src) {
        this.activeVoSource = null;
      }
      if (this.ctx && this.musicDuckGain) {
        this.musicDuckGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.35);
      }
    };

    src.start(0, Math.max(0, offsetWithinClipSec));
    this.activeVoSource = src;
    return true;
  }

  public stopVoice(): void {
    if (this.activeVoSource) {
      try {
        this.activeVoSource.stop();
      } catch {
        // ignore
      }
      this.activeVoSource.disconnect();
      this.activeVoSource = null;
    }
    if (this.ctx && this.musicDuckGain) {
      this.musicDuckGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.25);
    }
  }

  public startMusic(timelineOffsetSec = 0, initialEnergy = 0.4): void {
    const ctx = this.ensureContext();
    if (!this.musicDuckGain) return;
    this.stopMusic();

    if (this.customMusic) {
      const src = ctx.createBufferSource();
      src.buffer = this.customMusic.buffer;
      src.loop = true;
      src.connect(this.musicDuckGain);
      const startAt = timelineOffsetSec % Math.max(1, this.customMusic.durationSec);
      src.start(0, startAt);
      this.activeMusicSource = src;
      return;
    }

    // Restrained commercial analog-style ambient bed (D-minor / suspended fifths)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260 + initialEnergy * 420;
    filter.Q.value = 0.85;

    const bus = ctx.createGain();
    bus.gain.value = 0.001;
    bus.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 1.4);

    filter.connect(bus);
    bus.connect(this.musicDuckGain);

    const freqs = [73.42, 110.0, 146.83, 174.61, 220.0];
    freqs.forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx < 2 ? 'sine' : idx % 2 === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.value = hz;
      osc.detune.value = (idx - 2) * 3.5;
      osc.connect(filter);
      osc.start();
      this.padOscs.push(osc);
    });
    this.padFilter = filter;

    let step = 0;
    const pulseNotes = [146.83, 220.0, 293.66, 174.61];
    this.pulseTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicDuckGain) return;
      if (computeTrackEffectiveGain(this.mixer, 'music') <= 0.001) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = pulseNotes[step % pulseNotes.length];
      step += 1;
      g.gain.setValueAtTime(0.0008, now);
      g.gain.linearRampToValueAtTime(0.045, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.42);
      osc.connect(g);
      g.connect(this.musicDuckGain);
      osc.start(now);
      osc.stop(now + 0.45);
    }, 625);
  }

  public modulateMusicEnergy(energy: number): void {
    if (!this.ctx || !this.padFilter) return;
    const cutoff = 240 + Math.max(0, Math.min(1, energy)) * 560;
    this.padFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.7);
  }

  public stopMusic(): void {
    if (this.pulseTimer !== null) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    if (this.activeMusicSource) {
      try {
        this.activeMusicSource.stop();
      } catch {
        // ignore
      }
      this.activeMusicSource.disconnect();
      this.activeMusicSource = null;
    }
    this.padOscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        // ignore
      }
      o.disconnect();
    });
    this.padOscs = [];
    this.padFilter?.disconnect();
    this.padFilter = null;
  }

  public playSfxCue(type: SfxCueType): void {
    const ctx = this.ensureContext();
    if (!this.sfxGain) return;
    const now = ctx.currentTime;

    if (type === 'bass-impact') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(74, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 1.1);
      g.gain.setValueAtTime(0.55, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 1.55);
      return;
    }

    if (type === 'housing-glide') {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(175, now + 0.75);
      filter.type = 'bandpass';
      filter.frequency.value = 340;
      filter.Q.value = 2.0;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.16, now + 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.9);
      return;
    }

    if (type === 'card-seat' || type === 'micro-click') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      const f0 = type === 'micro-click' ? 1680 : 620;
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.42, now + 0.055);
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.075);
      return;
    }

    if (type === 'ultrasonic-lock') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(125, now + 0.35);
      g.gain.setValueAtTime(0.32, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.5);
      return;
    }

    if (type === 'nfc-chime') {
      [783.99, 1174.66].forEach((hz, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        const start = now + idx * 0.08;
        g.gain.setValueAtTime(0.001, start);
        g.gain.linearRampToValueAtTime(0.2, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.46);
        osc.connect(g);
        g.connect(this.sfxGain!);
        osc.start(start);
        osc.stop(start + 0.5);
      });
    }
  }

  public dispose(): void {
    this.stopVoice();
    this.stopMusic();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.voClips.clear();
    this.customMusic = null;
  }
}
