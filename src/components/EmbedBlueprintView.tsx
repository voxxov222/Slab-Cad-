import React, { useEffect, useMemo, useRef, useState } from 'react';
import { animate, useMotionValue } from 'motion/react';
import { ExternalLink, FileCode2, Layers, Minimize2, Tag } from 'lucide-react';
import { calculateEngineeringMetrics } from '../cad/engineeringMath';
import { generateBlueprintSvg } from '../cad/blueprintSvg';
import {
  EmbedBlueprintStyle,
  EmbedOptions,
  buildCadOnlyUrl,
  sanitizeGitHubRepoUrl,
} from '../cad/embedConfig';
import { SlabComponentId, SlabParameters, VIEW_PRESETS, ViewPresetId } from '../cad/types';
import { SlabViewport3D } from './SlabViewport3D';

interface EmbedBlueprintViewProps {
  initialParams: SlabParameters;
  initialEmbed: EmbedOptions;
  githubUrl: string;
}

export const EmbedBlueprintView: React.FC<EmbedBlueprintViewProps> = ({
  initialParams,
  initialEmbed,
  githubUrl,
}) => {
  const [params, setParams] = useState<SlabParameters>(initialParams);
  const [activeView, setActiveView] = useState<ViewPresetId>(initialEmbed.view);
  const [styleMode, setStyleMode] = useState<EmbedBlueprintStyle>(initialEmbed.style);
  const [isExploded, setIsExploded] = useState<boolean>(initialEmbed.explode);
  const [showCallouts, setShowCallouts] = useState<boolean>(initialEmbed.callouts);
  const [showHud, setShowHud] = useState<boolean>(initialEmbed.hud);
  const [render2dSvg, setRender2dSvg] = useState<boolean>(false);
  const [selectedComponent, setSelectedComponent] = useState<SlabComponentId | null>(null);

  const metrics = useMemo(() => calculateEngineeringMetrics(params), [params]);
  const explodeMotion = useMotionValue(initialEmbed.explode ? 1 : 0);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);

  const animateExplode = (exploded: boolean) => {
    setIsExploded(exploded);
    animRef.current?.stop();
    animRef.current = animate(explodeMotion, exploded ? 1 : 0, {
      type: 'spring',
      stiffness: 115,
      damping: 18,
      mass: 0.85,
    });
  };

  useEffect(() => {
    return () => {
      animRef.current?.stop();
    };
  }, []);

  // Notify parent iframe host that embed is ready and listen for dynamic updates
  useEffect(() => {
    try {
      window.parent?.postMessage(
        {
          type: 'VCA_EMBED_READY',
          serial: params.serialNumber,
          metrics,
        },
        '*'
      );
    } catch {
      // ignore cross-origin restrictions
    }

    const onMessage = (event: MessageEvent) => {
      const msg = event.data as {
        type?: string;
        style?: EmbedBlueprintStyle;
        view?: ViewPresetId;
        explode?: boolean;
        callouts?: boolean;
        hud?: boolean;
        mode2d?: boolean;
        params?: Partial<SlabParameters>;
      } | null;

      if (!msg || msg.type !== 'VCA_EMBED_UPDATE') return;
      if (msg.style) setStyleMode(msg.style);
      if (msg.view && VIEW_PRESETS.some((v) => v.id === msg.view)) setActiveView(msg.view);
      if (typeof msg.explode === 'boolean') animateExplode(msg.explode);
      if (typeof msg.callouts === 'boolean') setShowCallouts(msg.callouts);
      if (typeof msg.hud === 'boolean') setShowHud(msg.hud);
      if (typeof msg.mode2d === 'boolean') setRender2dSvg(msg.mode2d);
      if (msg.params && typeof msg.params === 'object') {
        setParams((prev) => ({ ...prev, ...msg.params }));
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const isBlueprintVisual = styleMode === 'blueprint' || styleMode === 'exploded-blueprint';
  const cadOnlyUrl = useMemo(
    () =>
      buildCadOnlyUrl(
        typeof window !== 'undefined' ? window.location.origin : 'https://vcaslabs.com',
        params
      ),
    [params]
  );

  const svgMarkup = useMemo(
    () =>
      render2dSvg
        ? generateBlueprintSvg(params, metrics, {
            style: styleMode,
            view: activeView,
            explode: isExploded,
            hud: showHud,
          })
        : '',
    [render2dSvg, params, metrics, styleMode, activeView, isExploded, showHud]
  );

  return (
    <div
      data-testid="vca-embed-blueprint-root"
      className="relative w-screen h-screen overflow-hidden bg-[#041224] text-[#F1F5F9] select-none"
    >
      {render2dSvg ? (
        <div
          data-testid="vca-embed-2d-svg"
          className="w-full h-full flex items-center justify-center p-2 pb-14 bg-[#041224] [&_svg]:w-full [&_svg]:h-full"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      ) : (
        <SlabViewport3D
          params={params}
          metrics={metrics}
          activeView={activeView}
          explodeMotion={explodeMotion}
          selectedComponent={selectedComponent}
          sectionEnabled={activeView === 'cross_section'}
          sectionOffsetMm={0}
          showCallouts={showCallouts}
          blueprintMode={isBlueprintVisual}
          onSelectComponent={setSelectedComponent}
        />
      )}

      {/* CAD Blueprint Reticle & Engineering Dimensions Overlay */}
      {!render2dSvg && isBlueprintVisual && (
        <div
          data-testid="embed-blueprint-grid-overlay"
          className="pointer-events-none absolute inset-0 z-10"
        >
          <div
            className="absolute inset-3 border border-[#38BDF8]/30 rounded"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(56,189,248,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.06) 1px, transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          />
        </div>
      )}

      {showHud && !render2dSvg && (
        <div
          data-testid="embed-blueprint-hud"
          className="pointer-events-none absolute top-4 left-5 z-20 max-w-sm rounded border border-[#38BDF8]/45 bg-[#041224]/88 px-3 py-2.5 font-mono space-y-1 shadow-xl"
        >
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-[#38BDF8]">
            <span>VCA CAD BLUEPRINT</span>
            <span aria-hidden="true">·</span>
            <span>{params.serialNumber}</span>
          </div>
          <div className="text-[11px] text-[#E2E8F0]">
            ENVELOPE: {params.overallWidthMm.toFixed(1)} × {params.overallHeightMm.toFixed(1)} ×{' '}
            {params.overallThicknessMm.toFixed(1)} mm
          </div>
          <div className="text-[10px] text-[#94A3B8]">
            CAVITY: {metrics.internalCavityWidthMm} × {metrics.internalCavityHeightMm} mm · NFC{' '}
            {params.antennaTurns}T ({metrics.estimatedInductanceUh} uH @ 13.56 MHz)
          </div>
        </div>
      )}

      {/* Compact Interactive Controls Footer (Zero Video Studio UI) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1E3A5F] bg-[#061120]/92 shadow-2xl max-w-[96vw]">
        <button
          type="button"
          onClick={() => {
            setRender2dSvg(false);
            animateExplode(!isExploded);
          }}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border cursor-pointer whitespace-nowrap transition-colors ${
            isExploded
              ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
              : 'bg-[#0B1628] border-[#1E3A5F] text-[#CBD5E1] hover:text-white'
          }`}
        >
          {isExploded ? <Minimize2 className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
          <span>{isExploded ? 'Collapse' : 'Explode'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setRender2dSvg(false);
            setStyleMode((prev) => (prev === 'studio' ? 'exploded-blueprint' : 'studio'));
          }}
          className={`px-2.5 py-1 text-[11px] font-medium rounded border cursor-pointer whitespace-nowrap transition-colors ${
            !render2dSvg && isBlueprintVisual
              ? 'bg-[#0EA5E9]/20 border-[#38BDF8] text-[#38BDF8]'
              : 'bg-[#0B1628] border-[#1E3A5F] text-[#CBD5E1] hover:text-white'
          }`}
        >
          {isBlueprintVisual ? 'Blueprint 3D' : 'Optical 3D'}
        </button>

        <button
          type="button"
          onClick={() => setRender2dSvg((v) => !v)}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border cursor-pointer whitespace-nowrap transition-colors ${
            render2dSvg
              ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
              : 'bg-[#0B1628] border-[#1E3A5F] text-[#CBD5E1] hover:text-white'
          }`}
        >
          <FileCode2 className="w-3 h-3" />
          <span>2D CAD Sheet</span>
        </button>

        {!render2dSvg && (
          <button
            type="button"
            onClick={() => setShowCallouts((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border cursor-pointer whitespace-nowrap transition-colors ${
              showCallouts
                ? 'border-[#38BDF8] text-[#38BDF8] bg-[#0EA5E9]/15'
                : 'border-[#1E3A5F] text-[#94A3B8] hover:text-white bg-[#0B1628]'
            }`}
          >
            <Tag className="w-3 h-3" />
            <span>Callouts</span>
          </button>
        )}

        <a
          href={cadOnlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border border-[#1E3A5F] bg-[#0B1628] hover:border-[#38BDF8] text-[#E2E8F0] hover:text-white whitespace-nowrap"
        >
          <span>CAD Studio</span>
          <ExternalLink className="w-3 h-3 text-[#38BDF8]" />
        </a>

        <a
          href={sanitizeGitHubRepoUrl(githubUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-[#1E3A5F] bg-[#0B1628] hover:border-[#38BDF8] text-[#94A3B8] hover:text-white whitespace-nowrap"
        >
          <span>GitHub</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
