import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValue } from 'motion/react';
import {
  CheckCircle2,
  Download,
  FileText,
  Layers,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Tag,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { EngineeringMetrics } from '../cad/engineeringMath';
import { SlabParameters } from '../cad/types';
import {
  CreatedVideoFrameState,
  CreatedVideoPlan,
  PositionedLeaderCallout,
  STUDIO_VOICES,
  StudioVoiceId,
  VIDEO_CATEGORIES,
  VIDEO_RESOLUTIONS,
  VideoFormatCategory,
  VideoResolutionId,
  buildFallbackCreatedVideo,
  evaluateCreatedVideoFrame,
  formatTimecode,
  validateCreateVideoPrompt,
} from '../cad/videoCreator';
import {
  ExportMediaFormat,
  VideoRecorderHandle,
  VoiceEngineMode,
  VoiceoverAudioDirector,
  startVideoCanvasRecorder,
  transcodeMediaBlob,
} from '../cad/videoVoiceAndExport';
import { SlabViewport3D } from './SlabViewport3D';

interface CreateVideoViewProps {
  params: SlabParameters;
  metrics: EngineeringMetrics;
  initialRequest?: {
    id: number;
    prompt: string;
    category?: VideoFormatCategory;
  } | null;
}

export const CreateVideoView: React.FC<CreateVideoViewProps> = ({
  params,
  metrics,
  initialRequest = null,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<VideoFormatCategory>(
    initialRequest?.category || 'blueprint-explainer'
  );
  const [prompt, setPrompt] = useState<string>(
    initialRequest?.prompt || VIDEO_CATEGORIES[3].starterPrompt
  );
  const [plan, setPlan] = useState<CreatedVideoPlan>(() =>
    buildFallbackCreatedVideo(
      initialRequest?.prompt || VIDEO_CATEGORIES[3].starterPrompt,
      initialRequest?.category || 'blueprint-explainer',
      params,
      metrics
    )
  );
  const [generating, setGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playback & Voiceover State (Voiceover ONLY — zero music, zero SFX)
  const [playing, setPlaying] = useState<boolean>(Boolean(initialRequest));
  const [timeSec, setTimeSec] = useState<number>(0);
  const [voiceId, setVoiceId] = useState<StudioVoiceId>('Charon');
  const [voiceMode, setVoiceMode] = useState<VoiceEngineMode>('checking');
  const [muted, setMuted] = useState<boolean>(false);

  // Export & Recording State
  const [resolution, setResolution] = useState<VideoResolutionId>('1080p');
  const [recording, setRecording] = useState<boolean>(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioDirectorRef = useRef<VoiceoverAudioDirector | null>(null);
  const recorderRef = useRef<VideoRecorderHandle | null>(null);
  const pendingExportFmtRef = useRef<ExportMediaFormat | null>(null);
  const lastSpokenSceneIdRef = useRef<string | null>(null);
  const handledInitReqIdRef = useRef<number | null>(null);
  const liveCalloutsRef = useRef<{
    callouts: PositionedLeaderCallout[];
    viewportW: number;
    viewportH: number;
  }>({ callouts: [], viewportW: 1280, viewportH: 720 });

  const explodeMotion = useMotionValue(0);

  const getAudioDirector = () => {
    if (!audioDirectorRef.current) {
      audioDirectorRef.current = new VoiceoverAudioDirector();
    }
    return audioDirectorRef.current;
  };

  useEffect(() => {
    return () => {
      audioDirectorRef.current?.dispose();
    };
  }, []);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const totalDurationSec =
    plan.scenes[plan.scenes.length - 1]?.endSec || plan.totalDurationSec || 40;

  const videoFrame: CreatedVideoFrameState = useMemo(
    () => evaluateCreatedVideoFrame(timeSec, plan.scenes),
    [timeSec, plan.scenes]
  );

  // Sync live callouts & current frame to compositor during MP4 capture
  useEffect(() => {
    if (recorderRef.current) {
      recorderRef.current.updateOverlayFrame(videoFrame, params.serialNumber);
    }
  }, [videoFrame, params.serialNumber]);

  const handleCreateVideo = async (
    overridePrompt?: string,
    overrideCategory?: VideoFormatCategory
  ) => {
    const rawPrompt = typeof overridePrompt === 'string' ? overridePrompt : prompt;
    const cat = overrideCategory || selectedCategory;
    if (typeof overridePrompt === 'string') setPrompt(overridePrompt);
    if (overrideCategory) setSelectedCategory(overrideCategory);

    const validation = validateCreateVideoPrompt(rawPrompt);
    if (!validation.ok) {
      setErrorMsg(validation.error || 'Describe the VCA video you want to create.');
      return;
    }

    setErrorMsg(null);
    setGenerating(true);

    try {
      const res = await fetch('/api/create-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: validation.cleaned,
          category: cat,
          params,
        }),
      });
      const data = (await res.json()) as { plan?: CreatedVideoPlan; error?: string };
      if (!res.ok || !data.plan) {
        setErrorMsg(data.error || 'Could not create presentation video.');
        return;
      }

      const nextPlan = data.plan;
      setPlan(nextPlan);
      setRecordedBlob(null);
      setTimeSec(0);
      lastSpokenSceneIdRef.current = null;

      const dir = getAudioDirector();
      dir.stopSpeech();
      dir.setMuted(muted);
      void dir.prefetchAll(voiceId, nextPlan.scenes).then((mode) => setVoiceMode(mode));

      setPlaying(true);
    } catch {
      setErrorMsg('Network error creating video presentation. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Trigger auto-generation when launched from CadStudioView quick text box
  useEffect(() => {
    if (!initialRequest) return;
    if (handledInitReqIdRef.current === initialRequest.id) return;
    handledInitReqIdRef.current = initialRequest.id;
    void handleCreateVideo(initialRequest.prompt, initialRequest.category);
  }, [initialRequest]);

  // Wall-clock 3D animation playback loop
  useEffect(() => {
    if (!playing) return;
    let rafId = 0;
    let prev = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.25, Math.max(0.001, (now - prev) / 1000));
      prev = now;
      setTimeSec((curr) => {
        const next = curr + dt;
        if (next >= totalDurationSec) {
          setPlaying(false);
          if (recorderRef.current) {
            const activeRec = recorderRef.current;
            const fmt =
              pendingExportFmtRef.current ||
              (resolution === '480p'
                ? 'mp4-regular'
                : resolution === '2160p'
                  ? 'mp4-4k'
                  : 'mp4-hd');
            recorderRef.current = null;
            pendingExportFmtRef.current = null;
            setRecording(false);
            setExportStatus(`Rendering ${fmt.toUpperCase()}...`);
            void activeRec
              .stop()
              .then(async (blob) => {
                setRecordedBlob(blob);
                const out = await transcodeMediaBlob(blob, fmt, params.serialNumber);
                triggerDownload(out.blob, out.filename);
              })
              .catch(() => {
                // ignore cancellation
              })
              .finally(() => setExportStatus(null));
          }
          return totalDurationSec;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, totalDurationSec, resolution, params.serialNumber]);

  // Trigger realistic studio voiceover (strictly no music / no SFX) on scene transitions
  useEffect(() => {
    if (!playing) return;
    const seg = videoFrame.segment;
    if (lastSpokenSceneIdRef.current === seg.id) return;
    lastSpokenSceneIdRef.current = seg.id;

    const dir = getAudioDirector();
    void dir.speakSegment(seg.id, seg.narration, voiceId).then((mode) => {
      setVoiceMode(mode);
    });
  }, [playing, videoFrame.segment, voiceId]);

  const handleTogglePlay = () => {
    const dir = getAudioDirector();
    if (playing) {
      setPlaying(false);
      dir.stopSpeech();
    } else {
      if (timeSec >= totalDurationSec - 0.1) {
        setTimeSec(0);
      }
      lastSpokenSceneIdRef.current = null;
      dir.setMuted(muted);
      setPlaying(true);
    }
  };

  const handleRestart = () => {
    const dir = getAudioDirector();
    dir.stopSpeech();
    lastSpokenSceneIdRef.current = null;
    setTimeSec(0);
    dir.setMuted(muted);
    setPlaying(true);
  };

  const handleSeek = (sec: number) => {
    const dir = getAudioDirector();
    dir.stopSpeech();
    lastSpokenSceneIdRef.current = null;
    setTimeSec(Math.max(0, Math.min(totalDurationSec, sec)));
  };

  const handleChangeVoice = (nextVoice: StudioVoiceId) => {
    setVoiceId(nextVoice);
    lastSpokenSceneIdRef.current = null;
    const dir = getAudioDirector();
    dir.stopSpeech();
    void dir.prefetchAll(nextVoice, plan.scenes).then((mode) => setVoiceMode(mode));
  };

  const handleToggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    getAudioDirector().setMuted(nextMuted);
  };

  const handleSelectCategory = (catId: VideoFormatCategory) => {
    setSelectedCategory(catId);
    const meta = VIDEO_CATEGORIES.find((c) => c.id === catId);
    if (meta) {
      setPrompt(meta.starterPrompt);
      const nextPlan = buildFallbackCreatedVideo(meta.starterPrompt, catId, params, metrics);
      setPlan(nextPlan);
      setRecordedBlob(null);
      setTimeSec(0);
      lastSpokenSceneIdRef.current = null;
      getAudioDirector().stopSpeech();
      setPlaying(false);
    }
  };

  const handleUpdateSceneNarration = (sceneIndex: number, text: string) => {
    setPlan((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc, i) => (i === sceneIndex ? { ...sc, narration: text } : sc)),
    }));
    lastSpokenSceneIdRef.current = null;
  };

  const handleToggleSceneLabels = (sceneIndex: number) => {
    setPlan((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc, i) =>
        i === sceneIndex ? { ...sc, showLiveLabels: !sc.showLiveLabels } : sc
      ),
    }));
  };

  const handleStartCapture = async (autoFmt?: ExportMediaFormat) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const targetRes: VideoResolutionId =
      autoFmt === 'mp4-regular'
        ? '480p'
        : autoFmt === 'mp4-4k'
          ? '2160p'
          : autoFmt === 'mp4-hd'
            ? '1080p'
            : resolution;
    setResolution(targetRes);
    pendingExportFmtRef.current = autoFmt || null;

    const dir = getAudioDirector();
    dir.stopSpeech();
    dir.setMuted(false);
    setMuted(false);
    setExportStatus('Preparing realistic studio voiceover...');
    const mode = await dir.prefetchAll(voiceId, plan.scenes);
    setVoiceMode(mode);
    setExportStatus(null);

    const recorder = startVideoCanvasRecorder(
      canvas,
      dir.getOutputMediaStream(),
      targetRes,
      () => liveCalloutsRef.current
    );
    recorderRef.current = recorder;
    lastSpokenSceneIdRef.current = null;
    setTimeSec(0);
    setRecording(true);
    setPlaying(true);
  };

  const handleStopCapture = () => {
    const activeRec = recorderRef.current;
    const fmt =
      pendingExportFmtRef.current ||
      (resolution === '480p' ? 'mp4-regular' : resolution === '2160p' ? 'mp4-4k' : 'mp4-hd');
    recorderRef.current = null;
    pendingExportFmtRef.current = null;
    setRecording(false);
    setPlaying(false);
    audioDirectorRef.current?.stopSpeech();
    if (!activeRec) return;

    setExportStatus(`Encoding ${fmt.toUpperCase()}...`);
    void activeRec
      .stop()
      .then(async (blob) => {
        setRecordedBlob(blob);
        const out = await transcodeMediaBlob(blob, fmt, params.serialNumber);
        triggerDownload(out.blob, out.filename);
      })
      .finally(() => setExportStatus(null));
  };

  const handleDownloadFormat = async (fmt: ExportMediaFormat) => {
    if (fmt === 'mp3') {
      try {
        setExportStatus('Rendering clean voiceover MP3 (192 kbps)...');
        const wavBlob = await getAudioDirector().renderVoiceoverOnlyWav(voiceId, plan.scenes);
        const out = await transcodeMediaBlob(wavBlob, 'mp3', params.serialNumber);
        triggerDownload(out.blob, out.filename);
      } finally {
        setExportStatus(null);
      }
      return;
    }

    if (recordedBlob) {
      try {
        setExportStatus(`Transcoding ${fmt.toUpperCase()}...`);
        const out = await transcodeMediaBlob(recordedBlob, fmt, params.serialNumber);
        triggerDownload(out.blob, out.filename);
      } finally {
        setExportStatus(null);
      }
      return;
    }

    await handleStartCapture(fmt);
  };

  const handleDownloadScript = () => {
    const lines = [
      `# ${plan.title}`,
      `Category: ${plan.category} | Serial: ${params.serialNumber} | Duration: ${totalDurationSec}s`,
      `Voiceover: ${voiceId} (Voiceover Only · No Music / No SFX)`,
      '',
      ...plan.scenes.map(
        (sc) =>
          `## ${sc.title} (${formatTimecode(sc.startSec)} - ${formatTimecode(sc.endSec)})\nShot: ${sc.shotLabel} (${sc.visualStyle})\nLive Component Labels: ${sc.showLiveLabels ? 'ON (#01–#12)' : 'OFF'}\n\n${sc.narration}\n`
      ),
    ].join('\n');
    triggerDownload(
      new Blob([lines], { type: 'text/markdown;charset=utf-8' }),
      `${params.serialNumber}-${plan.category}-script.md`
    );
  };

  const isBlueprintVisual =
    videoFrame.visualStyle === 'blueprint' || videoFrame.visualStyle === 'exploded-blueprint';
  const liveLabelsVisible = videoFrame.showCallouts;

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-[#06090F]">
      {/* Left/Center Live 16:9 3D Presentation Stage */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 p-3 lg:p-4 gap-3 overflow-y-auto lg:overflow-hidden">
        <div className="relative flex-1 min-h-[320px] rounded-xl overflow-hidden border border-[#1B2332] bg-[#03050A] shadow-2xl">
          <SlabViewport3D
            params={params}
            metrics={metrics}
            activeView="assembled"
            explodeMotion={explodeMotion}
            selectedComponent={videoFrame.highlightComponent}
            sectionEnabled={videoFrame.sectionEnabled}
            sectionOffsetMm={videoFrame.sectionOffsetMm}
            showCallouts={liveLabelsVisible}
            videoFrame={videoFrame}
            onCanvasReady={(c) => {
              canvasRef.current = c;
            }}
            onLiveCalloutsUpdate={(data) => {
              liveCalloutsRef.current = data;
            }}
            onSelectComponent={() => {
              // playback manages focus highlight
            }}
          />

          {/* CAD Blueprint Drafting Grid Overlay */}
          {isBlueprintVisual && (
            <div
              data-testid="video-blueprint-grid"
              className="pointer-events-none absolute inset-0 z-10"
            >
              <div
                className="absolute inset-3 border border-[#38BDF8]/35 rounded"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(56,189,248,0.065) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.065) 1px, transparent 1px)',
                  backgroundSize: '36px 36px',
                }}
              />
            </div>
          )}

          {/* Top-Left Editorial HUD Telemetry Card */}
          <div className="pointer-events-none absolute top-4 left-4 z-20 max-w-sm rounded-lg border border-[#1E3A5F] bg-[#05101E]/88 backdrop-blur-md px-3.5 py-2.5 space-y-1 shadow-xl">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#38BDF8]">
              <span className="font-bold">VCA · {params.serialNumber}</span>
              <span aria-hidden="true">·</span>
              <span>{videoFrame.segment.title.toUpperCase()}</span>
            </div>
            <div className="text-sm font-bold text-white tracking-tight">
              {videoFrame.segment.hudHeadline}
            </div>
            <div className="text-[11px] font-mono text-[#BAE6FD]">
              {videoFrame.segment.hudSubline}
            </div>
            <div className="pt-1 space-y-0.5 text-[10px] font-mono text-[#94A3B8]">
              {videoFrame.segment.hudMetrics.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>

          {/* Top-Right Status Badges */}
          <div className="pointer-events-none absolute top-4 right-4 z-20 flex flex-wrap items-center justify-end gap-1.5">
            {liveLabelsVisible && (
              <span className="px-2 py-1 rounded border border-[#38BDF8]/60 bg-[#05101E]/90 text-[10px] font-mono text-[#38BDF8] flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>LIVE LABELS #01–#12</span>
              </span>
            )}
            <span className="px-2 py-1 rounded border border-[#1E3A5F] bg-[#05101E]/90 text-[10px] font-mono text-[#CBD5E1]">
              {videoFrame.segment.shotLabel}
            </span>
            {recording && (
              <span className="px-2 py-1 rounded border border-rose-500/70 bg-rose-950/85 text-[10px] font-mono font-semibold text-rose-300">
                ● REC {formatTimecode(timeSec)}
              </span>
            )}
          </div>

          {/* Lower-Third Broadcast Narration Subtitle */}
          <div
            data-testid="video-subtitle"
            className="pointer-events-none absolute bottom-3 left-4 right-4 z-20 rounded-lg border border-[#1B2332] bg-[#0D121B]/92 backdrop-blur-md px-4 py-2.5 shadow-2xl"
          >
            <div className="h-0.5 w-full bg-[#1B2332] rounded overflow-hidden mb-2">
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${Math.round(videoFrame.progress * 100)}%`,
                  backgroundColor: videoFrame.accentHex,
                }}
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs sm:text-sm text-[#F1F5F9] leading-relaxed font-medium">
                “{videoFrame.segment.narration}”
              </p>
              <span className="text-[11px] font-mono text-[#94A3B8] whitespace-nowrap shrink-0 pt-0.5 tabular-nums">
                {formatTimecode(timeSec)} / {formatTimecode(totalDurationSec)}
              </span>
            </div>
          </div>
        </div>

        {/* Transport Controls & Scene Scrubber Bar */}
        <div className="shrink-0 rounded-xl border border-[#1B2332] bg-[#0D121B] px-3.5 py-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] text-white cursor-pointer"
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{playing ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Unmute Voiceover' : 'Mute Voiceover'}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white cursor-pointer"
              >
                {muted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                )}
                <span>{muted ? 'Muted' : 'Voice On'}</span>
              </button>
            </div>

            {/* Quick Scene Jump Pills */}
            <div className="flex flex-wrap items-center gap-1">
              {plan.scenes.map((sc, idx) => {
                const isActive = videoFrame.sceneIndex === idx;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => handleSeek(sc.startSec)}
                    className={`px-2 py-1 text-[11px] font-mono rounded border cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#0EA5E9]/20 border-[#38BDF8] text-white'
                        : 'bg-[#11161F] border-[#1B2332] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    S{sc.index}
                  </button>
                );
              })}
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={totalDurationSec}
            step={0.1}
            value={timeSec}
            aria-label="Presentation timeline scrubber"
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full vca-slider"
          />
        </div>
      </div>

      {/* Right Studio Console: Create Video Text Box, Categories, Realistic Voiceover & Export */}
      <aside className="w-full lg:w-[430px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#1B2332] bg-[#0D121B] flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Create Video Text Box */}
        <section aria-labelledby="create-video-heading" className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-[#38BDF8]" />
              <h1 id="create-video-heading" className="text-sm font-bold text-white">
                Create Video
              </h1>
            </div>
            <span className="text-[10px] font-mono text-[#38BDF8]">
              {plan.generatedBy === 'gemini' ? 'GEMINI DIRECTOR' : 'VCA DIRECTOR'}
            </span>
          </div>

          {/* 4 Format Category Selectors */}
          <div
            role="tablist"
            aria-label="Video Presentation Category"
            className="grid grid-cols-2 gap-1.5"
          >
            {VIDEO_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0EA5E9]/20 border-[#38BDF8] text-white'
                      : 'bg-[#11161F] border-[#1B2332] text-[#94A3B8] hover:text-white hover:border-[#2B374F]'
                  }`}
                  title={cat.description}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateVideo();
            }}
            className="space-y-2"
          >
            <label htmlFor="create-video-prompt" className="block text-[11px] text-[#94A3B8]">
              Describe your VCA presentation, pitch deck, advertisement, or exploded blueprint video:
            </label>
            <textarea
              id="create-video-prompt"
              aria-label="Create Video prompt"
              rows={3}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="e.g. Create a prototype blueprint explainer video with exploded slab view, live #01–#12 indexing labels, cross-section slice, and NFC bay orbit..."
              className="w-full rounded-lg border border-[#1B2332] focus:border-[#0EA5E9] bg-[#11161F] px-3 py-2 text-xs text-white placeholder-[#64748B] outline-none resize-y"
            />
            {errorMsg && (
              <p role="alert" className="text-[11px] text-rose-400 font-medium">
                {errorMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-60 text-xs font-semibold text-white cursor-pointer transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Directing Camera Shots & Voiceover...</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  <span>Create Video</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Realistic Voiceover Only Control (Zero Music / Zero SFX) */}
        <section className="pt-3 border-t border-[#1B2332] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Mic className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Realistic Studio Voiceover</span>
            </div>
            <span
              data-testid="voiceover-only-badge"
              className="px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-950/40 text-[10px] font-mono text-emerald-300"
            >
              Voiceover Only · No Music / SFX
            </span>
          </div>

          <select
            aria-label="Realistic studio voiceover"
            value={voiceId}
            onChange={(e) => handleChangeVoice(e.target.value as StudioVoiceId)}
            className="w-full rounded-md border border-[#1B2332] bg-[#11161F] px-2.5 py-1.5 text-xs text-white focus:border-[#0EA5E9] outline-none"
          >
            {STUDIO_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-[#94A3B8]">
            {voiceMode === 'gemini'
              ? 'Gemini HD studio voiceover active · Clean narration track without music or SFX.'
              : 'Studio narration ready · Plays realistic speech synthesis when previewing.'}
          </p>
        </section>

        {/* Active Storyboard & Live Scene Editor */}
        <section className="pt-3 border-t border-[#1B2332] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Layers className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>{plan.title}</span>
            </div>
            <span className="text-[10px] font-mono text-[#94A3B8]">
              {plan.scenes.length} Scenes · {totalDurationSec}s
            </span>
          </div>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">{plan.creativeSummary}</p>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {plan.scenes.map((sc, idx) => {
              const isCurrent = videoFrame.sceneIndex === idx;
              return (
                <div
                  key={sc.id}
                  className={`rounded-lg border p-2.5 space-y-1.5 transition-colors ${
                    isCurrent
                      ? 'border-[#0EA5E9] bg-[#0B1728]'
                      : 'border-[#1B2332] bg-[#11161F]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSeek(sc.startSec)}
                      className="text-left text-xs font-semibold text-white hover:text-[#38BDF8] cursor-pointer"
                    >
                      {sc.title}
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSceneLabels(idx)}
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded border cursor-pointer ${
                          sc.showLiveLabels
                            ? 'border-[#38BDF8]/70 bg-[#0EA5E9]/20 text-[#38BDF8]'
                            : 'border-[#1B2332] text-[#64748B] hover:text-white'
                        }`}
                      >
                        {sc.showLiveLabels ? 'Labels On' : 'Labels Off'}
                      </button>
                      <span className="text-[10px] font-mono text-[#64748B]">
                        {sc.durationSec}s
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-[#38BDF8]">
                    {sc.shotLabel} · {sc.visualStyle}
                  </div>
                  <textarea
                    rows={2}
                    aria-label={`${sc.title} narration script`}
                    value={sc.narration}
                    onChange={(e) => handleUpdateSceneNarration(idx, e.target.value)}
                    className="w-full rounded border border-[#1B2332] focus:border-[#0EA5E9] bg-[#090C11] px-2 py-1 text-[11px] text-[#E2E8F0] outline-none resize-y"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Export & Download Video / Voiceover */}
        <section className="pt-3 border-t border-[#1B2332] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Export Video & Voiceover</span>
            </div>
            <select
              aria-label="Export resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as VideoResolutionId)}
              className="rounded border border-[#1B2332] bg-[#11161F] px-2 py-0.5 text-[11px] text-[#CBD5E1] outline-none"
            >
              {Object.values(VIDEO_RESOLUTIONS).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {exportStatus && (
            <div className="flex items-center gap-2 rounded border border-[#0EA5E9]/50 bg-[#0EA5E9]/10 px-2.5 py-1.5 text-[11px] text-[#7DD3FC]">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>{exportStatus}</span>
            </div>
          )}

          {recordedBlob && !exportStatus && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Master take captured — download in MP4 HD, Regular, or 4K below.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {recording ? (
              <button
                type="button"
                onClick={handleStopCapture}
                className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                <span>Stop & Save Recording ({formatTimecode(timeSec)})</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={Boolean(exportStatus)}
                  onClick={() => void handleDownloadFormat('mp4-hd')}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-60 text-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>HD MP4 (1080p)</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(exportStatus)}
                  onClick={() => void handleDownloadFormat('mp4-regular')}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>Regular MP4 (480p)</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(exportStatus)}
                  onClick={() => void handleDownloadFormat('mp4-4k')}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>4K UHD MP4</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(exportStatus)}
                  onClick={() => void handleDownloadFormat('mp3')}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>Voiceover (.mp3)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadScript}
                  className="col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1] cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>Download Production Script (.md)</span>
                </button>
              </>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
};
