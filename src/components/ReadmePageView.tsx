import React, { useEffect, useMemo, useRef, useState } from 'react';
import { animate, useMotionValue } from 'motion/react';
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  GitBranch,
  Layers,
  Mail,
  Minimize2,
  RotateCw,
  Shield,
  Tag,
} from 'lucide-react';
import { generateAnimatedCadSvg, generateBlueprintSvg } from '../cad/blueprintSvg';
import {
  generateBomCsv,
  generateManufacturerRfqSpec,
  generateOpenScadSource,
  generateSlabDxf,
  generateSlabShellAsciiStl,
} from '../cad/cadExporters';
import { BomItem, EngineeringMetrics, POLYMER_SPECS } from '../cad/engineeringMath';
import {
  DEFAULT_EMBED_OPTIONS,
  buildCadDownloadUrls,
  buildEmbedSnippets,
  buildGitHubCadReadme,
  sanitizeContactEmail,
  sanitizeGitHubRepoUrl,
} from '../cad/embedConfig';
import { createCertLabelBackTexture, createCertLabelTexture } from '../cad/slabTextures';
import {
  SLAB_COMPONENTS,
  SlabComponentId,
  SlabParameters,
  ViewPresetId,
} from '../cad/types';
import { SlabViewport3D } from './SlabViewport3D';

interface ReadmePageViewProps {
  params: SlabParameters;
  metrics: EngineeringMetrics;
  bom: BomItem[];
  githubUrl: string;
  contactEmail: string;
  standalone?: boolean;
  onOpenCadStudio?: () => void;
  onOpenEmbedModal?: () => void;
}

export const ReadmePageView: React.FC<ReadmePageViewProps> = ({
  params,
  metrics,
  bom,
  githubUrl,
  contactEmail,
  standalone = false,
  onOpenCadStudio,
  onOpenEmbedModal,
}) => {
  const [activeView, setActiveView] = useState<ViewPresetId>('assembled');
  const [isExploded, setIsExploded] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(true);
  const [blueprintMode, setBlueprintMode] = useState<boolean>(false);
  const [showCallouts, setShowCallouts] = useState<boolean>(true);
  const [selectedComponent, setSelectedComponent] = useState<SlabComponentId | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const frontLabelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backLabelCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const explodeMotion = useMotionValue(0);
  const explodeAnimRef = useRef<ReturnType<typeof animate> | null>(null);

  const toggleExplode = (nextExploded: boolean) => {
    setIsExploded(nextExploded);
    explodeAnimRef.current?.stop();
    explodeAnimRef.current = animate(explodeMotion, nextExploded ? 1 : 0, {
      type: 'spring',
      stiffness: 115,
      damping: 18,
      mass: 0.85,
    });
  };

  useEffect(() => {
    return () => {
      explodeAnimRef.current?.stop();
    };
  }, []);

  // Render live 2D Front & Back VCA Label prototype canvases directly in the README spec
  useEffect(() => {
    const frontTex = createCertLabelTexture(params, 4);
    const drawFront = () => {
      const target = frontLabelCanvasRef.current;
      const src = frontTex.image as HTMLCanvasElement | undefined;
      if (target && src) {
        const ctx = target.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, target.width, target.height);
          ctx.drawImage(src, 0, 0, target.width, target.height);
        }
      }
    };
    drawFront();

    let backTex: ReturnType<typeof createCertLabelBackTexture> | null = null;
    const drawBack = () => {
      const target = backLabelCanvasRef.current;
      const src = backTex?.image as HTMLCanvasElement | undefined;
      if (target && src) {
        const ctx = target.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, target.width, target.height);
          ctx.drawImage(src, 0, 0, target.width, target.height);
        }
      }
    };
    backTex = createCertLabelBackTexture(params, 4, drawBack);
    drawBack();

    return () => {
      frontTex.dispose();
      backTex?.dispose();
    };
  }, [params]);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://vcaslabs.com';
  const cleanEmail = sanitizeContactEmail(contactEmail);
  const cleanRepo = sanitizeGitHubRepoUrl(githubUrl);
  const poly = POLYMER_SPECS[params.polymerGrade];

  const downloadUrls = useMemo(
    () => buildCadDownloadUrls(origin, params, cleanEmail, cleanRepo),
    [origin, params, cleanEmail, cleanRepo]
  );

  const snippets = useMemo(
    () => buildEmbedSnippets(origin, DEFAULT_EMBED_OPTIONS, params, cleanEmail),
    [origin, params, cleanEmail]
  );

  const dynamicReadme = useMemo(
    () => buildGitHubCadReadme(params, metrics, origin, cleanRepo, cleanEmail),
    [params, metrics, origin, cleanRepo, cleanEmail]
  );

  const animatedSvg = useMemo(
    () => generateAnimatedCadSvg(params, metrics, cleanEmail),
    [params, metrics, cleanEmail]
  );

  const staticBlueprintSvg = useMemo(
    () =>
      generateBlueprintSvg(params, metrics, {
        style: 'exploded-blueprint',
        view: 'exploded',
        explode: true,
        hud: true,
      }),
    [params, metrics]
  );

  const selectedMeta = useMemo(
    () => SLAB_COMPONENTS.find((c) => c.id === selectedComponent) || null,
    [selectedComponent]
  );

  const handleSelectSpecComponent = (compId: SlabComponentId) => {
    const togglingOff = selectedComponent === compId;
    if (togglingOff) {
      setSelectedComponent(null);
      return;
    }
    setSelectedComponent(compId);
    const isInternal =
      compId !== 'front_housing' && compId !== 'rear_housing' && compId !== 'perimeter_bezel';
    if (isInternal && !isExploded) {
      setActiveView('exploded');
      toggleExplode(true);
    }
  };

  const copyText = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard errors in headless environments
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
  };

  const downloadTextFile = (filename: string, content: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div
      data-testid="readme-page-root"
      className="flex-1 min-h-0 overflow-y-auto bg-[#0D1117] text-[#E6EDF3]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
        <div className="rounded-lg border border-[#30363D] bg-[#161B22] overflow-hidden shadow-xl">
          {/* Repository Header Bar */}
          <div className="px-4 py-3 border-b border-[#30363D] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-white">
                <GitBranch className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>vcaslabs / vca-slab-cad</span>
              </span>
              <span className="text-[#8B949E]">/</span>
              <span className="font-mono font-semibold text-[#7DD3FC]">README.md</span>
              <span className="px-2 py-0.5 rounded border border-[#30363D] bg-[#0D1117] font-mono text-[11px] text-[#38BDF8]">
                {params.serialNumber}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`mailto:${cleanEmail}?subject=${encodeURIComponent(
                  `VCA Slab Manufacturing & DFM Inquiry — ${params.serialNumber}`
                )}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[#30363D] bg-[#0D1117] hover:border-[#38BDF8] text-[#7DD3FC]"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{cleanEmail}</span>
              </a>

              <button
                type="button"
                onClick={() => void copyText('readmeMd', dynamicReadme)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[#30363D] bg-[#0D1117] hover:border-[#38BDF8] text-[#E6EDF3] cursor-pointer"
              >
                {copiedId === 'readmeMd' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied README</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>Copy README.md</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => downloadTextFile('README.md', dynamicReadme, 'text/markdown')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#0EA5E9] hover:bg-[#0284C7] text-white cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download README.md</span>
              </button>

              {standalone && onOpenCadStudio ? (
                <button
                  type="button"
                  onClick={onOpenCadStudio}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[#30363D] bg-[#0D1117] hover:border-[#38BDF8] text-[#E6EDF3] cursor-pointer"
                >
                  <span>Full CAD Studio</span>
                </button>
              ) : (
                <a
                  href={cleanRepo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[#30363D] bg-[#0D1117] hover:border-[#38BDF8] text-[#E6EDF3]"
                >
                  <span>GitHub Repo</span>
                  <ExternalLink className="w-3 h-3 text-[#8B949E]" />
                </a>
              )}
            </div>
          </div>

          <div className="p-5 sm:p-7 space-y-7">
            {/* Title & Architectural Summary */}
            <div className="border-b border-[#21262D] pb-5 space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                VCA — Verified Card Authority | Transparent NFC Slab CAD &amp; Manufacturing Spec
              </h1>
              <p className="text-sm text-[#8B949E] leading-relaxed">
                Complete 3D interactive product specification, tolerance targets, and dual-sided VCA
                certification label prototype dossier for{' '}
                <span className="font-mono text-[#E6EDF3]">{params.serialNumber}</span> (
                {params.overallWidthMm.toFixed(1)} × {params.overallHeightMm.toFixed(1)} ×{' '}
                {params.overallThicknessMm.toFixed(1)} mm optical polycarbonate housing with 13.56 MHz
                cryptographic NFC inlay).
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#8B949E]">
                <span>
                  Engineering Contact:{' '}
                  <a
                    href={`mailto:${cleanEmail}`}
                    className="font-mono text-[#38BDF8] hover:underline"
                  >
                    {cleanEmail}
                  </a>
                </span>
                <span>
                  Portal:{' '}
                  <a
                    href="https://vcaslabs.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#38BDF8] hover:underline"
                  >
                    vcaslabs.com
                  </a>
                </span>
                <span>Spec Status: Proposed Engineering Targets (Vendor DFM Confirmation Required)</span>
              </div>
            </div>

            {/* 1. EMBEDDED 3D INTERACTIVE FULL-SPEC VIEWPORT */}
            <section aria-label="Embedded Live 3D Animated VCA Slab" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Live 3D Interactive Product &amp; Label Inspection
                  </h2>
                  <p className="text-xs text-[#8B949E]">
                    Inspect the water-clear optical polycarbonate slab, Front &amp; Rear VCA labels,
                    internal NFC coil pocket, and all 12 engineered layers in real time.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('assembled');
                      toggleExplode(false);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                      activeView === 'assembled' && !isExploded
                        ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
                        : 'bg-[#0D1117] border-[#30363D] text-[#C9D1D9] hover:border-[#38BDF8]'
                    }`}
                  >
                    Crystal 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('front');
                      toggleExplode(false);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                      activeView === 'front'
                        ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
                        : 'bg-[#0D1117] border-[#30363D] text-[#C9D1D9] hover:border-[#38BDF8]'
                    }`}
                  >
                    Front Label
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('rear');
                      toggleExplode(false);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                      activeView === 'rear'
                        ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
                        : 'bg-[#0D1117] border-[#30363D] text-[#C9D1D9] hover:border-[#38BDF8]'
                    }`}
                  >
                    Rear QR Label
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('nfc_compartment');
                      toggleExplode(true);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                      activeView === 'nfc_compartment'
                        ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
                        : 'bg-[#0D1117] border-[#30363D] text-[#C9D1D9] hover:border-[#38BDF8]'
                    }`}
                  >
                    NFC Bay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('cross_section');
                      toggleExplode(false);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                      activeView === 'cross_section'
                        ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
                        : 'bg-[#0D1117] border-[#30363D] text-[#C9D1D9] hover:border-[#38BDF8]'
                    }`}
                  >
                    Cross-Section
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isExploded;
                      setActiveView(next ? 'exploded' : 'assembled');
                      toggleExplode(next);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                      isExploded
                        ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
                        : 'bg-[#0D1117] border-[#30363D] text-[#C9D1D9] hover:border-[#38BDF8]'
                    }`}
                  >
                    {isExploded ? <Minimize2 className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                    <span>{isExploded ? 'Collapse Slab' : 'Explode 12 Layers'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnimating((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                      isAnimating
                        ? 'border-[#38BDF8] bg-[#0EA5E9]/15 text-[#38BDF8]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-white'
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>{isAnimating ? 'Orbiting' : 'Orbit Paused'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlueprintMode((v) => !v)}
                    className={`px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                      blueprintMode
                        ? 'border-[#38BDF8] bg-[#0EA5E9]/15 text-[#38BDF8]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#C9D1D9] hover:border-[#38BDF8]'
                    }`}
                  >
                    {blueprintMode ? 'Blueprint Wire' : 'Optical Studio'}
                  </button>
                  {isExploded && (
                    <button
                      type="button"
                      onClick={() => setShowCallouts((v) => !v)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                        showCallouts
                          ? 'border-[#38BDF8] bg-[#0EA5E9]/15 text-[#38BDF8]'
                          : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Callouts</span>
                    </button>
                  )}
                </div>
              </div>

              <div
                data-testid="readme-embedded-3d-viewport"
                className="relative w-full h-[520px] rounded-xl border border-[#1E3A5F] bg-[#040912] overflow-hidden shadow-2xl"
              >
                <SlabViewport3D
                  params={params}
                  metrics={metrics}
                  activeView={activeView}
                  explodeMotion={explodeMotion}
                  selectedComponent={selectedComponent}
                  sectionEnabled={activeView === 'cross_section'}
                  sectionOffsetMm={0}
                  showCallouts={isExploded && showCallouts}
                  blueprintMode={blueprintMode}
                  autoRotate={isAnimating}
                  onSelectComponent={setSelectedComponent}
                />

                <div className="pointer-events-none absolute top-3.5 left-4 z-10 rounded-md border border-[#1E3A5F] bg-[#060D18]/88 px-3 py-2 font-mono text-[11px] space-y-0.5">
                  <div className="font-bold text-[#38BDF8]">
                    {params.serialNumber} · WATER-CLEAR OPTICAL PC
                  </div>
                  <div className="text-[#CBD5E1]">
                    {params.overallWidthMm.toFixed(1)} × {params.overallHeightMm.toFixed(1)} ×{' '}
                    {params.overallThicknessMm.toFixed(1)} mm · {metrics.estimatedTotalMassG} g
                  </div>
                </div>

                {selectedMeta && (
                  <div
                    data-testid="readme-selected-component-card"
                    className="absolute bottom-3.5 left-4 right-4 sm:right-auto sm:max-w-lg z-20 rounded-md border border-[#38BDF8]/60 bg-[#060D18]/95 px-3.5 py-2.5 text-xs shadow-xl flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-mono font-bold text-[#38BDF8]">
                        #{String(selectedMeta.calloutNumber).padStart(2, '0')} · {selectedMeta.name}
                      </div>
                      <div className="text-white">{selectedMeta.material}</div>
                      <div className="text-[11px] text-[#7DD3FC]">{selectedMeta.process}</div>
                      <p className="text-[11px] text-[#94A3B8] leading-snug">
                        {selectedMeta.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedComponent(null)}
                      className="text-[11px] text-[#8B949E] hover:text-white cursor-pointer shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Interactive 12-Component Hardware Specification Strip */}
              <div className="rounded-lg border border-[#30363D] bg-[#0D1117] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-white">
                    Click Any Slab Layer (#01–#12) to Highlight in 3D &amp; Inspect Tooling Spec:
                  </span>
                  <span className="text-[#8B949E]">
                    {selectedMeta
                      ? `Inspecting #${String(selectedMeta.calloutNumber).padStart(2, '0')} (${selectedMeta.subsystem})`
                      : 'All 12 layers ready for inspection'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
                  {SLAB_COMPONENTS.map((comp) => {
                    const active = selectedComponent === comp.id;
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => handleSelectSpecComponent(comp.id)}
                        className={`text-left px-2 py-1.5 rounded border text-[11px] font-mono transition-colors cursor-pointer truncate ${
                          active
                            ? 'bg-[#0EA5E9] border-[#38BDF8] text-white font-semibold'
                            : 'bg-[#161B22] border-[#30363D] text-[#C9D1D9] hover:border-[#38BDF8] hover:text-white'
                        }`}
                      >
                        #{String(comp.calloutNumber).padStart(2, '0')} {comp.shortName}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 2. VCA LABEL PROTOTYPE SPECIFICATION (FRONT & BACK SECURITY FEATURES) */}
            <section
              aria-label="VCA Label Prototype Specification"
              data-testid="readme-label-prototype-section"
              className="rounded-lg border border-[#1E3A5F] bg-[#0B121D] p-5 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E3A5F]/60 pb-3">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#38BDF8]" />
                    <span>1. VCA Certification Label Prototype Specification (Front &amp; Back)</span>
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    Dual-sided {params.labelWidthMm.toFixed(1)} × {params.labelHeightMm.toFixed(1)} mm
                    archival Teslin / micro-perforated security insert housing the encapsulated 13.56 MHz
                    NFC inlay.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded border border-[#1E3A5F] bg-[#060D18] font-mono text-[11px] text-[#7DD3FC]">
                  Carrier Bay: {params.labelWidthMm.toFixed(1)} × {params.labelHeightMm.toFixed(1)} × 0.86 mm
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* FRONT OF LABEL PROTOTYPE */}
                <div className="rounded-lg border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Front of Label — Classic VCA Blue &amp; Red Trim
                    </span>
                    <span className="font-mono text-[11px] text-[#38BDF8]">+Z Face</span>
                  </div>

                  <div className="rounded border border-[#1E3A5F] bg-[#040912] p-2">
                    <canvas
                      ref={frontLabelCanvasRef}
                      width={1024}
                      height={356}
                      aria-label="VCA Label Front Prototype Artwork"
                      className="w-full h-auto block rounded-sm"
                    />
                  </div>

                  <ul className="space-y-1.5 text-xs text-[#C9D1D9]">
                    <li>
                      <strong className="text-white">Classic Blue &amp; Red Split Trim:</strong>{' '}
                      Royal Blue (<span className="font-mono text-[#7DD3FC]">#0A2E73</span>) left half
                      and Crimson Red (<span className="font-mono text-[#FCA5A5]">#B91C1C</span>) right
                      half with brushed metallic perimeter bevel.
                    </li>
                    <li>
                      <strong className="text-white">Fugitive-Ink Security Guilloche:</strong> Fine
                      cyan anti-alteration wave graphic across the pearl-white cardstock field.
                    </li>
                    <li>
                      <strong className="text-white">Serialization &amp; Hologram Badge:</strong>{' '}
                      Code-128 1D barcode (bottom-left), centered multi-angle chrome{' '}
                      <span className="font-mono text-white">VCA</span> hologram seal, and right-aligned
                      card #, grade tier (<span className="font-mono text-white">{params.gradeLabel}</span>),
                      and serial (<span className="font-mono text-[#7DD3FC]">{params.serialNumber}</span>).
                    </li>
                  </ul>
                </div>

                {/* BACK OF LABEL PROTOTYPE */}
                <div className="rounded-lg border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Back of Label — UV Watermark, Prismatic Shield &amp; QR
                    </span>
                    <span className="font-mono text-[11px] text-[#38BDF8]">-Z Face</span>
                  </div>

                  <div className="rounded border border-[#1E3A5F] bg-[#040912] p-2">
                    <canvas
                      ref={backLabelCanvasRef}
                      width={1024}
                      height={356}
                      aria-label="VCA Label Back Prototype Artwork"
                      className="w-full h-auto block rounded-sm"
                    />
                  </div>

                  <ul className="space-y-1.5 text-xs text-[#C9D1D9]">
                    <li>
                      <strong className="text-white">Midnight Navy UV Pattern + Silver Crest:</strong>{' '}
                      Repeating UV-reactive <span className="font-mono text-[#7DD3FC]">VCA</span>{' '}
                      watermark grid with metallic silver <span className="font-mono text-white">VCA</span>{' '}
                      logo on the left band.
                    </li>
                    <li>
                      <strong className="text-white">Center Prismatic VCA Hologram Shield:</strong>{' '}
                      Split rainbow diffraction foil and micro-flake silver shield with bi-color emblem.
                    </li>
                    <li>
                      <strong className="text-white">Instant QR Verification &amp; Barcode Strip:</strong>{' '}
                      ECC-H QR code (<span className="font-mono text-[#7DD3FC]">vcaslabs.com/v/{params.serialNumber}</span>)
                      on upper-right plus lower fugitive-ink strip with 1D barcode and serial.
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 3. MANUFACTURER DOWNLOADS PACKAGE */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-white">
                  2. Manufacturer CAD &amp; RFQ File Downloads
                </h2>
                <a
                  href={`mailto:${cleanEmail}`}
                  className="text-xs font-mono text-[#38BDF8] hover:underline"
                >
                  Submit DFM quotes to {cleanEmail}
                </a>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      `${params.serialNumber}-housing.stl`,
                      generateSlabShellAsciiStl(params)
                    )
                  }
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#30363D] bg-[#161B22] hover:border-[#38BDF8] text-[#E6EDF3] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>Housing .STL</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      `${params.serialNumber}-profile.dxf`,
                      generateSlabDxf(params, metrics)
                    )
                  }
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#30363D] bg-[#161B22] hover:border-[#38BDF8] text-[#E6EDF3] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>2D CAD .DXF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      `${params.serialNumber}-parametric.scad`,
                      generateOpenScadSource(params, metrics)
                    )
                  }
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#30363D] bg-[#161B22] hover:border-[#38BDF8] text-[#E6EDF3] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>OpenSCAD</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      `${params.serialNumber}-bom.csv`,
                      generateBomCsv(bom),
                      'text/csv'
                    )
                  }
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#30363D] bg-[#161B22] hover:border-[#38BDF8] text-[#E6EDF3] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>BOM .CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      `${params.serialNumber}-manufacturer-rfq.md`,
                      generateManufacturerRfqSpec(params, metrics, bom, cleanEmail),
                      'text/markdown'
                    )
                  }
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#30363D] bg-[#161B22] hover:border-[#38BDF8] text-[#E6EDF3] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>RFQ Spec</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      `${params.serialNumber}-animated-3d.svg`,
                      animatedSvg,
                      'image/svg+xml'
                    )
                  }
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#30363D] bg-[#161B22] hover:border-[#38BDF8] text-[#E6EDF3] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>Anim 3D .SVG</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      `${params.serialNumber}-blueprint.svg`,
                      staticBlueprintSvg,
                      'image/svg+xml'
                    )
                  }
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#30363D] bg-[#161B22] hover:border-[#38BDF8] text-[#E6EDF3] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>2D Blueprint</span>
                </button>
              </div>
            </section>

            {/* 4. ENGINEERING SPECIFICATIONS GRID */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-[#30363D] bg-[#0D1117] p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-white">
                  3. Enclosure &amp; Injection-Moulding Targets
                </h3>
                <div className="divide-y divide-[#21262D] text-xs">
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">Exterior Envelope</span>
                    <span className="font-mono text-white">
                      {params.overallWidthMm.toFixed(2)} × {params.overallHeightMm.toFixed(2)} ×{' '}
                      {params.overallThicknessMm.toFixed(2)} mm
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">Primary Optical Resin</span>
                    <span className="font-mono text-[#7DD3FC]">{poly.name}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">Optical Finish / Clarity</span>
                    <span className="font-mono text-white">
                      SPI A-1 Polish · {poly.lightTransmittancePct}% Transmittance
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">Shell Wall / Draft / Tol.</span>
                    <span className="font-mono text-white">
                      {params.wallThicknessMm.toFixed(2)} mm · {params.draftAngleDeg.toFixed(1)}° · ±
                      {params.assemblyToleranceMm.toFixed(2)} mm
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">Tool Cavity (Shrinkage Comp.)</span>
                    <span className="font-mono text-white">
                      {metrics.compensatedToolWidthMm} × {metrics.compensatedToolHeightMm} mm (
                      {metrics.nominalShrinkagePct}%)
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">Est. Press Clamp (2-Cav)</span>
                    <span className="font-mono text-white">
                      ~{metrics.estimatedClampingForceTons} US Tons · {metrics.estimatedTotalMassG} g
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#30363D] bg-[#0D1117] p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-white">
                  4. Card Cavity, Weld &amp; 13.56 MHz NFC Bay
                </h3>
                <div className="divide-y divide-[#21262D] text-xs">
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">Card Cavity Envelope</span>
                    <span className="font-mono text-white">
                      {metrics.internalCavityWidthMm} × {metrics.internalCavityHeightMm} ×{' '}
                      {metrics.internalCavityDepthMm} mm
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">Ultrasonic Perimeter Seal</span>
                    <span className="font-mono text-white">
                      20 kHz ({params.weldRidgeWidthMm.toFixed(2)} ×{' '}
                      {params.weldRidgeHeightMm.toFixed(2)} mm director + 4 shear pins)
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">NFC Transponder IC</span>
                    <span className="font-mono text-[#7DD3FC]">
                      {params.nfcChipConfig === 'ntag424_dna'
                        ? 'NXP NTAG424 DNA (AES-128 SUN)'
                        : 'NXP NTAG215 (Static NDEF)'}
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">Planar Copper Antenna</span>
                    <span className="font-mono text-white">
                      {params.antennaOuterWidthMm} × {params.antennaOuterHeightMm} mm ·{' '}
                      {params.antennaTurns} turns ({params.antennaCopperThicknessUm} µm Cu)
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">RF Inductance / Tuning / Read</span>
                    <span className="font-mono text-white">
                      {metrics.estimatedInductanceUh} µH · {metrics.requiredTuningCapacitancePf} pF ·
                      ~{metrics.estimatedReadRangeMm} mm
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-4">
                    <span className="text-[#8B949E]">Architectural Boundary</span>
                    <span className="font-mono text-[#8B949E]">
                      NFC acts as access key; digital records live off-chip
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. BILL OF MATERIALS TABLE */}
            <section className="space-y-2.5">
              <h2 className="text-base font-semibold text-white">5. Bill of Materials (BOM)</h2>
              <div className="overflow-x-auto rounded-lg border border-[#30363D]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#161B22] border-b border-[#30363D] text-[#8B949E]">
                      <th className="py-2 px-3 font-semibold">#</th>
                      <th className="py-2 px-3 font-semibold">Part Number</th>
                      <th className="py-2 px-3 font-semibold">Description</th>
                      <th className="py-2 px-3 font-semibold">Material</th>
                      <th className="py-2 px-3 font-semibold text-right">Mass</th>
                      <th className="py-2 px-3 font-semibold">Process</th>
                      <th className="py-2 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262D] bg-[#0D1117]">
                    {bom.map((row) => (
                      <tr key={row.itemNo} className="hover:bg-[#161B22]/60">
                        <td className="py-2 px-3 font-mono text-[#8B949E]">{row.itemNo}</td>
                        <td className="py-2 px-3 font-mono text-[#7DD3FC]">{row.partNumber}</td>
                        <td className="py-2 px-3 text-white">{row.description}</td>
                        <td className="py-2 px-3 text-[#C9D1D9]">{row.material}</td>
                        <td className="py-2 px-3 font-mono text-right text-[#E6EDF3]">
                          {row.unitMassG} g
                        </td>
                        <td className="py-2 px-3 text-[#8B949E]">{row.process}</td>
                        <td className="py-2 px-3 text-[#38BDF8]">{row.specStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 6. EMBED THIS 3D INTERACTIVE FULL-SPEC README ANYWHERE */}
            <section className="rounded-lg border border-[#1E3A5F] bg-[#0B121D] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-[#38BDF8]" />
                    <span>6. Embed This 3D Interactive Full Spec &amp; README Anywhere</span>
                  </h2>
                  <p className="text-xs text-[#8B949E]">
                    Embed the full interactive manufacturer README (`?mode=readme`), the standalone 3D
                    viewport, or the GitHub Markdown animated CAD SVG.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText('readmeFullIframe', snippets.readmeIframeHtml)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-[#30363D] bg-[#0D1117] hover:border-[#38BDF8] text-[#E6EDF3] cursor-pointer"
                  >
                    {copiedId === 'readmeFullIframe' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied Full Spec Iframe</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Copy Full Spec Iframe</span>
                      </>
                    )}
                  </button>
                  {onOpenEmbedModal && (
                    <button
                      type="button"
                      onClick={onOpenEmbedModal}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-[#1E3A5F] bg-[#0EA5E9]/15 hover:bg-[#0EA5E9] text-[#38BDF8] hover:text-white cursor-pointer"
                    >
                      <FileCode2 className="w-3.5 h-3.5" />
                      <span>Customize Embeds</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-[#7DD3FC]">
                    Full Interactive 3D Spec README &lt;iframe&gt;
                  </div>
                  <pre className="p-2.5 rounded border border-[#21262D] bg-[#090C11] font-mono text-[11px] text-[#CBD5E1] overflow-x-auto whitespace-pre-wrap">
                    {snippets.readmeIframeHtml}
                  </pre>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-[#7DD3FC]">
                    GitHub README Markdown (Animated 3D SVG)
                  </div>
                  <pre className="p-2.5 rounded border border-[#21262D] bg-[#090C11] font-mono text-[11px] text-[#CBD5E1] overflow-x-auto whitespace-pre-wrap">
                    {snippets.animatedMarkdownSnippet}
                  </pre>
                </div>
              </div>

              <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[#8B949E]">
                <span>
                  Engineering Email:{' '}
                  <a href={`mailto:${cleanEmail}`} className="font-mono text-[#38BDF8] hover:underline">
                    {cleanEmail}
                  </a>
                </span>
                <span>URL Route: {downloadUrls.readmePageUrl}</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
