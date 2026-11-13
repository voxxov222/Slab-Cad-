import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValue } from 'motion/react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Maximize2,
  Mic,
  Minimize2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { EngineeringMetrics } from '../cad/engineeringMath';
import {
  CameraMotionPreset,
  DEFAULT_FILM_SCENES,
  FilmFrameState,
  FilmScene,
  MaleVoiceId,
  QC_CHECK_ITEMS,
  QcCheckKey,
  TransitionType,
  VIDEO_RESOLUTIONS,
  VideoResolutionId,
  evaluateFilmFrame,
  formatTimecode,
  getTotalFilmDuration,
  isSceneQcReadyForApproval,
  recalculateSceneBounds,
} from '../cad/filmProduction';
import {
  DEFAULT_MIXER_STATE,
  FilmSoundEngine,
  MixerState,
  TrackId,
  VoiceClipAsset,
} from '../cad/soundEngine';
import { SlabParameters } from '../cad/types';
import { VideoExportHandle, startFilmVideoExport } from '../cad/videoExporter';
import { SlabViewport3D } from './SlabViewport3D';

interface FilmStudioViewProps {
  params: SlabParameters;
  metrics: EngineeringMetrics;
}

type InspectorTab = 'camera' | 'audio' | 'qc';

const CAMERA_PRESETS: { id: CameraMotionPreset; label: string }[] = [
  { id: 'low-angle-hero', label: 'Low-Angle Hero' },
  { id: 'hero-dolly', label: 'Hero Dolly' },
  { id: 'orbital-arc', label: 'Orbital Arc' },
  { id: 'orbit-360', label: '360° Turntable' },
  { id: 'macro-focus-pull', label: 'Macro Focus Pull' },
  { id: 'overhead-track', label: 'Overhead Track' },
];

export const FilmStudioView: React.FC<FilmStudioViewProps> = ({ params, metrics }) => {
  const [scenes, setScenes] = useState<FilmScene[]>(DEFAULT_FILM_SCENES);
  const [timeSec, setTimeSec] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [loopScene, setLoopScene] = useState<boolean>(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string>(DEFAULT_FILM_SCENES[0].id);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('camera');
  const [safeGuides, setSafeGuides] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Audio / Voiceover State
  const [mixer, setMixer] = useState<MixerState>(DEFAULT_MIXER_STATE);
  const [autoDucking, setAutoDucking] = useState<boolean>(true);
  const [maleVoice, setMaleVoice] = useState<MaleVoiceId>('Charon');
  const [voAssets, setVoAssets] = useState<Record<string, VoiceClipAsset>>({});
  const [customMusicLabel, setCustomMusicLabel] = useState<string | null>(null);
  const [voStatusMsg, setVoStatusMsg] = useState<string>(
    'Upload a human voice recording (.wav/.mp3) per scene or generate a neural studio take.'
  );
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [micRecordingSceneId, setMicRecordingSceneId] = useState<string | null>(null);

  // Render / Export State
  const [resolution, setResolution] = useState<VideoResolutionId>('1080p');
  const [renderingMode, setRenderingMode] = useState<'none' | 'scene' | 'full'>('none');
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [renderedFileName, setRenderedFileName] = useState<string>('VCA-Launch-Film.webm');

  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundEngineRef = useRef<FilmSoundEngine | null>(null);
  const exporterRef = useRef<VideoExportHandle | null>(null);
  const renderEndSecRef = useRef<number | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const activeVoFileInputRef = useRef<HTMLInputElement | null>(null);
  const musicFileInputRef = useRef<HTMLInputElement | null>(null);

  const lastTriggeredSceneRef = useRef<string | null>(null);
  const triggeredSfxRef = useRef<Set<string>>(new Set());
  const prevTimeRef = useRef<number>(0);

  const explodeMotion = useMotionValue(0);

  const getSoundEngine = (): FilmSoundEngine => {
    if (!soundEngineRef.current) {
      soundEngineRef.current = new FilmSoundEngine();
    }
    return soundEngineRef.current;
  };

  useEffect(() => {
    return () => {
      soundEngineRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (renderedVideoUrl) URL.revokeObjectURL(renderedVideoUrl);
    };
  }, [renderedVideoUrl]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    soundEngineRef.current?.setMixer(mixer, autoDucking);
  }, [mixer, autoDucking]);

  const totalDuration = useMemo(() => getTotalFilmDuration(scenes), [scenes]);
  const frame: FilmFrameState = useMemo(
    () => evaluateFilmFrame(timeSec, scenes),
    [timeSec, scenes]
  );

  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedSceneId) || frame.scene,
    [scenes, selectedSceneId, frame.scene]
  );

  const approvedCount = useMemo(
    () => scenes.filter((s) => s.qc.decision === 'approved').length,
    [scenes]
  );

  useEffect(() => {
    if (exporterRef.current) {
      exporterRef.current.updateFrame(frame, params.serialNumber);
    }
  }, [frame, params.serialNumber]);

  const finishVideoRender = async (fileName: string) => {
    const handle = exporterRef.current;
    exporterRef.current = null;
    renderEndSecRef.current = null;
    setRenderingMode('none');
    setPlaying(false);
    soundEngineRef.current?.stopVoice();
    soundEngineRef.current?.stopMusic();
    if (!handle) return;
    const blob = await handle.stop();
    if (renderedVideoUrl) URL.revokeObjectURL(renderedVideoUrl);
    const url = URL.createObjectURL(blob);
    setRenderedVideoUrl(url);
    setRenderedFileName(fileName);
  };

  // Master playback loop
  useEffect(() => {
    if (!playing) return;
    let rafId = 0;
    let lastNow = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.2, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;

      setTimeSec((curr) => {
        const next = curr + dt;
        const renderLimit = renderEndSecRef.current;

        if (renderLimit !== null && next >= renderLimit) {
          const targetName =
            renderingMode === 'scene'
              ? `${params.serialNumber}-Scene-0${selectedScene.index}-${resolution}.webm`
              : `${params.serialNumber}-Launch-Film-${resolution}.webm`;
          void finishVideoRender(targetName);
          return renderLimit;
        }

        if (loopScene && renderingMode === 'none') {
          if (next >= selectedScene.endSec) {
            triggeredSfxRef.current.clear();
            lastTriggeredSceneRef.current = null;
            return selectedScene.startSec;
          }
          return next;
        }

        if (next >= totalDuration) {
          setPlaying(false);
          soundEngineRef.current?.stopVoice();
          soundEngineRef.current?.stopMusic();
          return totalDuration;
        }
        return next;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    playing,
    loopScene,
    selectedScene,
    totalDuration,
    renderingMode,
    params.serialNumber,
    resolution,
  ]);

  // Frame-accurate audio cue & voiceover synchronization
  useEffect(() => {
    if (!playing) {
      prevTimeRef.current = timeSec;
      return;
    }

    const eng = getSoundEngine();
    const activeScene = frame.scene;
    eng.modulateMusicEnergy(activeScene.musicEnergy);

    if (lastTriggeredSceneRef.current !== activeScene.id) {
      lastTriggeredSceneRef.current = activeScene.id;
      const offsetInScene = Math.max(0, timeSec - activeScene.startSec);
      eng.playVoiceForScene(activeScene.id, offsetInScene);
    }

    const prevLocal = Math.max(0, prevTimeRef.current - activeScene.startSec);
    const currLocal = Math.max(0, timeSec - activeScene.startSec);

    for (const cue of activeScene.sfxCues) {
      const cueKey = `${activeScene.id}:${cue.id}`;
      if (
        !triggeredSfxRef.current.has(cueKey) &&
        currLocal >= cue.offsetSec &&
        prevLocal <= cue.offsetSec + 0.35
      ) {
        triggeredSfxRef.current.add(cueKey);
        eng.playSfxCue(cue.type);
      }
    }

    prevTimeRef.current = timeSec;
  }, [playing, timeSec, frame.scene]);

  const handlePlayPause = () => {
    const eng = getSoundEngine();
    if (playing) {
      setPlaying(false);
      eng.stopVoice();
      eng.stopMusic();
      return;
    }
    let startAt = timeSec;
    if (loopScene && (timeSec < selectedScene.startSec || timeSec >= selectedScene.endSec)) {
      startAt = selectedScene.startSec;
      setTimeSec(startAt);
    } else if (timeSec >= totalDuration) {
      startAt = 0;
      setTimeSec(0);
    }
    triggeredSfxRef.current.clear();
    lastTriggeredSceneRef.current = null;
    prevTimeRef.current = startAt;
    eng.startMusic(startAt, frame.scene.musicEnergy);
    setPlaying(true);
  };

  const handleSeek = (sec: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, sec));
    triggeredSfxRef.current.clear();
    lastTriggeredSceneRef.current = null;
    prevTimeRef.current = clamped;
    setTimeSec(clamped);
    const targetFrame = evaluateFilmFrame(clamped, scenes);
    setSelectedSceneId(targetFrame.scene.id);
    if (playing) {
      const eng = getSoundEngine();
      eng.stopVoice();
      eng.modulateMusicEnergy(targetFrame.scene.musicEnergy);
    }
  };

  const handleSelectScene = (scene: FilmScene, jumpToStart = true) => {
    setSelectedSceneId(scene.id);
    if (jumpToStart) {
      handleSeek(scene.startSec);
    }
  };

  const handlePreviewSelectedScene = () => {
    setLoopScene(true);
    triggeredSfxRef.current.clear();
    lastTriggeredSceneRef.current = null;
    prevTimeRef.current = selectedScene.startSec;
    setTimeSec(selectedScene.startSec);
    const eng = getSoundEngine();
    eng.startMusic(selectedScene.startSec, selectedScene.musicEnergy);
    setPlaying(true);
  };

  const handleStartRender = (mode: 'scene' | 'full') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (renderedVideoUrl) {
      URL.revokeObjectURL(renderedVideoUrl);
      setRenderedVideoUrl(null);
    }

    const startAt = mode === 'scene' ? selectedScene.startSec : 0;
    const endAt = mode === 'scene' ? selectedScene.endSec : totalDuration;

    const eng = getSoundEngine();
    eng.stopVoice();
    eng.startMusic(startAt, evaluateFilmFrame(startAt, scenes).scene.musicEnergy);

    const exporter = startFilmVideoExport(canvas, eng.getOutputMediaStream(), resolution);
    exporterRef.current = exporter;
    renderEndSecRef.current = endAt;
    triggeredSfxRef.current.clear();
    lastTriggeredSceneRef.current = null;
    prevTimeRef.current = startAt;
    setTimeSec(startAt);
    setRenderingMode(mode);
    setPlaying(true);
  };

  const handleStopRender = () => {
    const name =
      renderingMode === 'scene'
        ? `${params.serialNumber}-Scene-0${selectedScene.index}-${resolution}.webm`
        : `${params.serialNumber}-Launch-Film-${resolution}.webm`;
    void finishVideoRender(name);
  };

  const handleToggleFullscreen = async () => {
    const el = stageContainerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  };

  const updateSelectedScene = (updater: (scene: FilmScene) => FilmScene) => {
    setScenes((prev) =>
      recalculateSceneBounds(prev.map((s) => (s.id === selectedScene.id ? updater(s) : s)))
    );
  };

  const handleUploadSceneVoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const clip = await getSoundEngine().importSceneVoiceFile(selectedScene.id, file);
      setVoAssets((prev) => ({ ...prev, [selectedScene.id]: clip }));
      setVoStatusMsg(
        `Loaded human recording "${clip.label}" (${clip.durationSec.toFixed(1)}s) on ${selectedScene.shortTitle}.`
      );
    } catch {
      setVoStatusMsg('Could not decode audio file. Please use WAV, MP3, M4A, or WebM audio.');
    }
  };

  const handleToggleMicRecord = async () => {
    if (micRecordingSceneId) {
      micRecorderRef.current?.stop();
      micRecorderRef.current = null;
      setMicRecordingSceneId(null);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoStatusMsg(
        'Microphone capture unavailable in this browser context. Upload a .wav or .mp3 recording instead.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      const targetScene = selectedScene;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const file = new File([blob], `${targetScene.shortTitle.replace(/\s+/g, '-')}-take.webm`, {
          type: blob.type,
        });
        const clip = await getSoundEngine().importSceneVoiceFile(targetScene.id, file);
        setVoAssets((prev) => ({ ...prev, [targetScene.id]: clip }));
        setVoStatusMsg(`Recorded mic take (${clip.durationSec.toFixed(1)}s) on ${targetScene.shortTitle}.`);
      };
      micRecorderRef.current = rec;
      setMicRecordingSceneId(targetScene.id);
      rec.start();
      setVoStatusMsg(`Recording studio take for ${targetScene.shortTitle}... click Stop Take when finished.`);
    } catch {
      setVoStatusMsg(
        'Microphone permission denied or no mic device detected. Upload a .wav/.mp3 recording.'
      );
    }
  };

  const handleGenerateNeuralVoice = async (scene: FilmScene) => {
    setGeneratingSceneId(scene.id);
    setVoStatusMsg(`Generating neural studio take (${maleVoice}) for ${scene.shortTitle}...`);
    const res = await getSoundEngine().generateNeuralVoiceForScene(
      scene.id,
      scene.narration,
      maleVoice
    );
    setGeneratingSceneId(null);
    if (res.ok && res.clip) {
      setVoAssets((prev) => ({ ...prev, [scene.id]: res.clip! }));
      setVoStatusMsg(
        `Neural take ready (${res.clip.durationSec.toFixed(1)}s) — inspect waveform & verify human quality in QC.`
      );
    } else {
      setVoStatusMsg(
        res.reason ||
          'Neural TTS unavailable. Please upload a real human voiceover recording (.wav/.mp3).'
      );
    }
  };

  const handleUploadCustomMusic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const music = await getSoundEngine().importCustomMusicFile(file);
      setCustomMusicLabel(`${music.label} (${music.durationSec.toFixed(1)}s)`);
    } catch {
      setVoStatusMsg('Could not decode music track audio file.');
    }
  };

  const handleExportCueSheet = () => {
    const lines = [
      `# VCA Commercial Film — Voiceover & Production Cue Sheet`,
      `Serial: ${params.serialNumber} | Total Runtime: ${formatTimecode(totalDuration)}`,
      '',
      ...scenes.map(
        (s) =>
          `## ${s.title} [${formatTimecode(s.startSec)} – ${formatTimecode(s.endSec)}] (${s.durationSec}s)\n- Camera: ${s.cameraPreset} — ${s.shotDescription}\n- Narration: "${s.narration}"\n- SFX Cues: ${s.sfxCues.map((c) => `${c.offsetSec}s ${c.label}`).join(', ') || 'None'}\n- QC: ${s.qc.decision.toUpperCase()}\n`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${params.serialNumber}-Production-Cue-Sheet.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSetTrackGain = (track: TrackId, gain: number) => {
    setMixer((prev) => ({ ...prev, [track]: { ...prev[track], gain } }));
  };

  const handleToggleTrackFlag = (track: TrackId, flag: 'muted' | 'solo') => {
    setMixer((prev) => ({
      ...prev,
      [track]: { ...prev[track], [flag]: !prev[track][flag] },
    }));
  };

  const selectedSceneIndex = scenes.findIndex((s) => s.id === selectedScene.id);
  const selectedVoClip = voAssets[selectedScene.id] || null;
  const qcReadyToApprove = isSceneQcReadyForApproval(selectedScene.qc);

  return (
    <div
      ref={stageContainerRef}
      className={`flex-1 flex flex-col min-h-0 overflow-hidden bg-[#06080D] ${
        isFullscreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* Top Studio Transport & Export Toolbar */}
      <div className="h-12 shrink-0 border-b border-[#1B2332] bg-[#0B0F17] px-4 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePlayPause}
            aria-label={playing ? 'Pause Film' : 'Play Film'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#0EA5E9] hover:bg-[#0284C7] text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{playing ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const prevIdx = Math.max(0, selectedSceneIndex - 1);
              handleSelectScene(scenes[prevIdx]);
            }}
            aria-label="Previous Scene"
            className="p-1.5 rounded border border-[#1B2332] bg-[#11161F] text-[#CBD5E1] hover:border-[#38BDF8] hover:text-white cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              const nextIdx = Math.min(scenes.length - 1, selectedSceneIndex + 1);
              handleSelectScene(scenes[nextIdx]);
            }}
            aria-label="Next Scene"
            className="p-1.5 rounded border border-[#1B2332] bg-[#11161F] text-[#CBD5E1] hover:border-[#38BDF8] hover:text-white cursor-pointer shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setLoopScene((v) => !v)}
            aria-pressed={loopScene}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border whitespace-nowrap shrink-0 cursor-pointer ${
              loopScene
                ? 'border-[#0EA5E9] bg-[#0EA5E9]/15 text-[#38BDF8]'
                : 'border-[#1B2332] bg-[#11161F] text-[#94A3B8] hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Loop Scene</span>
          </button>

          <div className="pl-2 font-mono text-xs text-white tabular-nums whitespace-nowrap">
            {formatTimecode(timeSec, true)} <span className="text-[#475569]">/</span>{' '}
            <span className="text-[#94A3B8]">{formatTimecode(totalDuration, true)}</span>
          </div>

          <span className="hidden xl:inline text-xs text-[#64748B] pl-2 whitespace-nowrap">
            QC: <span className="text-[#CBD5E1] tabular-nums">{approvedCount}/{scenes.length}</span>{' '}
            Approved
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSafeGuides((v) => !v)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded border whitespace-nowrap shrink-0 cursor-pointer ${
              safeGuides
                ? 'border-[#0EA5E9] text-[#38BDF8] bg-[#0EA5E9]/10'
                : 'border-[#1B2332] text-[#94A3B8] hover:text-white bg-[#11161F]'
            }`}
          >
            Safe Frame
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            aria-label={isFullscreen ? 'Exit Fullscreen Preview' : 'Fullscreen Preview'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <select
            aria-label="Export Resolution"
            value={resolution}
            disabled={renderingMode !== 'none'}
            onChange={(e) => setResolution(e.target.value as VideoResolutionId)}
            className="bg-[#11161F] border border-[#1B2332] rounded px-2.5 py-1.5 text-xs font-mono text-[#CBD5E1] outline-none focus:border-[#0EA5E9]"
          >
            <option value="2160p">4K 3840×2160</option>
            <option value="1080p">FHD 1920×1080</option>
            <option value="720p">HD 1280×720</option>
          </select>

          {renderingMode !== 'none' ? (
            <button
              type="button"
              onClick={handleStopRender}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-700 text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Render ({formatTimecode(timeSec)})</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleStartRender('scene')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Render Scene 0{selectedScene.index}</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartRender('full')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#0EA5E9] hover:bg-[#0284C7] text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Export Full Film</span>
              </button>
            </>
          )}

          {renderedVideoUrl && renderingMode === 'none' && (
            <a
              href={renderedVideoUrl}
              download={renderedFileName}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .webm</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Split: 16:9 Cinema Monitor + Right Production Inspector */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left/Center 16:9 Program Monitor */}
        <div className="flex-1 min-w-0 bg-[#04060A] flex items-center justify-center p-4 overflow-hidden">
          <div className="relative w-full h-full max-w-full max-h-full aspect-video bg-[#06080D] border border-[#1B2332] overflow-hidden shadow-2xl">
            <SlabViewport3D
              params={params}
              metrics={metrics}
              activeView="assembled"
              explodeMotion={explodeMotion}
              selectedComponent={null}
              sectionEnabled={false}
              sectionOffsetMm={0}
              showCallouts={false}
              filmFrame={frame}
              onCanvasReady={(c) => {
                canvasRef.current = c;
              }}
              onSelectComponent={() => {}}
            />

            {/* Editorial Opening / Finale Brand Typography (Matches Exported Video) */}
            {frame.scene.showTitleOverlay === 'opening' && (
              <div className="pointer-events-none absolute top-7 left-8 z-10 space-y-0.5">
                <div className="text-3xl font-bold tracking-tight text-white">VCA</div>
                <div className="text-[11px] font-mono tracking-[0.22em] text-[#38BDF8]">
                  VERIFIED CARD AUTHORITY
                </div>
              </div>
            )}

            {frame.scene.showTitleOverlay === 'finale' && (
              <div className="pointer-events-none absolute top-1/3 left-8 z-10 space-y-1 max-w-sm">
                <div className="text-4xl font-bold tracking-tight text-white">VCA</div>
                <div className="text-xs font-mono tracking-[0.22em] text-[#38BDF8]">
                  VERIFIED CARD AUTHORITY
                </div>
                <div className="text-sm text-[#CBD5E1] pt-1">
                  Trust what you collect. · vcaslabs.com
                </div>
              </div>
            )}

            {/* 16:9 Broadcast Action Safe & Center Crosshair Guides */}
            {safeGuides && (
              <div className="pointer-events-none absolute inset-0 z-10">
                <div className="absolute inset-[5%] border border-dashed border-[#38BDF8]/35" />
                <div className="absolute inset-[10%] border border-dotted border-white/20" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 border border-[#38BDF8]/40 rounded-full" />
              </div>
            )}

            {/* Dip-to-Black / Fade-Out Envelope (shows lit Hero frame when paused at 00:00.0) */}
            {frame.videoOpacity < 0.999 &&
              (playing || renderingMode !== 'none' || timeSec > 0.05) && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[#030508] z-20"
                  style={{ opacity: 1 - frame.videoOpacity }}
                />
              )}
          </div>
        </div>

        {/* Right Production Inspector (Hidden automatically in Fullscreen Mode) */}
        {!isFullscreen && (
          <aside className="w-[390px] shrink-0 border-l border-[#1B2332] bg-[#0B0F17] flex flex-col min-h-0 overflow-hidden">
            {/* Inspector Tabs */}
            <div className="grid grid-cols-3 border-b border-[#1B2332] bg-[#090C11] shrink-0">
              {(
                [
                  { id: 'camera', label: 'Scene & Camera' },
                  { id: 'audio', label: 'Voice & Mix' },
                  { id: 'qc', label: 'Quality Control' },
                ] as { id: InspectorTab; label: string }[]
              ).map((tab) => {
                const active = inspectorTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInspectorTab(tab.id)}
                    className={`py-2.5 px-2 text-xs font-medium border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? 'text-white border-[#0EA5E9] bg-[#0D131F]'
                        : 'text-[#94A3B8] border-transparent hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Inspector Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Selected Scene Summary Header */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#1B2332]">
                <div>
                  <h2 className="text-sm font-semibold text-white">{selectedScene.title}</h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5 leading-snug">
                    {selectedScene.shotDescription}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePreviewSelectedScene}
                  className="px-2.5 py-1 text-[11px] font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#0EA5E9] text-[#38BDF8] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Preview Shot
                </button>
              </div>

              {inspectorTab === 'camera' && (
                <div className="space-y-4">
                  {/* Timing & Transition Controls */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-xs">
                      <span className="block text-[#94A3B8]">Duration (sec)</span>
                      <input
                        type="number"
                        min={3}
                        max={30}
                        step={0.5}
                        value={selectedScene.durationSec}
                        onChange={(e) => {
                          const val = Math.max(3, Math.min(30, parseFloat(e.target.value) || 8));
                          updateSelectedScene((s) => ({ ...s, durationSec: val }));
                        }}
                        className="w-full bg-[#11161F] border border-[#1B2332] rounded px-2.5 py-1.5 text-xs font-mono text-white outline-none focus:border-[#0EA5E9]"
                      />
                    </label>

                    <label className="space-y-1 text-xs">
                      <span className="block text-[#94A3B8]">Transition In</span>
                      <select
                        value={selectedScene.transitionIn}
                        onChange={(e) =>
                          updateSelectedScene((s) => ({
                            ...s,
                            transitionIn: e.target.value as TransitionType,
                          }))
                        }
                        className="w-full bg-[#11161F] border border-[#1B2332] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#0EA5E9]"
                      >
                        <option value="cut">Hard Cut</option>
                        <option value="crossfade">Smooth Crossfade</option>
                        <option value="dip-to-black">Dip to Black</option>
                      </select>
                    </label>
                  </div>

                  {/* Camera Motion Preset & Transition Duration */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-xs">
                      <span className="block text-[#94A3B8]">Camera Choreography</span>
                      <select
                        value={selectedScene.cameraPreset}
                        onChange={(e) =>
                          updateSelectedScene((s) => ({
                            ...s,
                            cameraPreset: e.target.value as CameraMotionPreset,
                          }))
                        }
                        className="w-full bg-[#11161F] border border-[#1B2332] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#0EA5E9]"
                      >
                        {CAMERA_PRESETS.map((cp) => (
                          <option key={cp.id} value={cp.id}>
                            {cp.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs">
                      <span className="block text-[#94A3B8]">Transition (sec)</span>
                      <input
                        type="number"
                        min={0.2}
                        max={2.0}
                        step={0.1}
                        value={selectedScene.transitionSec}
                        onChange={(e) => {
                          const v = Math.max(0.2, Math.min(2.0, parseFloat(e.target.value) || 0.5));
                          updateSelectedScene((s) => ({ ...s, transitionSec: v }));
                        }}
                        className="w-full bg-[#11161F] border border-[#1B2332] rounded px-2.5 py-1.5 text-xs font-mono text-white outline-none focus:border-[#0EA5E9]"
                      />
                    </label>
                  </div>

                  {/* Keyframe Camera Path Editor (Start / Mid / End) */}
                  <div className="pt-2 border-t border-[#1B2332] space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-white">
                        Camera Path Keyframes (mm & FOV)
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          const def = DEFAULT_FILM_SCENES.find((d) => d.id === selectedScene.id);
                          if (!def) return;
                          updateSelectedScene((s) => ({
                            ...s,
                            keyframes: structuredClone(def.keyframes),
                            cameraPreset: def.cameraPreset,
                            durationSec: def.durationSec,
                          }));
                        }}
                        className="flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-white cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Shot</span>
                      </button>
                    </div>

                    {(['Start', 'Mid', 'End'] as const).map((kfLabel, kfIdx) => {
                      const kf = selectedScene.keyframes[kfIdx];
                      return (
                        <div
                          key={kfLabel}
                          className="p-2.5 rounded border border-[#1B2332] bg-[#11161F] space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-[#38BDF8]">
                              {kfLabel} Keyframe
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const t =
                                  selectedScene.startSec +
                                  selectedScene.durationSec * (kfIdx === 0 ? 0 : kfIdx === 1 ? 0.5 : 0.96);
                                handleSeek(t);
                              }}
                              className="text-[10px] font-mono text-[#94A3B8] hover:text-white cursor-pointer"
                            >
                              Jump to {kfLabel}
                            </button>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                            {(['X', 'Y', 'Z'] as const).map((axis, axIdx) => (
                              <label key={axis} className="space-y-0.5">
                                <span className="block text-[10px] text-[#64748B]">Cam {axis}</span>
                                <input
                                  type="number"
                                  step={4}
                                  value={Math.round(kf.cameraPos[axIdx])}
                                  onChange={(e) => {
                                    const num = parseFloat(e.target.value) || 0;
                                    updateSelectedScene((s) => {
                                      const nextKfs = structuredClone(s.keyframes);
                                      nextKfs[kfIdx].cameraPos[axIdx] = num;
                                      return { ...s, keyframes: nextKfs };
                                    });
                                  }}
                                  className="w-full bg-[#090C11] border border-[#1B2332] rounded px-1.5 py-1 font-mono text-white tabular-nums"
                                />
                              </label>
                            ))}
                            <label className="space-y-0.5">
                              <span className="block text-[10px] text-[#64748B]">FOV °</span>
                              <input
                                type="number"
                                min={16}
                                max={58}
                                step={1}
                                value={Math.round(kf.fov)}
                                onChange={(e) => {
                                  const num = Math.max(16, Math.min(58, parseFloat(e.target.value) || 30));
                                  updateSelectedScene((s) => {
                                    const nextKfs = structuredClone(s.keyframes);
                                    nextKfs[kfIdx].fov = num;
                                    return { ...s, keyframes: nextKfs };
                                  });
                                }}
                                className="w-full bg-[#090C11] border border-[#1B2332] rounded px-1.5 py-1 font-mono text-white tabular-nums"
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                            {(['X', 'Y', 'Z'] as const).map((axis, axIdx) => (
                              <label key={axis} className="space-y-0.5">
                                <span className="block text-[10px] text-[#64748B]">Aim {axis}</span>
                                <input
                                  type="number"
                                  step={2}
                                  value={Math.round(kf.target[axIdx])}
                                  onChange={(e) => {
                                    const num = parseFloat(e.target.value) || 0;
                                    updateSelectedScene((s) => {
                                      const nextKfs = structuredClone(s.keyframes);
                                      nextKfs[kfIdx].target[axIdx] = num;
                                      return { ...s, keyframes: nextKfs };
                                    });
                                  }}
                                  className="w-full bg-[#090C11] border border-[#1B2332] rounded px-1.5 py-1 font-mono text-white tabular-nums"
                                />
                              </label>
                            ))}
                            <label className="space-y-0.5">
                              <span className="block text-[10px] text-[#64748B]">Focus mm</span>
                              <input
                                type="number"
                                min={40}
                                max={400}
                                step={5}
                                value={Math.round(kf.focusDistanceMm)}
                                onChange={(e) => {
                                  const num = Math.max(
                                    40,
                                    Math.min(400, parseFloat(e.target.value) || 180)
                                  );
                                  updateSelectedScene((s) => {
                                    const nextKfs = structuredClone(s.keyframes);
                                    nextKfs[kfIdx].focusDistanceMm = num;
                                    return { ...s, keyframes: nextKfs };
                                  });
                                }}
                                className="w-full bg-[#090C11] border border-[#1B2332] rounded px-1.5 py-1 font-mono text-white tabular-nums"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {inspectorTab === 'audio' && (
                <div className="space-y-4">
                  {/* Human Voiceover Upload & Studio Narration Controls */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-white">
                        Scene {selectedScene.index} Voiceover Track
                      </h3>
                      <button
                        type="button"
                        onClick={handleExportCueSheet}
                        className="text-[11px] text-[#38BDF8] hover:underline cursor-pointer"
                      >
                        Export Cue Sheet (.md)
                      </button>
                    </div>

                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">{voStatusMsg}</p>

                    <input
                      ref={activeVoFileInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={handleUploadSceneVoice}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => activeVoFileInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded border border-[#38BDF8]/50 bg-[#0EA5E9]/10 hover:bg-[#0EA5E9]/20 text-white cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Human VO</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void handleToggleMicRecord();
                        }}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded border cursor-pointer ${
                          micRecordingSceneId === selectedScene.id
                            ? 'border-rose-500 bg-rose-600 text-white'
                            : 'border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1]'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>
                          {micRecordingSceneId === selectedScene.id ? 'Stop Take' : 'Record Mic Take'}
                        </span>
                      </button>
                    </div>

                    {/* Optional Neural Studio Take */}
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        aria-label="Neural Voice Talent"
                        value={maleVoice}
                        onChange={(e) => setMaleVoice(e.target.value as MaleVoiceId)}
                        className="flex-1 bg-[#11161F] border border-[#1B2332] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#0EA5E9]"
                      >
                        <option value="Charon">Charon (Deep Natural Male)</option>
                        <option value="Fenrir">Fenrir (Warm Baritone)</option>
                        <option value="Puck">Puck (Conversational Male)</option>
                      </select>
                      <button
                        type="button"
                        disabled={generatingSceneId === selectedScene.id}
                        onClick={() => {
                          void handleGenerateNeuralVoice(selectedScene);
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                      >
                        {generatingSceneId === selectedScene.id ? 'Generating...' : 'Generate Neural'}
                      </button>
                    </div>

                    {/* Loaded VO Clip Waveform & Audition */}
                    {selectedVoClip ? (
                      <div className="p-2.5 rounded border border-[#1B2332] bg-[#11161F] space-y-2">
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="font-medium text-white truncate">
                            {selectedVoClip.label}
                          </span>
                          <span className="font-mono text-[11px] text-[#38BDF8] tabular-nums shrink-0">
                            {selectedVoClip.durationSec.toFixed(1)}s / {selectedScene.durationSec}s
                          </span>
                        </div>
                        <div className="h-9 flex items-end gap-[2px] px-1 bg-[#090C11] rounded py-1">
                          {selectedVoClip.peaks.map((pk, idx) => (
                            <div
                              key={idx}
                              className={`flex-1 rounded-sm ${
                                selectedVoClip.sourceType === 'human-upload'
                                  ? 'bg-emerald-400/80'
                                  : 'bg-[#38BDF8]/80'
                              }`}
                              style={{ height: `${Math.round(pk * 100)}%` }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => getSoundEngine().playVoiceForScene(selectedScene.id, 0)}
                            className="px-2.5 py-1 text-[11px] font-medium rounded bg-[#0EA5E9] text-white cursor-pointer"
                          >
                            Audition VO
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              getSoundEngine().removeSceneVoiceClip(selectedScene.id);
                              setVoAssets((prev) => {
                                const next = { ...prev };
                                delete next[selectedScene.id];
                                return next;
                              });
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#94A3B8] hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded border border-dashed border-[#263248] bg-[#0D121B] text-[11px] text-[#94A3B8]">
                        No audio loaded for Scene 0{selectedScene.index}. Upload a human studio
                        recording or generate a neural take.
                      </div>
                    )}

                    {/* Script Text */}
                    <label className="block space-y-1 text-xs pt-1">
                      <span className="block text-[#94A3B8]">Narration Script</span>
                      <textarea
                        rows={3}
                        value={selectedScene.narration}
                        onChange={(e) =>
                          updateSelectedScene((s) => ({ ...s, narration: e.target.value }))
                        }
                        className="w-full bg-[#11161F] border border-[#1B2332] rounded p-2 text-xs text-white leading-relaxed outline-none focus:border-[#0EA5E9]"
                      />
                    </label>
                  </div>

                  {/* 3-Track Master Audio Mixer */}
                  <div className="pt-3 border-t border-[#1B2332] space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-white">3-Track Sound Mix</h3>
                      <label className="flex items-center gap-1.5 text-[11px] text-[#CBD5E1] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoDucking}
                          onChange={(e) => setAutoDucking(e.target.checked)}
                          className="accent-[#0EA5E9]"
                        />
                        <span>Auto-Duck Music</span>
                      </label>
                    </div>

                    {(
                      [
                        { id: 'vo', label: 'Voiceover (VO)' },
                        { id: 'music', label: 'Music Score (MUS)' },
                        { id: 'sfx', label: 'Foley & SFX' },
                      ] as { id: TrackId; label: string }[]
                    ).map((trk) => {
                      const state = mixer[trk.id];
                      return (
                        <div key={trk.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="text-[#CBD5E1]">{trk.label}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleTrackFlag(trk.id, 'muted')}
                                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border cursor-pointer ${
                                  state.muted
                                    ? 'bg-rose-600 border-rose-500 text-white'
                                    : 'bg-[#11161F] border-[#1B2332] text-[#94A3B8]'
                                }`}
                              >
                                M
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleTrackFlag(trk.id, 'solo')}
                                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border cursor-pointer ${
                                  state.solo
                                    ? 'bg-amber-500 border-amber-400 text-black font-bold'
                                    : 'bg-[#11161F] border-[#1B2332] text-[#94A3B8]'
                                }`}
                              >
                                S
                              </button>
                              <span className="w-10 text-right font-mono text-[11px] text-[#38BDF8] tabular-nums">
                                {Math.round(state.gain * 100)}%
                              </span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1.4}
                            step={0.05}
                            value={state.gain}
                            aria-label={`${trk.label} Gain`}
                            onChange={(e) => handleSetTrackGain(trk.id, parseFloat(e.target.value))}
                            className="w-full vca-slider"
                          />
                        </div>
                      );
                    })}

                    {/* Custom Music Upload */}
                    <input
                      ref={musicFileInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={handleUploadCustomMusic}
                    />
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => musicFileInputRef.current?.click()}
                        className="px-2.5 py-1 text-[11px] font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1] cursor-pointer"
                      >
                        {customMusicLabel ? 'Replace Music Bed' : 'Upload Custom Music'}
                      </button>
                      {customMusicLabel && (
                        <button
                          type="button"
                          onClick={() => {
                            getSoundEngine().clearCustomMusic();
                            setCustomMusicLabel(null);
                          }}
                          className="text-[11px] text-[#94A3B8] hover:text-rose-400 cursor-pointer truncate"
                        >
                          Use Built-in Score
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'qc' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-white">
                      Scene 0{selectedScene.index} Visual Quality Gate
                    </h3>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        selectedScene.qc.decision === 'approved'
                          ? 'text-emerald-400'
                          : selectedScene.qc.decision === 'rejected'
                            ? 'text-rose-400'
                            : 'text-[#94A3B8]'
                      }`}
                    >
                      {selectedScene.qc.decision === 'approved'
                        ? 'APPROVED'
                        : selectedScene.qc.decision === 'rejected'
                          ? 'REJECTED'
                          : 'PENDING REVIEW'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {QC_CHECK_ITEMS.map((item) => {
                      const checked = selectedScene.qc.checks[item.key];
                      return (
                        <label
                          key={item.key}
                          className="flex items-start gap-2.5 p-2 rounded border border-[#1B2332] bg-[#11161F] hover:border-[#2A3750] cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const nextChecked = e.target.checked;
                              updateSelectedScene((s) => ({
                                ...s,
                                qc: {
                                  ...s.qc,
                                  checks: {
                                    ...s.qc.checks,
                                    [item.key]: nextChecked,
                                  },
                                  decision:
                                    !nextChecked && s.qc.decision === 'approved'
                                      ? 'pending'
                                      : s.qc.decision,
                                },
                              }));
                            }}
                            className="mt-0.5 accent-[#0EA5E9]"
                          />
                          <span className={checked ? 'text-white' : 'text-[#CBD5E1]'}>
                            {item.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <label className="block space-y-1 text-xs">
                    <span className="block text-[#94A3B8]">Director / QC Review Notes</span>
                    <textarea
                      rows={2}
                      placeholder="Log lighting, refraction, cadence, or sync notes..."
                      value={selectedScene.qc.notes}
                      onChange={(e) =>
                        updateSelectedScene((s) => ({
                          ...s,
                          qc: { ...s.qc, notes: e.target.value },
                        }))
                      }
                      className="w-full bg-[#11161F] border border-[#1B2332] rounded p-2 text-xs text-white outline-none focus:border-[#0EA5E9]"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!qcReadyToApprove}
                      onClick={() =>
                        updateSelectedScene((s) => ({
                          ...s,
                          qc: { ...s.qc, decision: 'approved' },
                        }))
                      }
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#1B2332] disabled:text-[#64748B] text-white cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Approve Scene</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedScene((s) => ({
                          ...s,
                          qc: { ...s.qc, decision: 'rejected' },
                        }))
                      }
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded border border-rose-500/60 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Reject Scene</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Multi-Track Production Timeline (Hidden in Fullscreen) */}
      {!isFullscreen && (
        <section
          aria-label="Multi-Track Production Timeline"
          className="h-[208px] shrink-0 border-t border-[#1B2332] bg-[#0B0F17] flex flex-col select-none"
        >
          {/* Timecode Scrubber Header */}
          <div className="h-7 shrink-0 border-b border-[#1B2332] flex items-center bg-[#090C11]">
            <div className="w-36 shrink-0 px-3 text-[11px] font-mono text-[#94A3B8] border-r border-[#1B2332]">
              TIMELINE
            </div>
            <div
              role="slider"
              tabIndex={0}
              aria-label="Film Playhead Scrubber"
              aria-valuemin={0}
              aria-valuemax={totalDuration}
              aria-valuenow={Number(timeSec.toFixed(1))}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                handleSeek(ratio * totalDuration);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') handleSeek(timeSec + 1);
                if (e.key === 'ArrowLeft') handleSeek(timeSec - 1);
              }}
              className="relative flex-1 h-full cursor-pointer flex items-center"
            >
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((mark) => (
                <span
                  key={mark}
                  className="absolute top-1.5 text-[10px] font-mono text-[#64748B] tabular-nums -translate-x-1/2 pointer-events-none"
                  style={{ left: `${mark === 0 ? 2 : mark === 1 ? 98 : mark * 100}%` }}
                >
                  {formatTimecode(mark * totalDuration)}
                </span>
              ))}
            </div>
          </div>

          {/* 4 Tracks Container with Synchronized Playhead */}
          <div className="relative flex-1 flex flex-col divide-y divide-[#151C28] overflow-hidden">
            {/* Track 1: Video Scenes */}
            <div className="flex-1 flex min-h-0">
              <div className="w-36 shrink-0 px-3 flex items-center justify-between border-r border-[#1B2332] bg-[#090C11]">
                <span className="text-[11px] font-mono text-[#CBD5E1]">VID · SCENES</span>
              </div>
              <div className="relative flex-1 flex h-full">
                {scenes.map((sc) => {
                  const widthPct = (sc.durationSec / totalDuration) * 100;
                  const isSelected = sc.id === selectedScene.id;
                  const qcBorder =
                    sc.qc.decision === 'approved'
                      ? 'border-t-emerald-400'
                      : sc.qc.decision === 'rejected'
                        ? 'border-t-rose-500'
                        : 'border-t-[#334155]';
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => handleSelectScene(sc, true)}
                      style={{ width: `${widthPct}%` }}
                      className={`h-full px-2 py-1 text-left border-r border-[#06080D] border-t-2 ${qcBorder} flex flex-col justify-between overflow-hidden cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#17263B] text-white'
                          : 'bg-[#111826] text-[#94A3B8] hover:bg-[#151F30] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold truncate">{sc.shortTitle}</span>
                        {sc.qc.decision === 'approved' && (
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-[#64748B] truncate">
                        {sc.durationSec}s · {sc.transitionIn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Track 2: Voiceover */}
            <div className="h-11 shrink-0 flex">
              <div className="w-36 shrink-0 px-3 flex items-center justify-between border-r border-[#1B2332] bg-[#090C11]">
                <span className="text-[11px] font-mono text-[#38BDF8]">VO · NARR</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleTrackFlag('vo', 'muted')}
                    className={`px-1 text-[10px] font-mono rounded cursor-pointer ${
                      mixer.vo.muted ? 'bg-rose-600 text-white' : 'text-[#64748B] hover:text-white'
                    }`}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleTrackFlag('vo', 'solo')}
                    className={`px-1 text-[10px] font-mono rounded cursor-pointer ${
                      mixer.vo.solo
                        ? 'bg-amber-500 text-black font-bold'
                        : 'text-[#64748B] hover:text-white'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>
              <div className="relative flex-1 flex h-full bg-[#090D14]">
                {scenes.map((sc) => {
                  const widthPct = (sc.durationSec / totalDuration) * 100;
                  const clip = voAssets[sc.id];
                  return (
                    <div
                      key={sc.id}
                      onClick={() => {
                        setSelectedSceneId(sc.id);
                        setInspectorTab('audio');
                      }}
                      style={{ width: `${widthPct}%` }}
                      className="h-full border-r border-[#151C28] px-1 py-1 flex items-center cursor-pointer hover:bg-[#111826]"
                    >
                      {clip ? (
                        <div className="w-full h-full rounded bg-[#0D1A2B] border border-[#0EA5E9]/40 px-1 flex items-end gap-[1px] overflow-hidden">
                          {clip.peaks.slice(0, 22).map((pk, idx) => (
                            <div
                              key={idx}
                              className={`flex-1 ${
                                clip.sourceType === 'human-upload'
                                  ? 'bg-emerald-400/75'
                                  : 'bg-[#38BDF8]/75'
                              }`}
                              style={{ height: `${Math.max(14, Math.round(pk * 100))}%` }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="w-full h-full rounded border border-dashed border-[#1E293B] flex items-center justify-center text-[10px] font-mono text-[#475569] truncate px-1">
                          No VO
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 3: Music Score */}
            <div className="h-10 shrink-0 flex">
              <div className="w-36 shrink-0 px-3 flex items-center justify-between border-r border-[#1B2332] bg-[#090C11]">
                <span className="text-[11px] font-mono text-[#CBD5E1]">MUS · SCORE</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleTrackFlag('music', 'muted')}
                    className={`px-1 text-[10px] font-mono rounded cursor-pointer ${
                      mixer.music.muted
                        ? 'bg-rose-600 text-white'
                        : 'text-[#64748B] hover:text-white'
                    }`}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleTrackFlag('music', 'solo')}
                    className={`px-1 text-[10px] font-mono rounded cursor-pointer ${
                      mixer.music.solo
                        ? 'bg-amber-500 text-black font-bold'
                        : 'text-[#64748B] hover:text-white'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>
              <div className="relative flex-1 flex h-full bg-[#090D14]">
                {scenes.map((sc) => {
                  const widthPct = (sc.durationSec / totalDuration) * 100;
                  return (
                    <div
                      key={sc.id}
                      style={{ width: `${widthPct}%` }}
                      className="h-full border-r border-[#151C28] px-1 py-1.5 flex items-end"
                    >
                      <div
                        className="w-full rounded-sm bg-[#1E3A5F]/65 border-t border-[#38BDF8]/50"
                        style={{ height: `${Math.round(sc.musicEnergy * 100)}%` }}
                        title={`Score Energy ${Math.round(sc.musicEnergy * 100)}%`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 4: Foley & SFX Cues */}
            <div className="h-10 shrink-0 flex">
              <div className="w-36 shrink-0 px-3 flex items-center justify-between border-r border-[#1B2332] bg-[#090C11]">
                <span className="text-[11px] font-mono text-[#94A3B8]">SFX · FOLEY</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleTrackFlag('sfx', 'muted')}
                    className={`px-1 text-[10px] font-mono rounded cursor-pointer ${
                      mixer.sfx.muted
                        ? 'bg-rose-600 text-white'
                        : 'text-[#64748B] hover:text-white'
                    }`}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleTrackFlag('sfx', 'solo')}
                    className={`px-1 text-[10px] font-mono rounded cursor-pointer ${
                      mixer.sfx.solo
                        ? 'bg-amber-500 text-black font-bold'
                        : 'text-[#64748B] hover:text-white'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>
              <div className="relative flex-1 h-full bg-[#090D14]">
                {scenes.flatMap((sc) =>
                  sc.sfxCues.map((cue) => {
                    const absSec = sc.startSec + cue.offsetSec;
                    const leftPct = (absSec / totalDuration) * 100;
                    return (
                      <button
                        key={`${sc.id}-${cue.id}`}
                        type="button"
                        onClick={() => {
                          handleSeek(absSec);
                          getSoundEngine().playSfxCue(cue.type);
                        }}
                        title={`${cue.label} (${formatTimecode(absSec, true)})`}
                        style={{ left: `${leftPct}%` }}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 max-w-[92px] truncate px-1.5 py-0.5 rounded bg-[#162235] border border-[#38BDF8]/50 text-[9px] font-mono text-[#CBD5E1] hover:text-white hover:border-[#38BDF8] whitespace-nowrap cursor-pointer"
                      >
                        {cue.label}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Global Vertical Playhead Line */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 left-36 right-0"
            >
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-[#38BDF8]"
                style={{ left: `${(timeSec / totalDuration) * 100}%` }}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
