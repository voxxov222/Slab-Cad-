import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Film,
  Layers,
  Loader2,
  Minimize2,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Video,
  Wrench,
} from 'lucide-react';
import { EngineeringMetrics, POLYMER_SPECS } from '../cad/engineeringMath';
import {
  CompositedRecorderHandle,
  ExplainerAudioDirector,
  ExportMediaFormat,
  VoiceEngineMode,
  startExplainerVideoRecorder,
  transcodeMediaBlob,
} from '../cad/explainerMedia';
import {
  DEFAULT_EXPLAINER_SCENES,
  EXPLAINER_DURATION_SEC,
  ExplainerFrameState,
  ExplainerSegment,
  MaleVoiceId,
  VideoResolutionId,
  evaluateExplainerFrame,
} from '../cad/explainerTimeline';
import {
  PRESENTATION_PROMPT_PRESETS,
  PresentationPlan,
  validatePresentationPrompt,
} from '../cad/presentationGenerator';
import {
  ASSEMBLY_SEQUENCE,
  DEFAULT_SLAB_PARAMETERS,
  SLAB_COMPONENTS,
  SlabComponentId,
  SlabParameters,
  VIEW_PRESETS,
  ViewPresetId,
} from '../cad/types';
import { ExplainerTourOverlay } from './ExplainerTourOverlay';
import { SlabViewport3D } from './SlabViewport3D';

interface CadStudioViewProps {
  params: SlabParameters;
  metrics: EngineeringMetrics;
  onChangeParams: (next: SlabParameters) => void;
  onOpenFilmStudio?: () => void;
}

type DockMode = 'views' | 'explode' | 'parameters' | 'assembly';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  specBadge?: string;
  onChange: (val: number) => void;
}

const SliderField: React.FC<SliderFieldProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = 'mm',
  specBadge = 'Proposed',
  onChange,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#CBD5E1] font-medium">{label}</span>
      <span className="font-mono text-[#38BDF8] tabular-nums">
        {value.toFixed(step < 0.1 ? 2 : 1)} {unit}
      </span>
    </div>
    <input
      type="range"
      className="w-full vca-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
    <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
      <span>
        {min}–{max} {unit}
      </span>
      <span>{specBadge}</span>
    </div>
  </div>
);

export const CadStudioView: React.FC<CadStudioViewProps> = ({
  params,
  metrics,
  onChangeParams,
}) => {
  const [activeView, setActiveView] = useState<ViewPresetId>('assembled');
  const [explodeAmount, setExplodeAmount] = useState<number>(0);
  const [isExploded, setIsExploded] = useState<boolean>(false);
  const [sectionEnabled, setSectionEnabled] = useState<boolean>(false);
  const [sectionOffsetMm, setSectionOffsetMm] = useState<number>(0);
  const [selectedComponent, setSelectedComponent] = useState<SlabComponentId | null>(null);
  const [showCallouts, setShowCallouts] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [dockMode, setDockMode] = useState<DockMode>('views');
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  // 90-Second Launch Film, Hybrid Soundtrack & Male Voiceover State
  const [explainerActive, setExplainerActive] = useState<boolean>(false);
  const [explainerPlaying, setExplainerPlaying] = useState<boolean>(false);
  const [explainerRecording, setExplainerRecording] = useState<boolean>(false);
  const [explainerTimeSec, setExplainerTimeSec] = useState<number>(0);
  const [explainerScenes, setExplainerScenes] = useState<ExplainerSegment[]>(
    DEFAULT_EXPLAINER_SCENES
  );
  const [voiceMode, setVoiceMode] = useState<VoiceEngineMode>('checking');
  const [maleVoice, setMaleVoice] = useState<MaleVoiceId>('Charon');
  const [exportResolution, setExportResolution] = useState<VideoResolutionId>('1080p');
  const [explainerMuted, setExplainerMuted] = useState<boolean>(false);
  const [includeReferenceIntro, setIncludeReferenceIntro] = useState<boolean>(true);
  const [recordedWebmBlob, setRecordedWebmBlob] = useState<Blob | null>(null);
  const [exportingLabel, setExportingLabel] = useState<string | null>(null);

  // Prompt-to-Presentation Creative Video Generation State
  const [presentationPrompt, setPresentationPrompt] = useState<string>('');
  const [presentationGenerating, setPresentationGenerating] = useState<boolean>(false);
  const [presentationError, setPresentationError] = useState<string | null>(null);
  const [activePresentationTitle, setActivePresentationTitle] = useState<string | null>(null);
  const [activePresentationOrigin, setActivePresentationOrigin] = useState<
    'gemini' | 'studio-director' | null
  >(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const refVideoElRef = useRef<HTMLVideoElement | null>(null);
  const audioDirectorRef = useRef<ExplainerAudioDirector | null>(null);
  const recorderRef = useRef<CompositedRecorderHandle | null>(null);
  const pendingExportFormatRef = useRef<ExportMediaFormat | null>(null);
  const lastSpokenSegIdRef = useRef<string | null>(null);

  // Framer Motion spring value driving the 3D Z-axis slab separation
  const explodeMotion = useMotionValue(0);
  const explodeScaleX = useTransform(explodeMotion, [0, 1], [0, 1]);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);

  const getAudioDirector = () => {
    if (!audioDirectorRef.current) {
      audioDirectorRef.current = new ExplainerAudioDirector();
    }
    return audioDirectorRef.current;
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  useEffect(() => {
    return () => {
      animRef.current?.stop();
      audioDirectorRef.current?.dispose();
    };
  }, []);

  const totalFilmDuration =
    explainerScenes[explainerScenes.length - 1]?.endSec || EXPLAINER_DURATION_SEC;

  const directorFrame: ExplainerFrameState | null = explainerActive
    ? evaluateExplainerFrame(explainerTimeSec, explainerScenes)
    : null;

  useEffect(() => {
    if (directorFrame && recorderRef.current) {
      recorderRef.current.updateOverlayFrame(directorFrame, params.serialNumber, totalFilmDuration);
    }
  }, [directorFrame, params.serialNumber, totalFilmDuration]);

  // 90-second wall-clock timeline playback loop
  useEffect(() => {
    if (!explainerActive || !explainerPlaying) return;
    let rafId = 0;
    let prev = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.25, Math.max(0.001, (now - prev) / 1000));
      prev = now;
      setExplainerTimeSec((curr) => {
        const next = curr + dt;
        if (next >= totalFilmDuration) {
          setExplainerPlaying(false);
          audioDirectorRef.current?.stopSoundtrack();
          if (recorderRef.current) {
            const activeRec = recorderRef.current;
            const autoFmt = pendingExportFormatRef.current || (exportResolution === '480p' ? 'mp4-regular' : exportResolution === '2160p' ? 'mp4-4k' : 'mp4-hd');
            recorderRef.current = null;
            pendingExportFormatRef.current = null;
            setExplainerRecording(false);
            setExportingLabel(`Transcoding ${autoFmt.toUpperCase()} via FFmpeg...`);
            void activeRec
              .stop()
              .then(async (blob) => {
                setRecordedWebmBlob(blob);
                const out = await transcodeMediaBlob(blob, autoFmt, params.serialNumber);
                triggerBlobDownload(out.blob, out.filename);
              })
              .catch(() => {
                // ignore cancellation
              })
              .finally(() => setExportingLabel(null));
          }
          return totalFilmDuration;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [explainerActive, explainerPlaying, params.serialNumber, totalFilmDuration, exportResolution]);

  // Trigger male voiceover, soundtrack modulation & synchronized SFX on scene transitions
  useEffect(() => {
    if (!explainerActive || !explainerPlaying || !directorFrame) return;
    const inRefIntro = includeReferenceIntro && directorFrame.timeSec < 10.0;
    const dir = getAudioDirector();
    dir.setSoundtrackDucked(inRefIntro);

    if (inRefIntro) {
      if (lastSpokenSegIdRef.current !== 'ref-intro') {
        lastSpokenSegIdRef.current = 'ref-intro';
        dir.stopSpeech();
      }
      return;
    }

    const seg = directorFrame.segment;
    if (lastSpokenSegIdRef.current === seg.id) return;
    lastSpokenSegIdRef.current = seg.id;

    dir.modulateSoundtrack(seg.index);
    dir.playSceneSfx(seg.id, seg.sfxStyle);
    void dir.speakSegment(seg.id, seg.narration, maleVoice).then((mode) => {
      setVoiceMode(mode);
    });
  }, [explainerActive, explainerPlaying, directorFrame, maleVoice, includeReferenceIntro]);

  const handleStartExplainer = () => {
    animRef.current?.stop();
    setInspectorOpen(false);
    setExplainerScenes(DEFAULT_EXPLAINER_SCENES);
    setActivePresentationTitle(null);
    setActivePresentationOrigin(null);
    setIncludeReferenceIntro(true);
    setRecordedWebmBlob(null);
    setExplainerActive(true);
    setExplainerTimeSec(0);
    lastSpokenSegIdRef.current = null;
    const dir = getAudioDirector();
    if (refVideoElRef.current) {
      dir.attachReferenceVideo(refVideoElRef.current);
    }
    dir.setMuted(explainerMuted);
    dir.setSoundtrackDucked(true);
    dir.startSoundtrack();
    void dir.prefetchAll(maleVoice, DEFAULT_EXPLAINER_SCENES).then((mode) => setVoiceMode(mode));
    setExplainerPlaying(true);
  };

  const handleGeneratePresentation = async (promptOverride?: string) => {
    const rawText = typeof promptOverride === 'string' ? promptOverride : presentationPrompt;
    if (typeof promptOverride === 'string') {
      setPresentationPrompt(promptOverride);
    }
    const validation = validatePresentationPrompt(rawText);
    if (!validation.ok) {
      setPresentationError(validation.error || 'Describe what you want to see.');
      return;
    }

    setPresentationError(null);
    setPresentationGenerating(true);

    try {
      const res = await fetch('/api/generate-presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: validation.cleaned,
          params,
        }),
      });
      const data = (await res.json()) as { plan?: PresentationPlan; error?: string };
      if (!res.ok || !data.plan) {
        setPresentationError(data.error || 'Could not generate presentation video.');
        return;
      }

      const plan = data.plan;
      animRef.current?.stop();
      setInspectorOpen(false);
      setExplainerScenes(plan.scenes);
      setActivePresentationTitle(plan.title);
      setActivePresentationOrigin(plan.generatedBy);
      setIncludeReferenceIntro(false);
      setRecordedWebmBlob(null);
      setExplainerTimeSec(0);
      lastSpokenSegIdRef.current = null;

      const dir = getAudioDirector();
      dir.stopSpeech();
      dir.setMuted(explainerMuted);
      dir.setSoundtrackDucked(false);
      dir.startSoundtrack();
      void dir.prefetchAll(maleVoice, plan.scenes).then((mode) => setVoiceMode(mode));

      setExplainerActive(true);
      setExplainerPlaying(true);
    } catch {
      setPresentationError('Network error generating presentation video. Try again.');
    } finally {
      setPresentationGenerating(false);
    }
  };

  const handleToggleExplainerPlay = () => {
    const dir = getAudioDirector();
    if (explainerPlaying) {
      setExplainerPlaying(false);
      dir.stopSpeech();
      dir.stopSoundtrack();
    } else {
      if (explainerTimeSec >= totalFilmDuration) {
        setExplainerTimeSec(0);
      }
      lastSpokenSegIdRef.current = null;
      dir.setMuted(explainerMuted);
      dir.startSoundtrack();
      setExplainerPlaying(true);
    }
  };

  const handleRestartExplainer = () => {
    const dir = getAudioDirector();
    dir.stopSpeech();
    lastSpokenSegIdRef.current = null;
    setExplainerTimeSec(0);
    dir.setMuted(explainerMuted);
    dir.startSoundtrack();
    setExplainerPlaying(true);
  };

  const handleSeekExplainer = (sec: number) => {
    const dir = getAudioDirector();
    dir.stopSpeech();
    lastSpokenSegIdRef.current = null;
    setExplainerTimeSec(Math.max(0, Math.min(totalFilmDuration, sec)));
  };

  const handleToggleMute = () => {
    const nextMuted = !explainerMuted;
    setExplainerMuted(nextMuted);
    getAudioDirector().setMuted(nextMuted);
  };

  const handleChangeMaleVoice = (nextVoice: MaleVoiceId) => {
    setMaleVoice(nextVoice);
    lastSpokenSegIdRef.current = null;
    const dir = getAudioDirector();
    dir.stopSpeech();
    void dir.prefetchAll(nextVoice, explainerScenes).then((mode) => setVoiceMode(mode));
  };

  const handleStopRecord = () => {
    const activeRec = recorderRef.current;
    const pendingFmt =
      pendingExportFormatRef.current ||
      (exportResolution === '480p'
        ? 'mp4-regular'
        : exportResolution === '2160p'
          ? 'mp4-4k'
          : 'mp4-hd');
    recorderRef.current = null;
    pendingExportFormatRef.current = null;
    setExplainerRecording(false);
    setExplainerPlaying(false);
    audioDirectorRef.current?.stopSpeech();
    audioDirectorRef.current?.stopSoundtrack();
    if (!activeRec) return;

    setExportingLabel(`Transcoding ${pendingFmt.toUpperCase()} via FFmpeg...`);
    void activeRec
      .stop()
      .then(async (blob) => {
        setRecordedWebmBlob(blob);
        const out = await transcodeMediaBlob(blob, pendingFmt, params.serialNumber);
        triggerBlobDownload(out.blob, out.filename);
      })
      .finally(() => setExportingLabel(null));
  };

  const handleStartRecord90s = async (autoFormat?: ExportMediaFormat) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targetRes: VideoResolutionId =
      autoFormat === 'mp4-regular'
        ? '480p'
        : autoFormat === 'mp4-4k'
          ? '2160p'
          : autoFormat === 'mp4-hd'
            ? '1080p'
            : exportResolution;
    setExportResolution(targetRes);
    pendingExportFormatRef.current = autoFormat || null;

    const dir = getAudioDirector();
    if (refVideoElRef.current) {
      dir.attachReferenceVideo(refVideoElRef.current);
    }
    dir.stopSpeech();
    dir.setMuted(false);
    setExplainerMuted(false);
    dir.setSoundtrackDucked(includeReferenceIntro);
    dir.startSoundtrack();
    const mode = await dir.prefetchAll(maleVoice, explainerScenes);
    setVoiceMode(mode);

    const recorder = startExplainerVideoRecorder(
      canvas,
      dir.getOutputMediaStream(),
      targetRes,
      {
        getRefVideo: () => refVideoElRef.current,
        includeReferenceIntro,
      }
    );
    recorderRef.current = recorder;
    lastSpokenSegIdRef.current = null;
    setExplainerTimeSec(0);
    setExplainerRecording(true);
    setExplainerPlaying(true);
  };

  const handleDownloadFormat = async (format: ExportMediaFormat) => {
    if (format === 'mp3') {
      try {
        setExportingLabel('Rendering 90s MP3 Audio (192 kbps)...');
        const dir = getAudioDirector();
        const sourceBlob = recordedWebmBlob
          ? recordedWebmBlob
          : await dir.renderFullAudioMixWav(maleVoice, explainerScenes, includeReferenceIntro);
        const out = await transcodeMediaBlob(sourceBlob, 'mp3', params.serialNumber);
        triggerBlobDownload(out.blob, out.filename);
      } finally {
        setExportingLabel(null);
      }
      return;
    }

    if (recordedWebmBlob) {
      try {
        setExportingLabel(
          format === 'mp4-regular'
            ? 'Transcoding Regular MP4 (480p)...'
            : 'Transcoding Full HD MP4 (1080p)...'
        );
        const out = await transcodeMediaBlob(recordedWebmBlob, format, params.serialNumber);
        triggerBlobDownload(out.blob, out.filename);
      } finally {
        setExportingLabel(null);
      }
      return;
    }

    await handleStartRecord90s(format);
  };

  const handleExitExplainer = () => {
    if (recorderRef.current) {
      recorderRef.current = null;
      pendingExportFormatRef.current = null;
      setExplainerRecording(false);
    }
    setExplainerPlaying(false);
    setExplainerActive(false);
    lastSpokenSegIdRef.current = null;
    audioDirectorRef.current?.stopSpeech();
    audioDirectorRef.current?.stopSoundtrack();
  };

  const animateExplodeTo = (target: number) => {
    const clamped = Math.max(0, Math.min(1, target));
    animRef.current?.stop();
    setExplodeAmount(clamped);
    setIsExploded(clamped >= 0.5);
    animRef.current = animate(explodeMotion, clamped, {
      type: 'spring',
      stiffness: 115,
      damping: 18,
      mass: 0.85,
    });
  };

  const handleToggleExplode = () => {
    const nextExploded = !isExploded;
    const nextTarget = nextExploded ? 1 : 0;
    animateExplodeTo(nextTarget);
    setShowCallouts(nextExploded);
    if (nextExploded && (activeView === 'assembled' || activeView === 'front' || activeView === 'rear')) {
      setActiveView('exploded');
    } else if (!nextExploded && activeView === 'exploded') {
      setActiveView('assembled');
    }
  };

  const currentPreset = VIEW_PRESETS.find((v) => v.id === activeView) || VIEW_PRESETS[0];
  const selectedMeta = SLAB_COMPONENTS.find((c) => c.id === selectedComponent) || null;

  const handleSelectView = (viewId: ViewPresetId) => {
    const preset = VIEW_PRESETS.find((v) => v.id === viewId);
    if (!preset) return;
    setActiveView(viewId);
    animateExplodeTo(preset.defaultExplode);
    setSectionEnabled(preset.enableSection);
    setShowCallouts(viewId === 'exploded');
    if (preset.highlightComponent) {
      setSelectedComponent(preset.highlightComponent);
    } else if (viewId === 'assembled') {
      setSelectedComponent(null);
    }
  };

  const handleSelectComponentFromScene = (id: SlabComponentId | null) => {
    setSelectedComponent(id);
    if (id) {
      setInspectorOpen(true);
      setDockMode('parameters');
    }
  };

  const handleStepSelect = (idx: number) => {
    const step = ASSEMBLY_SEQUENCE[idx];
    if (!step) return;
    setActiveStepIndex(idx);
    setActiveView(step.cameraTarget);
    animateExplodeTo(step.explodePreview);
    setShowCallouts(true);
    setSelectedComponent(step.componentIds[0] || null);
  };

  const updateParam = <K extends keyof SlabParameters>(key: K, val: SlabParameters[K]) => {
    onChangeParams({ ...params, [key]: val });
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-[#090C11]">
      {/* Left/Main Unobstructed 3D CAD Viewport */}
      <div className="relative flex-1 min-w-0 h-full">
        <SlabViewport3D
          params={params}
          metrics={metrics}
          activeView={activeView}
          explodeMotion={explodeMotion}
          selectedComponent={directorFrame ? directorFrame.highlightComponent : selectedComponent}
          sectionEnabled={directorFrame ? directorFrame.sectionEnabled : sectionEnabled}
          sectionOffsetMm={directorFrame ? directorFrame.sectionOffsetMm : sectionOffsetMm}
          showCallouts={
            directorFrame
              ? directorFrame.showCallouts && directorFrame.explode >= 0.3
              : showCallouts
          }
          directorFrame={directorFrame}
          onCanvasReady={(canvas) => {
            canvasRef.current = canvas;
          }}
          onSelectComponent={handleSelectComponentFromScene}
        />

        {/* Quiet Top-Left Engineering Telemetry Readout (Hidden during Cinema Mode to avoid toolbar overlap) */}
        {!directorFrame && (
          <div className="pointer-events-none absolute top-4 left-5 z-10 max-w-md space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8]">
              <span className="text-[#38BDF8] font-semibold">{params.serialNumber}</span>
              <span aria-hidden="true">·</span>
              <span>
                {params.overallWidthMm.toFixed(1)} × {params.overallHeightMm.toFixed(1)} ×{' '}
                {params.overallThicknessMm.toFixed(1)} mm
              </span>
              <span aria-hidden="true">·</span>
              <span>{metrics.estimatedTotalMassG} g</span>
            </div>
            <h1 className="text-sm font-semibold text-white">{currentPreset.label}</h1>
            <p className="text-xs text-[#94A3B8] leading-relaxed">{currentPreset.description}</p>
            {metrics.warnings.length > 0 && (
              <p className="text-xs text-amber-400 font-medium pt-0.5">
                Design Alert: {metrics.warnings[0]}
              </p>
            )}
          </div>
        )}

        {/* 90-Second Launch Film Cinema Overlay OR Regular CAD Dock */}
        {explainerActive && directorFrame ? (
          <ExplainerTourOverlay
            playing={explainerPlaying}
            recording={explainerRecording}
            includeReferenceIntro={includeReferenceIntro}
            hasRecordedClip={Boolean(recordedWebmBlob)}
            exportingLabel={exportingLabel}
            frame={directorFrame}
            scenes={explainerScenes}
            voiceMode={voiceMode}
            maleVoice={maleVoice}
            resolution={exportResolution}
            muted={explainerMuted}
            serialNumber={params.serialNumber}
            presentationTitle={activePresentationTitle}
            presentationOrigin={activePresentationOrigin}
            presentationPrompt={presentationPrompt}
            generatingPresentation={presentationGenerating}
            presentationError={presentationError}
            onChangePrompt={(val) => {
              setPresentationPrompt(val);
              if (presentationError) setPresentationError(null);
            }}
            onGeneratePresentation={(override) => {
              void handleGeneratePresentation(override);
            }}
            onAttachRefVideo={(el) => {
              refVideoElRef.current = el;
              if (el) {
                getAudioDirector().attachReferenceVideo(el);
              }
            }}
            onToggleReferenceIntro={() => setIncludeReferenceIntro((v) => !v)}
            onTogglePlay={handleToggleExplainerPlay}
            onRestart={handleRestartExplainer}
            onSeek={handleSeekExplainer}
            onChangeMaleVoice={handleChangeMaleVoice}
            onChangeResolution={setExportResolution}
            onChangeScenes={setExplainerScenes}
            onToggleMute={handleToggleMute}
            onStartRecord90s={(autoFormat) => {
              void handleStartRecord90s(autoFormat);
            }}
            onStopRecord={handleStopRecord}
            onDownloadFormat={(format) => {
              void handleDownloadFormat(format);
            }}
            onExit={handleExitExplainer}
          />
        ) : (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-20 transition-transform duration-200 ${
            dockCollapsed ? 'bottom-3 translate-y-[calc(100%-34px)]' : 'bottom-4 translate-y-0'
          } w-[min(1040px,96vw)]`}
        >
          {/* Collapse / Expand Handle */}
          <div className="flex justify-center mb-1.5">
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-[#CBD5E1] bg-[#11161F] border border-[#1B2332] hover:border-[#38BDF8] rounded-md cursor-pointer"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Show Controls</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Hide Controls</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-[#0D121B] border border-[#1B2332] rounded-lg p-2.5 shadow-2xl">
            {/* Simple Presentation Video Prompt Control */}
            <div className="pb-2 mb-2 border-b border-[#1B2332] space-y-1.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleGeneratePresentation();
                }}
                className="flex items-center gap-2"
              >
                <label htmlFor="presentation-video-prompt" className="sr-only">
                  Presentation video prompt
                </label>
                <div className="flex-1 min-w-0 flex items-center gap-2 bg-[#11161F] border border-[#1B2332] focus-within:border-[#0EA5E9] rounded-md px-3 py-1.5">
                  <Video className="w-4 h-4 text-[#38BDF8] shrink-0" />
                  <input
                    id="presentation-video-prompt"
                    type="text"
                    value={presentationPrompt}
                    onChange={(e) => {
                      setPresentationPrompt(e.target.value);
                      if (presentationError) setPresentationError(null);
                    }}
                    placeholder="Describe the presentation video you want to see (e.g. 'Macro NFC chip orbit with RF waves & smartphone tap')..."
                    aria-label="Presentation video prompt"
                    disabled={presentationGenerating}
                    className="w-full min-w-0 bg-transparent text-xs text-white placeholder-[#64748B] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={presentationGenerating}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-60 text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  {presentationGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Film className="w-3.5 h-3.5" />
                      <span>Generate Video</span>
                    </>
                  )}
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[11px] text-[#64748B] whitespace-nowrap shrink-0">
                    Try:
                  </span>
                  {PRESENTATION_PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={presentationGenerating}
                      onClick={() => {
                        void handleGeneratePresentation(preset.prompt);
                      }}
                      className="px-2 py-0.5 text-[11px] font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#94A3B8] hover:text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {presentationError && (
                  <p role="alert" className="text-[11px] text-rose-400 font-medium">
                    {presentationError}
                  </p>
                )}
              </div>
            </div>

            {/* Dock Tab Strip + Quick Actions */}
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-1.5 pb-2 mb-2 border-b border-[#1B2332]">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDockMode('views')}
                  className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap cursor-pointer ${
                    dockMode === 'views'
                      ? 'bg-[#0EA5E9] text-white'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#161E2E]'
                  }`}
                >
                  12 Engineering Views
                </button>
                <button
                  type="button"
                  onClick={() => setDockMode('explode')}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded whitespace-nowrap cursor-pointer ${
                    dockMode === 'explode'
                      ? 'bg-[#0EA5E9] text-white'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#161E2E]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Explode & Section</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDockMode('assembly');
                    handleStepSelect(activeStepIndex);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded whitespace-nowrap cursor-pointer ${
                    dockMode === 'assembly'
                      ? 'bg-[#0EA5E9] text-white'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#161E2E]'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Assembly Sequence</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <motion.button
                  type="button"
                  onClick={handleStartExplainer}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border border-[#38BDF8]/60 bg-[#0EA5E9]/15 text-[#38BDF8] hover:bg-[#0EA5E9] hover:text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  <span>90s Launch Film</span>
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleToggleExplode}
                  aria-pressed={isExploded}
                  data-exploded={isExploded ? 'true' : 'false'}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                  className={`relative overflow-hidden flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    isExploded
                      ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
                      : 'bg-[#11161F] border-[#1B2332] text-[#CBD5E1] hover:border-[#38BDF8] hover:text-white'
                  }`}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isExploded ? (
                      <motion.span
                        key="collapse"
                        initial={{ opacity: 0, y: 4, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.92 }}
                        transition={{ duration: 0.14 }}
                        className="flex items-center gap-1.5"
                      >
                        <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Collapse Slab</span>
                      </motion.span>
                    ) : (
                      <motion.span
                        key="explode"
                        initial={{ opacity: 0, y: -4, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.92 }}
                        transition={{ duration: 0.14 }}
                        className="flex items-center gap-1.5"
                      >
                        <Layers className="w-3.5 h-3.5 shrink-0" />
                        <span>Explode Slab</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#7DD3FC] origin-left"
                    style={{ scaleX: explodeScaleX }}
                  />
                </motion.button>
                <button
                  type="button"
                  onClick={() => setShowCallouts((v) => !v)}
                  className={`px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap cursor-pointer ${
                    showCallouts
                      ? 'border-[#0EA5E9] text-[#38BDF8] bg-[#0EA5E9]/10'
                      : 'border-[#1B2332] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {showCallouts ? 'Callouts On' : 'Callouts Off'}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorOpen((v) => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap cursor-pointer ${
                    inspectorOpen
                      ? 'border-[#0EA5E9] text-white bg-[#0EA5E9]/20'
                      : 'border-[#1B2332] text-[#CBD5E1] hover:border-[#38BDF8]'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{inspectorOpen ? 'Close CAD Editor' : 'Edit CAD Dimensions'}</span>
                </button>
              </div>
            </div>

            {/* Dock Content Body */}
            {dockMode === 'views' && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                {VIEW_PRESETS.map((preset) => {
                  const isActive = activeView === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectView(preset.id)}
                      className={`px-2 py-1.5 text-[11px] font-medium rounded border text-left truncate whitespace-nowrap cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#162235] border-[#0EA5E9] text-white'
                          : 'bg-[#11161F] border-[#1B2332] text-[#94A3B8] hover:text-white hover:border-[#2B374F]'
                      }`}
                      title={preset.label}
                    >
                      {preset.shortLabel}
                    </button>
                  );
                })}
              </div>
            )}

            {dockMode === 'explode' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="text-[#CBD5E1] font-medium">Exploded Layer Separation</span>
                    <div className="flex items-center gap-2">
                      <motion.button
                        type="button"
                        onClick={handleToggleExplode}
                        aria-pressed={isExploded}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                        className="px-2 py-0.5 text-[11px] font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#0EA5E9] text-[#38BDF8] cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={isExploded ? 'collapse-sub' : 'explode-sub'}
                            initial={{ opacity: 0, y: 3 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -3 }}
                            transition={{ duration: 0.12 }}
                            className="inline-block"
                          >
                            {isExploded ? 'Animate Collapse' : 'Animate Explode'}
                          </motion.span>
                        </AnimatePresence>
                      </motion.button>
                      <span className="font-mono text-[#38BDF8] tabular-nums">
                        {Math.round(explodeAmount * 100)}%
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={explodeAmount}
                    aria-label="Exploded Layer Separation"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      animRef.current?.stop();
                      explodeMotion.set(val);
                      setExplodeAmount(val);
                      setIsExploded(val >= 0.5);
                      if (val > 0.15) setShowCallouts(true);
                    }}
                    className="w-full vca-slider"
                  />
                  <div className="h-1 w-full bg-[#11161F] rounded overflow-hidden">
                    <motion.div
                      className="h-full bg-[#0EA5E9] origin-left"
                      style={{ scaleX: explodeScaleX }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setSectionEnabled((v) => !v)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs cursor-pointer ${
                        sectionEnabled
                          ? 'border-[#0EA5E9] text-[#38BDF8] bg-[#0EA5E9]/10'
                          : 'border-[#1B2332] text-[#94A3B8]'
                      }`}
                    >
                      <Scissors className="w-3 h-3" />
                      <span>{sectionEnabled ? 'Cross-Section Active' : 'Enable Cross-Section'}</span>
                    </button>
                    <span className="font-mono text-[#38BDF8] tabular-nums">
                      X = {sectionOffsetMm.toFixed(1)} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-38}
                    max={38}
                    step={0.5}
                    disabled={!sectionEnabled}
                    value={sectionOffsetMm}
                    aria-label="Cross-Section Cut Plane"
                    onChange={(e) => setSectionOffsetMm(parseFloat(e.target.value))}
                    className="w-full vca-slider disabled:opacity-40"
                  />
                </div>
              </div>
            )}

            {dockMode === 'assembly' && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {ASSEMBLY_SEQUENCE.map((step, i) => (
                    <button
                      key={step.stepNumber}
                      type="button"
                      onClick={() => handleStepSelect(i)}
                      className={`px-2.5 py-1 text-xs font-mono rounded border whitespace-nowrap shrink-0 cursor-pointer ${
                        activeStepIndex === i
                          ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
                          : 'bg-[#11161F] border-[#1B2332] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      Step {step.stepNumber}
                    </button>
                  ))}
                </div>
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-white">
                    {ASSEMBLY_SEQUENCE[activeStepIndex].stepNumber}.{' '}
                    {ASSEMBLY_SEQUENCE[activeStepIndex].title}
                  </div>
                  <p className="text-[#94A3B8]">
                    {ASSEMBLY_SEQUENCE[activeStepIndex].instruction}
                  </p>
                  <p className="text-[#38BDF8] font-mono text-[11px]">
                    QC Gate: {ASSEMBLY_SEQUENCE[activeStepIndex].qcGate}
                  </p>
                </div>
              </div>
            )}

            {dockMode === 'parameters' && (
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>
                  Click any component in the 3D viewport or use the right-hand Parametric CAD
                  Inspector to adjust dimensions live.
                </span>
                <button
                  type="button"
                  onClick={() => setInspectorOpen(true)}
                  className="px-3 py-1 bg-[#0EA5E9] text-white rounded font-medium whitespace-nowrap cursor-pointer"
                >
                  Open Inspector
                </button>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Side-by-Side Parametric CAD & Component Inspector Panel (Zero Collision w/ 3D Canvas) */}
      <AnimatePresence>
      {inspectorOpen && (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.18 }}
          className="w-[370px] shrink-0 h-full border-l border-[#1B2332] bg-[#0D121B] flex flex-col overflow-hidden z-20"
        >
          <div className="px-4 py-3 border-b border-[#1B2332] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Parametric CAD Inspector</h2>
              <p className="text-[11px] text-[#94A3B8]">
                All dimensions editable · Live geometry & RF update
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChangeParams(DEFAULT_SLAB_PARAMETERS)}
              title="Reset to Baseline VCA Spec"
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#94A3B8] hover:text-white border border-[#1B2332] rounded cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Component Selector */}
            <div className="space-y-1.5">
              <label
                htmlFor="component-selector"
                className="block text-xs font-medium text-[#CBD5E1]"
              >
                Inspect Physical Component (12 Parts)
              </label>
              <select
                id="component-selector"
                value={selectedComponent || ''}
                onChange={(e) =>
                  setSelectedComponent(
                    e.target.value ? (e.target.value as SlabComponentId) : null
                  )
                }
                className="w-full bg-[#11161F] border border-[#1B2332] rounded px-2.5 py-1.5 text-xs text-white focus:border-[#0EA5E9] outline-none"
              >
                <option value="">All Components (Full Assembly)</option>
                {SLAB_COMPONENTS.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.calloutNumber} — {c.name}
                  </option>
                ))}
              </select>

              {selectedMeta && (
                <div className="p-2.5 rounded bg-[#11161F] border border-[#1B2332] space-y-1 text-xs">
                  <div className="font-semibold text-[#38BDF8]">
                    #{selectedMeta.calloutNumber} {selectedMeta.name}
                  </div>
                  <p className="text-[#94A3B8] text-[11px] leading-relaxed">
                    {selectedMeta.description}
                  </p>
                  <div className="text-[11px] font-mono text-[#CBD5E1] pt-1">
                    Material: {selectedMeta.material}
                  </div>
                  <div className="text-[11px] font-mono text-[#64748B]">
                    Process: {selectedMeta.process}
                  </div>
                </div>
              )}
            </div>

            {/* Section 1: Exterior Envelope & Wall */}
            <div className="space-y-3 pt-2 border-t border-[#1B2332]">
              <h3 className="text-xs font-semibold text-white">01. Exterior Housing & Moulding</h3>
              <SliderField
                label="Overall Width"
                value={params.overallWidthMm}
                min={78}
                max={96}
                step={0.5}
                onChange={(v) => updateParam('overallWidthMm', v)}
              />
              <SliderField
                label="Overall Height"
                value={params.overallHeightMm}
                min={126}
                max={152}
                step={0.5}
                onChange={(v) => updateParam('overallHeightMm', v)}
              />
              <SliderField
                label="Overall Thickness"
                value={params.overallThicknessMm}
                min={5.2}
                max={10.5}
                step={0.1}
                onChange={(v) => updateParam('overallThicknessMm', v)}
              />
              <SliderField
                label="Optical Wall Thickness"
                value={params.wallThicknessMm}
                min={1.2}
                max={2.8}
                step={0.05}
                onChange={(v) => updateParam('wallThicknessMm', v)}
              />
              <SliderField
                label="Shoulder Chamfer"
                value={params.shoulderChamferMm}
                min={2.0}
                max={14.0}
                step={0.5}
                onChange={(v) => updateParam('shoulderChamferMm', v)}
              />
              <SliderField
                label="Corner Radius"
                value={params.cornerRadiusMm}
                min={1.5}
                max={8.0}
                step={0.5}
                onChange={(v) => updateParam('cornerRadiusMm', v)}
              />
              <SliderField
                label="Mould Draft Angle"
                value={params.draftAngleDeg}
                min={0.5}
                max={3.0}
                step={0.1}
                unit="deg"
                specBadge="Confirm w/ Moulder"
                onChange={(v) => updateParam('draftAngleDeg', v)}
              />
            </div>

            {/* Section 2: Card Cavity & Sleeve Tolerances */}
            <div className="space-y-3 pt-2 border-t border-[#1B2332]">
              <h3 className="text-xs font-semibold text-white">02. Internal Card Cavity</h3>
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="inner-sleeve-toggle" className="text-[#CBD5E1]">
                  Archival Inner Sleeve (50 µm/side)
                </label>
                <input
                  id="inner-sleeve-toggle"
                  type="checkbox"
                  checked={params.useInnerSleeve}
                  onChange={(e) => updateParam('useInnerSleeve', e.target.checked)}
                  className="accent-[#0EA5E9] w-4 h-4 cursor-pointer"
                />
              </div>
              <SliderField
                label="Card Thickness (12pt–130pt)"
                value={params.cardThicknessMm}
                min={0.28}
                max={3.3}
                step={0.05}
                onChange={(v) => updateParam('cardThicknessMm', v)}
              />
              <SliderField
                label="XY Cavity Clearance"
                value={params.cavityClearanceXYMm}
                min={0.2}
                max={1.2}
                step={0.05}
                onChange={(v) => updateParam('cavityClearanceXYMm', v)}
              />
              <SliderField
                label="Z-Axis Cavity Play"
                value={params.cavityDepthAllowanceMm}
                min={0.1}
                max={0.8}
                step={0.05}
                onChange={(v) => updateParam('cavityDepthAllowanceMm', v)}
              />
              <SliderField
                label="Corner Relief Radius"
                value={params.cornerReliefRadiusMm}
                min={0.8}
                max={2.5}
                step={0.1}
                onChange={(v) => updateParam('cornerReliefRadiusMm', v)}
              />
              <div className="p-2 rounded bg-[#11161F] text-[11px] font-mono text-[#94A3B8] space-y-0.5">
                <div>
                  Cavity Opening: {metrics.internalCavityWidthMm} × {metrics.internalCavityHeightMm} mm
                </div>
                <div>Cavity Depth: {metrics.internalCavityDepthMm} mm</div>
              </div>
            </div>

            {/* Section 3: Label, NFC Pocket & Antenna */}
            <div className="space-y-3 pt-2 border-t border-[#1B2332]">
              <h3 className="text-xs font-semibold text-white">03. Label Bay & Embedded NFC</h3>
              <div className="space-y-1">
                <label htmlFor="nfc-chip-select" className="text-xs text-[#CBD5E1]">
                  NFC IC Configuration
                </label>
                <select
                  id="nfc-chip-select"
                  value={params.nfcChipConfig}
                  onChange={(e) =>
                    updateParam('nfcChipConfig', e.target.value as 'ntag215' | 'ntag424_dna')
                  }
                  className="w-full bg-[#11161F] border border-[#1B2332] rounded px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="ntag424_dna">Production: NXP NTAG424 DNA (AES-128)</option>
                  <option value="ntag215">Prototype: NXP NTAG215 (Static NDEF)</option>
                </select>
              </div>
              <SliderField
                label="Label Bay Width"
                value={params.labelWidthMm}
                min={62}
                max={78}
                step={0.5}
                onChange={(v) => updateParam('labelWidthMm', v)}
              />
              <SliderField
                label="Label Bay Height"
                value={params.labelHeightMm}
                min={20}
                max={30}
                step={0.5}
                onChange={(v) => updateParam('labelHeightMm', v)}
              />
              <SliderField
                label="NFC Pocket Width"
                value={params.nfcPocketWidthMm}
                min={16}
                max={28}
                step={0.5}
                onChange={(v) => updateParam('nfcPocketWidthMm', v)}
              />
              <SliderField
                label="Antenna Outer Size"
                value={params.antennaOuterWidthMm}
                min={12}
                max={24}
                step={0.5}
                onChange={(v) => {
                  onChangeParams({
                    ...params,
                    antennaOuterWidthMm: v,
                    antennaOuterHeightMm: v,
                  });
                }}
              />
              <SliderField
                label="Antenna Spiral Turns"
                value={params.antennaTurns}
                min={3}
                max={10}
                step={1}
                unit="turns"
                onChange={(v) => updateParam('antennaTurns', v)}
              />
              <div className="p-2 rounded bg-[#11161F] text-[11px] font-mono text-[#94A3B8] space-y-0.5">
                <div>Inductance: {metrics.estimatedInductanceUh} µH @ 13.56 MHz</div>
                <div>Target Tuning Cap: {metrics.requiredTuningCapacitancePf} pF</div>
                <div>Est. Closed-Slab Read: ~{metrics.estimatedReadRangeMm} mm</div>
              </div>
            </div>

            {/* Section 4: Tamper Lock & Polymer */}
            <div className="space-y-3 pt-2 border-t border-[#1B2332]">
              <h3 className="text-xs font-semibold text-white">04. Ultrasonic Weld & Material</h3>
              <div className="space-y-1">
                <label htmlFor="polymer-select" className="text-xs text-[#CBD5E1]">
                  Optical Polymer Grade
                </label>
                <select
                  id="polymer-select"
                  value={params.polymerGrade}
                  onChange={(e) =>
                    updateParam(
                      'polymerGrade',
                      e.target.value as 'pc_makrolon' | 'petg_optical' | 'pmma_acrylic'
                    )
                  }
                  className="w-full bg-[#11161F] border border-[#1B2332] rounded px-2.5 py-1.5 text-xs text-white"
                >
                  {Object.values(POLYMER_SPECS).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <SliderField
                label="Energy Director Width"
                value={params.weldRidgeWidthMm}
                min={0.4}
                max={1.2}
                step={0.05}
                onChange={(v) => updateParam('weldRidgeWidthMm', v)}
              />
              <SliderField
                label="Interlock Tongue Depth"
                value={params.interlockTongueDepthMm}
                min={0.6}
                max={1.8}
                step={0.05}
                onChange={(v) => updateParam('interlockTongueDepthMm', v)}
              />
              <SliderField
                label="Assembly Tolerance (±)"
                value={params.assemblyToleranceMm}
                min={0.02}
                max={0.15}
                step={0.01}
                specBadge="ISO 2768-m"
                onChange={(v) => updateParam('assemblyToleranceMm', v)}
              />
            </div>
          </div>
        </motion.aside>
      )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
};
