import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Download,
  FileAudio,
  FileText,
  Film,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ExportMediaFormat,
  REFERENCE_VIDEO_URL,
  VoiceEngineMode,
} from '../cad/explainerMedia';
import {
  DEFAULT_EXPLAINER_SCENES,
  EXPLAINER_DURATION_SEC,
  ExplainerFrameState,
  ExplainerSegment,
  MaleVoiceId,
  VIDEO_RESOLUTIONS,
  VideoResolutionId,
  formatTimecode,
} from '../cad/explainerTimeline';

interface ExplainerTourOverlayProps {
  playing: boolean;
  recording: boolean;
  includeReferenceIntro: boolean;
  hasRecordedClip: boolean;
  exportingLabel: string | null;
  frame: ExplainerFrameState;
  scenes: ExplainerSegment[];
  voiceMode: VoiceEngineMode;
  maleVoice: MaleVoiceId;
  resolution: VideoResolutionId;
  muted: boolean;
  serialNumber: string;
  presentationTitle?: string | null;
  presentationOrigin?: 'gemini' | 'studio-director' | null;
  presentationPrompt: string;
  generatingPresentation: boolean;
  presentationError: string | null;
  onChangePrompt: (value: string) => void;
  onGeneratePresentation: (promptOverride?: string) => void;
  onAttachRefVideo: (el: HTMLVideoElement | null) => void;
  onToggleReferenceIntro: () => void;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeek: (sec: number) => void;
  onChangeMaleVoice: (voice: MaleVoiceId) => void;
  onChangeResolution: (res: VideoResolutionId) => void;
  onChangeScenes: (next: ExplainerSegment[]) => void;
  onToggleMute: () => void;
  onStartRecord90s: (autoFormat?: ExportMediaFormat) => void;
  onStopRecord: () => void;
  onDownloadFormat: (format: ExportMediaFormat) => void;
  onExit: () => void;
}

const MANUFACTURING_STAGES = [
  '1/8 Optical Polymer Feed',
  '2/8 Precision Injection Moulding',
  '3/8 Transparent Housing Formation',
  '4/8 NFC Chip & Antenna Placement',
  '5/8 Certification Label Install',
  '6/8 Precision Housing Closure',
  '7/8 Ultrasonic Tamper Sealing',
  '8/8 Optical Quality Inspection',
];

export const ExplainerTourOverlay: React.FC<ExplainerTourOverlayProps> = ({
  playing,
  recording,
  includeReferenceIntro,
  hasRecordedClip,
  exportingLabel,
  frame,
  scenes,
  voiceMode,
  maleVoice,
  resolution,
  muted,
  serialNumber,
  presentationTitle,
  presentationOrigin,
  presentationPrompt,
  generatingPresentation,
  presentationError,
  onChangePrompt,
  onGeneratePresentation,
  onAttachRefVideo,
  onToggleReferenceIntro,
  onTogglePlay,
  onRestart,
  onSeek,
  onChangeMaleVoice,
  onChangeResolution,
  onChangeScenes,
  onToggleMute,
  onStartRecord90s,
  onStopRecord,
  onDownloadFormat,
  onExit,
}) => {
  const [scriptOpen, setScriptOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachRefCb = useRef(onAttachRefVideo);
  attachRefCb.current = onAttachRefVideo;

  const showIntroVideo = includeReferenceIntro && frame.timeSec < 10.0;
  const introOpacity = showIntroVideo
    ? frame.timeSec > 9.3
      ? Math.max(0, (10.0 - frame.timeSec) / 0.7)
      : 1
    : 0;

  useEffect(() => {
    const el = videoRef.current;
    attachRefCb.current(el);
    return () => attachRefCb.current(null);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (showIntroVideo) {
      if (Math.abs(el.currentTime - frame.timeSec) > 0.45) {
        el.currentTime = Math.max(0, Math.min(9.95, frame.timeSec));
      }
      if (playing) {
        void el.play().catch(() => undefined);
      } else {
        el.pause();
      }
    } else if (!el.paused) {
      el.pause();
    }
  }, [showIntroVideo, playing, frame.timeSec]);

  const voiceBadgeText =
    showIntroVideo
      ? 'Reference Studio Audio'
      : voiceMode === 'gemini'
        ? `Gemini Male · ${maleVoice}`
        : voiceMode === 'browser-speech'
          ? 'Browser Male Voice'
          : 'Loading Voice';

  const totalDuration = scenes[scenes.length - 1]?.endSec || EXPLAINER_DURATION_SEC;
  const activeMfgIndex = Math.min(
    MANUFACTURING_STAGES.length - 1,
    Math.floor(frame.mfgStageProgress * MANUFACTURING_STAGES.length)
  );

  const handleExportScriptMd = () => {
    const docHeading = presentationTitle
      ? `# VCA — Verified Card Authority | ${presentationTitle} (${formatTimecode(totalDuration)})`
      : '# VCA — Verified Card Authority | 90-Second Product Launch Script & Production Spec';
    const lines = [
      docHeading,
      `Serial Prototype: ${serialNumber}`,
      `Duration: ${formatTimecode(totalDuration)} | Target Export: ${VIDEO_RESOLUTIONS[resolution].label}`,
      '',
      ...scenes.map(
        (s) =>
          `## ${s.title} (${formatTimecode(s.startSec)}–${formatTimecode(s.endSec)})\n- **Camera Path**: ${s.cameraPathDescription}\n- **Sound Design**: ${s.soundDesignCue}\n- **Voiceover**: "${s.narration}"\n`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serialNumber}-${presentationTitle ? 'Custom-Presentation' : '90s-Launch'}-Script.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Seamless Reference Opening Video Layer (00:00–00:10) */}
      <video
        ref={videoRef}
        src={REFERENCE_VIDEO_URL}
        playsInline
        preload="auto"
        data-testid="reference-intro-video"
        aria-label="VCA Reference Studio Opening Sequence"
        style={{ opacity: introOpacity }}
        className={`pointer-events-none absolute inset-0 w-full h-full object-contain bg-[#03050A] z-10 transition-opacity duration-150 ${
          showIntroVideo ? '' : 'hidden'
        }`}
      />

      {/* Fade-In / Fade-Out Cinema Envelope */}
      {!showIntroVideo && frame.fadeOpacity < 0.999 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-black z-20"
          style={{ opacity: 1 - frame.fadeOpacity }}
        />
      )}

      {/* Scene-Specific Holographic Motion Graphics Overlays (Custom Generated OR Default Launch Film) */}
      {!showIntroVideo && (
        <AnimatePresence mode="wait">
          {frame.segment.hudHeadline ? (
            <motion.div
              key={`mg-custom-${frame.segment.id}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              data-testid="generated-scene-hud"
              style={{ borderColor: `${frame.accentHex}80` }}
              className="pointer-events-none absolute top-24 left-5 z-20 w-80 rounded-md border bg-[#051221]/92 p-3.5 font-mono space-y-1.5 shadow-2xl"
            >
              {presentationTitle && (
                <div className="text-[10px] text-[#94A3B8] truncate">
                  {presentationOrigin === 'gemini' ? 'Gemini Creative Director' : 'Studio Director'} ·{' '}
                  {presentationTitle}
                </div>
              )}
              <div
                style={{ color: frame.accentHex }}
                className="text-base font-extrabold tracking-tight"
              >
                {frame.segment.hudHeadline}
              </div>
              {frame.segment.hudSubline && (
                <div className="text-[11px] font-semibold text-white">
                  {frame.segment.hudSubline}
                </div>
              )}
              {frame.segment.hudMetrics && frame.segment.hudMetrics.length > 0 && (
                <div className="pt-1.5 border-t border-[#1E3A5F] space-y-0.5 text-[10px] text-[#CBD5E1]">
                  {frame.segment.hudMetrics.map((m, idx) => (
                    <div key={idx}>{m}</div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <>
          {frame.segment.id === 'scene-01-reveal' && (
            <motion.div
              key="mg-s1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="pointer-events-none absolute top-24 left-5 z-20 space-y-0.5"
            >
              <div className="text-5xl font-extrabold tracking-tight text-[#38BDF8]">VCA</div>
              <div className="text-xs font-mono tracking-[0.24em] text-white">
                VERIFIED CARD AUTHORITY
              </div>
            </motion.div>
          )}

          {frame.segment.id === 'scene-02-protection' && (
            <motion.div
              key="mg-s2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute inset-x-5 top-16 z-20 flex justify-between items-start gap-4"
            >
              <div className="w-60 rounded border border-[#38BDF8]/45 bg-[#051221]/85 p-3 font-mono text-[10px] space-y-1">
                <div className="text-[#38BDF8] font-bold tracking-wider">OPTICAL HOUSING</div>
                <div className="text-white">84.0 × 138.0 × 6.8 mm</div>
                <div className="text-[#94A3B8]">CARD CAVITY: 63.5 × 88.9 mm</div>
              </div>
              <div className="w-60 rounded border border-[#38BDF8]/45 bg-[#051221]/85 p-3 font-mono text-[10px] space-y-1 text-right">
                <div className="text-[#38BDF8] font-bold tracking-wider">PRECISION ASSEMBLY</div>
                <div className="text-white">CHAMFERED POLYCARBONATE</div>
                <div className="text-[#94A3B8]">PROPOSED: ±0.05 mm ISO 2768-m</div>
              </div>
            </motion.div>
          )}

          {frame.segment.id === 'scene-03-nfc' && frame.segmentLocalT > 0.25 && (
            <motion.div
              key="mg-s3"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-none absolute top-20 left-5 z-20 w-76 rounded-md border border-[#38BDF8]/80 bg-[#051526]/90 p-3.5 font-mono space-y-1.5 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-extrabold tracking-tight text-[#38BDF8]">
                  VCA AUTHENTICATED
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <div className="text-xs font-semibold text-white">VCA ID: {serialNumber}</div>
              <div className="text-[11px] text-emerald-400">DIGITAL CERTIFICATE VERIFIED</div>
              <div className="text-[10px] text-[#94A3B8] pt-1 border-t border-[#1E3A5F]">
                13.56 MHz Inductive Coupling · NTAG424 DNA
              </div>
            </motion.div>
          )}

          {frame.segment.id === 'scene-04-blockchain' && (
            <motion.div
              key="mg-s4"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute top-20 right-5 z-20 w-80 rounded-md border border-[#38BDF8]/50 bg-[#051221]/90 p-3.5 space-y-2"
            >
              <div className="text-[11px] font-mono font-semibold text-[#38BDF8]">
                PHYSICAL-TO-DIGITAL ARCHITECTURE
              </div>
              <div className="text-[11px] font-mono text-[#CBD5E1] space-y-0.5 leading-tight">
                <div>PHYSICAL SLAB</div>
                <div className="text-[#38BDF8]">↓ SECURE NFC AUTHENTICATION</div>
                <div>VCA VERIFICATION PLATFORM</div>
                <div className="text-[#38BDF8]">↓ BLOCKCHAIN RECORD</div>
                <div className="text-white font-semibold">DIGITAL CERTIFICATE</div>
              </div>
              <div className="pt-1.5 border-t border-[#1E3A5F] text-[10px] text-[#94A3B8] font-mono space-y-0.5">
                <div>ID: {serialNumber} · GRADE: VCA 10</div>
                <div>NFT ASSOCIATION: LINKED ON-CHAIN</div>
                <div>NFC ACTS AS ACCESS KEY ONLY</div>
              </div>
            </motion.div>
          )}

          {frame.segment.id === 'scene-05-manufacturing' && (
            <motion.div
              key="mg-s5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute top-24 left-5 z-20 w-72 rounded-md border border-[#38BDF8]/45 bg-[#051221]/90 p-3 space-y-1.5 font-mono"
            >
              <div className="text-[11px] text-[#38BDF8] font-semibold">
                PROPOSED MANUFACTURING SEQUENCE
              </div>
              <div className="text-xs text-white font-semibold">
                {MANUFACTURING_STAGES[activeMfgIndex]}
              </div>
              <div className="text-[10px] text-[#94A3B8]">
                Optical Polycarbonate · ±0.05 mm · Ultrasonic Seal
              </div>
            </motion.div>
          )}

          {frame.segment.id === 'scene-06-experience' && (
            <motion.div
              key="mg-s6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute top-24 left-5 z-20 space-y-1.5"
            >
              <div className="text-2xl font-bold tracking-wide text-white">
                PROTECT. <span className="text-[#38BDF8]">AUTHENTICATE.</span> VERIFY.
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#38BDF8]/70 bg-[#051526]/90 text-xs font-mono text-[#38BDF8]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>VCA AUTHENTICATED · {serialNumber}</span>
              </div>
            </motion.div>
          )}

          {frame.segment.id === 'scene-07-finale' && (
            <motion.div
              key="mg-s7"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="pointer-events-none absolute inset-x-0 bottom-44 z-20 flex flex-col items-center text-center px-4"
            >
              <div className="text-6xl sm:text-7xl font-extrabold tracking-tight text-[#38BDF8] leading-none">
                VCA
              </div>
              <div className="text-xs font-mono tracking-[0.28em] text-white font-bold mt-1">
                VERIFIED CARD AUTHORITY
              </div>
              <div className="text-sm sm:text-base font-medium tracking-[0.14em] text-[#E2E8F0] mt-2">
                THE FUTURE OF COLLECTIBLE AUTHENTICATION.
              </div>
              <div className="text-xs font-mono tracking-[0.22em] text-[#38BDF8] font-semibold mt-1">
                VCASLABS.COM
              </div>
            </motion.div>
          )}
            </>
          )}
        </AnimatePresence>
      )}

      {/* Top-Right Director & Multi-Format Export Controls Bar */}
      <div className="absolute top-3 right-4 z-30 flex flex-wrap items-center justify-end gap-1.5 max-w-[calc(100vw-2rem)]">
        <button
          type="button"
          onClick={onToggleReferenceIntro}
          title="Include the 10-second VCA studio reference video as Scene 01 opening"
          className={`px-2 py-1 text-[11px] font-mono rounded-md border whitespace-nowrap shrink-0 cursor-pointer ${
            includeReferenceIntro
              ? 'bg-[#0EA5E9]/20 border-[#38BDF8] text-[#7DD3FC]'
              : 'bg-[#0D121B] border-[#1B2332] text-[#94A3B8] hover:text-white'
          }`}
        >
          {includeReferenceIntro ? 'Ref Intro: On (00–10s)' : 'Ref Intro: Off'}
        </button>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0D121B] border border-[#1B2332] text-[11px]">
          <span className="text-[#94A3B8] font-mono whitespace-nowrap">{voiceBadgeText}</span>
          <select
            aria-label="Male Narrator Voice"
            value={maleVoice}
            onChange={(e) => onChangeMaleVoice(e.target.value as MaleVoiceId)}
            className="bg-[#11161F] border border-[#1B2332] rounded px-1.5 py-0.5 text-[11px] text-white outline-none focus:border-[#0EA5E9]"
          >
            <option value="Charon">Charon (Deep Male)</option>
            <option value="Fenrir">Fenrir (Baritone Male)</option>
            <option value="Puck">Puck (Studio Male)</option>
          </select>
        </div>

        <select
          aria-label="Record Capture Resolution"
          value={resolution}
          disabled={recording}
          onChange={(e) => onChangeResolution(e.target.value as VideoResolutionId)}
          className="bg-[#0D121B] border border-[#1B2332] rounded-md px-2 py-1 text-[11px] font-mono text-[#CBD5E1] outline-none focus:border-[#0EA5E9]"
        >
          <option value="480p">Capture 480p</option>
          <option value="720p">Capture 720p</option>
          <option value="1080p">Capture 1080p HD</option>
          <option value="2160p">Capture 4K</option>
        </select>

        {recording ? (
          <button
            type="button"
            onClick={onStopRecord}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop & Save ({formatTimecode(frame.timeSec)})</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStartRecord90s()}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Film className="w-3 h-3" />
            <span>{hasRecordedClip ? `Re-Record ${Math.round(totalDuration)}s` : `Record ${Math.round(totalDuration)}s`}</span>
          </button>
        )}

        <button
          type="button"
          disabled={Boolean(exportingLabel)}
          onClick={() => onDownloadFormat('mp4-regular')}
          title="Download Regular Format MP4 (854×480 H.264)"
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-[#1B2332] bg-[#0D121B] hover:border-[#38BDF8] text-[#E2E8F0] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3 h-3 text-[#38BDF8]" />
          <span>Regular MP4</span>
        </button>

        <button
          type="button"
          disabled={Boolean(exportingLabel)}
          onClick={() => onDownloadFormat('mp4-hd')}
          title="Download Full HD MP4 (1920×1080 H.264)"
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-[#38BDF8]/60 bg-[#0EA5E9]/15 hover:bg-[#0EA5E9] text-white disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3 h-3" />
          <span>HD MP4</span>
        </button>

        <button
          type="button"
          disabled={Boolean(exportingLabel)}
          onClick={() => onDownloadFormat('mp3')}
          title="Download Full Audio Soundtrack & Voiceover as MP3 (192 kbps)"
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-emerald-500/50 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-200 hover:text-white disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileAudio className="w-3 h-3" />
          <span>MP3</span>
        </button>

        <button
          type="button"
          onClick={() => setScriptOpen((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border whitespace-nowrap shrink-0 cursor-pointer ${
            scriptOpen
              ? 'bg-[#0EA5E9]/20 border-[#0EA5E9] text-white'
              : 'bg-[#0D121B] border-[#1B2332] hover:border-[#38BDF8] text-[#CBD5E1]'
          }`}
        >
          <FileText className="w-3 h-3" />
          <span>Script & Scenes</span>
        </button>

        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-[#0D121B] border border-[#1B2332] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          <X className="w-3 h-3" />
          <span>Exit Film</span>
        </button>
      </div>

      {/* Export Status Notification */}
      {exportingLabel && (
        <div className="pointer-events-none absolute top-14 right-4 z-30 rounded-md border border-[#38BDF8] bg-[#051526] px-3 py-1.5 text-xs font-mono text-[#7DD3FC] shadow-lg">
          {exportingLabel}
        </div>
      )}

      {/* Editable Scene Config & Full 90s Script Drawer */}
      <AnimatePresence>
        {scriptOpen && (
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.16 }}
            className="absolute top-14 right-4 bottom-40 z-30 w-[min(420px,92vw)] rounded-lg border border-[#1B2332] bg-[#0D121B] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-3.5 py-2.5 border-b border-[#1B2332] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xs font-semibold text-white truncate">
                  {presentationTitle
                    ? `${presentationTitle} (${formatTimecode(totalDuration)})`
                    : '90-Second Production Script & Scene Config'}
                </h2>
                <p className="text-[10px] text-[#94A3B8]">
                  Edit voiceover lines & review camera/sound design cues
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportScriptMd}
                  className="px-2 py-1 text-[10px] font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#38BDF8] cursor-pointer whitespace-nowrap"
                >
                  Export .md
                </button>
                <button
                  type="button"
                  onClick={() => onChangeScenes(DEFAULT_EXPLAINER_SCENES)}
                  className="px-2 py-1 text-[10px] font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#94A3B8] hover:text-white cursor-pointer whitespace-nowrap"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {scenes.map((sc, idx) => (
                <div
                  key={sc.id}
                  className={`p-2.5 rounded border space-y-1.5 ${
                    sc.id === frame.segment.id
                      ? 'border-[#0EA5E9] bg-[#111827]'
                      : 'border-[#1B2332] bg-[#11161F]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSeek(sc.startSec)}
                      className="text-[11px] font-mono font-semibold text-[#38BDF8] hover:underline cursor-pointer text-left"
                    >
                      {sc.title}
                    </button>
                    <span className="text-[10px] font-mono text-[#94A3B8] tabular-nums">
                      {formatTimecode(sc.startSec)}–{formatTimecode(sc.endSec)}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#94A3B8] leading-snug">
                    <span className="text-[#CBD5E1] font-medium">Camera:</span>{' '}
                    {sc.cameraPathDescription}
                  </p>
                  <p className="text-[10px] text-[#94A3B8] leading-snug">
                    <span className="text-[#CBD5E1] font-medium">Audio:</span> {sc.soundDesignCue}
                  </p>
                  <textarea
                    rows={2}
                    aria-label={`Narration for ${sc.title}`}
                    value={sc.narration}
                    onChange={(e) => {
                      const next = scenes.map((item, i) =>
                        i === idx ? { ...item, narration: e.target.value } : item
                      );
                      onChangeScenes(next);
                    }}
                    className="w-full bg-[#090C11] border border-[#1B2332] rounded p-1.5 text-[11px] text-[#F1F5F9] outline-none focus:border-[#0EA5E9]"
                  />
                </div>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Bottom Broadcast Lower-Third + Timeline Transport + Quick Presentation Prompt */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(960px,95vw)]">
        <div className="bg-[#0D121B] border border-[#1B2332] rounded-lg p-3 shadow-2xl space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onGeneratePresentation();
            }}
            className="flex items-center gap-2 pb-2 border-b border-[#1B2332]"
          >
            <Video className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
            <input
              type="text"
              value={presentationPrompt}
              onChange={(e) => onChangePrompt(e.target.value)}
              placeholder="Type what you want to see next (e.g. '35s NFC chip X-ray & smartphone tap')..."
              aria-label="Regenerate presentation video prompt"
              disabled={generatingPresentation}
              className="flex-1 min-w-0 bg-[#11161F] border border-[#1B2332] focus:border-[#0EA5E9] rounded px-2.5 py-1 text-xs text-white placeholder-[#64748B] outline-none"
            />
            <button
              type="submit"
              disabled={generatingPresentation}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-60 text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              {generatingPresentation ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <span>Generate Video</span>
              )}
            </button>
          </form>
          {presentationError && (
            <p role="alert" className="text-[11px] text-rose-400">
              {presentationError}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-mono font-semibold text-[#38BDF8] whitespace-nowrap">
                {frame.segment.title}
              </span>
              <span className="text-[#475569]" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-[#94A3B8] truncate">{frame.segment.angleLabel}</span>
            </div>
            <div className="font-mono text-xs text-white tabular-nums whitespace-nowrap">
              {formatTimecode(frame.timeSec)} / {formatTimecode(totalDuration)}
            </div>
          </div>

          <p
            data-testid="explainer-subtitle"
            className="text-sm text-[#F1F5F9] leading-snug min-h-[2.4rem]"
          >
            {frame.segment.narration}
          </p>

          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={0.1}
              value={frame.timeSec}
              aria-label="Presentation Film Timeline"
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="w-full vca-slider"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onTogglePlay}
                  aria-label={playing ? 'Pause Launch Film' : 'Play Launch Film'}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-[#0EA5E9] hover:bg-[#0284C7] text-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {playing ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>{frame.timeSec >= totalDuration ? 'Replay' : 'Play'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onRestart}
                  aria-label="Restart Film"
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>00:00</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={muted ? 'Unmute Soundtrack & Voiceover' : 'Mute Soundtrack & Voiceover'}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{muted ? 'Muted' : 'Audio On'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto">
                {scenes.map((seg) => {
                  const active = seg.id === frame.segment.id;
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => onSeek(seg.startSec)}
                      title={seg.title}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded border whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
                          : 'bg-[#11161F] border-[#1B2332] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      0{seg.index}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
