import React, { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  GitBranch,
  Globe,
  X,
} from 'lucide-react';
import {
  generateBomCsv,
  generateOpenScadSource,
  generateSlabDxf,
  generateSlabShellAsciiStl,
} from '../cad/cadExporters';
import { generateBlueprintSvg } from '../cad/blueprintSvg';
import { EngineeringMetrics, generateBom } from '../cad/engineeringMath';
import {
  DEFAULT_EMBED_OPTIONS,
  EmbedBlueprintStyle,
  EmbedOptions,
  buildEmbedSnippets,
  buildGitHubCadReadme,
  sanitizeGitHubRepoUrl,
} from '../cad/embedConfig';
import { SlabParameters, VIEW_PRESETS, ViewPresetId } from '../cad/types';

interface EmbedShareModalProps {
  open: boolean;
  onClose: () => void;
  params: SlabParameters;
  metrics: EngineeringMetrics;
  githubUrl: string;
  onChangeGithubUrl: (nextUrl: string) => void;
}

type ModalTab = 'iframe' | 'textbox' | 'github';

export const EmbedShareModal: React.FC<EmbedShareModalProps> = ({
  open,
  onClose,
  params,
  metrics,
  githubUrl,
  onChangeGithubUrl,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('iframe');
  const [options, setOptions] = useState<EmbedOptions>(DEFAULT_EMBED_OPTIONS);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draftGithub, setDraftGithub] = useState<string>(githubUrl);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://vcaslabs.com';

  const snippets = useMemo(
    () => buildEmbedSnippets(origin, options, params),
    [origin, options, params]
  );

  const previewSvg = useMemo(
    () =>
      generateBlueprintSvg(params, metrics, {
        style: options.style,
        view: options.view,
        explode: options.explode,
        hud: options.hud,
      }),
    [params, metrics, options]
  );

  if (!open) return null;

  const copyText = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    }
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

  const sanitizedGithub = sanitizeGitHubRepoUrl(draftGithub || githubUrl);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="GitHub CAD Repository & Universal Blueprint Embeds"
        className="w-full max-w-4xl max-h-[90vh] rounded-xl border border-[#1E3A5F] bg-[#0B0F17] text-[#F1F5F9] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#1B2332] bg-[#090C11] flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">
              VCA CAD Blueprint Embeds &amp; GitHub Repository
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Embed live CAD blueprints in any iframe, Markdown box, CMS, or share CAD-only without video production.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close GitHub and Embed dialog"
            className="p-1.5 rounded border border-[#1B2332] bg-[#11161F] text-[#94A3B8] hover:text-white hover:border-[#38BDF8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div
          role="tablist"
          aria-label="Embed and GitHub Options"
          className="px-5 border-b border-[#1B2332] bg-[#090C11] flex items-center gap-6 shrink-0"
        >
          {(
            [
              { id: 'iframe', label: 'Dynamic Iframe', icon: Code2 },
              { id: 'textbox', label: 'Text Box & CMS', icon: FileCode2 },
              { id: 'github', label: 'GitHub CAD (No Video)', icon: GitBranch },
            ] as { id: ModalTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 py-2.5 text-xs font-medium border-b-2 cursor-pointer transition-colors ${
                  active
                    ? 'border-[#0EA5E9] text-white'
                    : 'border-transparent text-[#94A3B8] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Shared Blueprint Embed Configurator (Visible for Iframe & Text Box tabs) */}
          {activeTab !== 'github' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3.5 rounded-lg border border-[#1B2332] bg-[#11161F]">
              <div className="space-y-1">
                <label htmlFor="embed-style-select" className="block text-[11px] font-medium text-[#94A3B8]">
                  Blueprint Style
                </label>
                <select
                  id="embed-style-select"
                  value={options.style}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      style: e.target.value as EmbedBlueprintStyle,
                      explode: e.target.value === 'exploded-blueprint' ? true : prev.explode,
                    }))
                  }
                  className="w-full bg-[#090C11] border border-[#1B2332] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#0EA5E9]"
                >
                  <option value="exploded-blueprint">Exploded Blueprint</option>
                  <option value="blueprint">CAD Blueprint</option>
                  <option value="xray-nfc">X-Ray NFC</option>
                  <option value="studio">Optical Studio 3D</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="embed-view-select" className="block text-[11px] font-medium text-[#94A3B8]">
                  Camera View
                </label>
                <select
                  id="embed-view-select"
                  value={options.view}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, view: e.target.value as ViewPresetId }))
                  }
                  className="w-full bg-[#090C11] border border-[#1B2332] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#0EA5E9]"
                >
                  {VIEW_PRESETS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.shortLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="embed-height-input" className="block text-[11px] font-medium text-[#94A3B8]">
                  Iframe Height (px)
                </label>
                <input
                  id="embed-height-input"
                  type="number"
                  min={280}
                  max={1200}
                  step={20}
                  value={options.heightPx}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      heightPx: Math.max(280, Math.min(1200, Number(e.target.value) || 560)),
                    }))
                  }
                  className="w-full bg-[#090C11] border border-[#1B2332] rounded px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-[#0EA5E9]"
                />
              </div>

              <div className="flex flex-col justify-end gap-1.5 sm:col-span-2">
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#CBD5E1] py-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.explode}
                      onChange={(e) => setOptions((p) => ({ ...p, explode: e.target.checked }))}
                      className="accent-[#0EA5E9] cursor-pointer"
                    />
                    <span>Explode Layers</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.callouts}
                      onChange={(e) => setOptions((p) => ({ ...p, callouts: e.target.checked }))}
                      className="accent-[#0EA5E9] cursor-pointer"
                    />
                    <span>Callouts</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.hud}
                      onChange={(e) => setOptions((p) => ({ ...p, hud: e.target.checked }))}
                      className="accent-[#0EA5E9] cursor-pointer"
                    />
                    <span>Specs HUD</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: DYNAMIC IFRAME */}
          {activeTab === 'iframe' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Live Dynamic Blueprint Preview
                  </span>
                  <a
                    href={snippets.directUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-[#38BDF8] hover:underline"
                  >
                    <span>Open Standalone Embed</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div
                  className="w-full h-[300px] rounded-lg border border-[#1E3A5F] bg-[#041224] overflow-hidden flex items-center justify-center p-1 [&_svg]:w-full [&_svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="iframe-snippet-box" className="text-xs font-semibold text-white">
                    Responsive &lt;iframe&gt; Embed Code
                  </label>
                  <button
                    type="button"
                    onClick={() => void copyText('iframe', snippets.iframeHtml)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    {copiedId === 'iframe' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Copy Iframe</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="iframe-snippet-box"
                  readOnly
                  rows={5}
                  value={snippets.iframeHtml}
                  className="w-full bg-[#090C11] border border-[#1B2332] rounded-md p-2.5 font-mono text-[11px] text-[#7DD3FC] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="direct-url-box" className="text-xs font-semibold text-white">
                    Direct Embed URL (Notion / Webflow / Framer / Miro)
                  </label>
                  <button
                    type="button"
                    onClick={() => void copyText('directUrl', snippets.directUrl)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    {copiedId === 'directUrl' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  id="direct-url-box"
                  readOnly
                  value={snippets.directUrl}
                  className="w-full bg-[#090C11] border border-[#1B2332] rounded-md px-3 py-2 font-mono text-[11px] text-[#CBD5E1] outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: UNIVERSAL TEXT BOX & CMS */}
          {activeTab === 'textbox' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="script-widget-box" className="text-xs font-semibold text-white">
                    Dynamic HTML Text-Box Widget (Auto-Mounts Responsive Iframe via /embed.js)
                  </label>
                  <button
                    type="button"
                    onClick={() => void copyText('widget', snippets.scriptWidgetHtml)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    {copiedId === 'widget' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Copy Widget</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="script-widget-box"
                  readOnly
                  rows={6}
                  value={snippets.scriptWidgetHtml}
                  className="w-full bg-[#090C11] border border-[#1B2332] rounded-md p-2.5 font-mono text-[11px] text-[#7DD3FC] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="markdown-box" className="text-xs font-semibold text-white">
                    Markdown / GitHub README Embed (Links to CAD-Only Viewer — Zero Video UI)
                  </label>
                  <button
                    type="button"
                    onClick={() => void copyText('markdown', snippets.markdownSnippet)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    {copiedId === 'markdown' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Copy Markdown</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="markdown-box"
                  readOnly
                  rows={2}
                  value={snippets.markdownSnippet}
                  className="w-full bg-[#090C11] border border-[#1B2332] rounded-md p-2.5 font-mono text-[11px] text-[#CBD5E1] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="object-svg-box" className="text-xs font-semibold text-white">
                    HTML &lt;object&gt; Parametric Vector SVG (For Iframe-Restricted Text Boxes)
                  </label>
                  <button
                    type="button"
                    onClick={() => void copyText('objectSvg', snippets.objectSvgHtml)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    {copiedId === 'objectSvg' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Copy &lt;object&gt;</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="object-svg-box"
                  readOnly
                  rows={3}
                  value={snippets.objectSvgHtml}
                  className="w-full bg-[#090C11] border border-[#1B2332] rounded-md p-2.5 font-mono text-[11px] text-[#CBD5E1] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="postmessage-box" className="text-xs font-semibold text-white">
                    Dynamic Host Control API (window.postMessage)
                  </label>
                  <button
                    type="button"
                    onClick={() => void copyText('postMessage', snippets.postMessageSnippet)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    {copiedId === 'postMessage' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Copy JS API</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="postmessage-box"
                  readOnly
                  rows={6}
                  value={snippets.postMessageSnippet}
                  className="w-full bg-[#090C11] border border-[#1B2332] rounded-md p-2.5 font-mono text-[11px] text-[#94A3B8] outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: GITHUB CAD REPOSITORY (EXCLUDES VIDEO PRODUCTION) */}
          {activeTab === 'github' && (
            <div className="space-y-5">
              <div className="p-4 rounded-lg border border-[#1B2332] bg-[#11161F] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-white">
                      VCA CAD GitHub Repository Link
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      Point visitors directly to your open CAD &amp; hardware specs repo (no video production tools).
                    </p>
                  </div>
                  <a
                    href={sanitizedGithub}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Open on GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="github-repo-url-input" className="sr-only">
                    GitHub Repository URL
                  </label>
                  <input
                    id="github-repo-url-input"
                    type="url"
                    value={draftGithub}
                    onChange={(e) => setDraftGithub(e.target.value)}
                    placeholder="https://github.com/vcaslabs/vca-slab-cad"
                    className="flex-1 bg-[#090C11] border border-[#1B2332] focus:border-[#0EA5E9] rounded px-3 py-2 font-mono text-xs text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = sanitizeGitHubRepoUrl(draftGithub);
                      setDraftGithub(clean);
                      onChangeGithubUrl(clean);
                    }}
                    className="px-3 py-2 text-xs font-semibold rounded border border-[#1B2332] bg-[#090C11] hover:border-[#38BDF8] text-white cursor-pointer whitespace-nowrap"
                  >
                    Save Repo URL
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-[#1E3A5F] bg-[#081322] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-white">
                      CAD-Only Public App Link (?mode=cad-only)
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      Opens CAD Studio, 12 Engineering Views, NFC &amp; Security, Manufacturing, and Digital Passport with all video production hidden.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText('cadOnlyUrl', snippets.cadOnlyUrl)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-[#1E3A5F] bg-[#0B1628] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                    >
                      {copiedId === 'cadOnlyUrl' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                    <a
                      href={snippets.cadOnlyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-[#38BDF8]/60 bg-[#0EA5E9]/15 hover:bg-[#0EA5E9] text-[#38BDF8] hover:text-white transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Preview CAD-Only</span>
                    </a>
                  </div>
                </div>
                <input
                  readOnly
                  aria-label="CAD-Only Viewer URL"
                  value={snippets.cadOnlyUrl}
                  className="w-full bg-[#040B14] border border-[#1E3A5F] rounded px-3 py-2 font-mono text-[11px] text-[#7DD3FC] outline-none"
                />
              </div>

              <div className="p-4 rounded-lg border border-[#1B2332] bg-[#11161F] space-y-3">
                <div>
                  <h3 className="text-xs font-semibold text-white">
                    Download VCA CAD Package for GitHub Commit (Excludes Film Studio)
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Export clean, manufacturer-ready geometry, blueprints, BOM, and GitHub README directly from your current parameters.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        'README.md',
                        buildGitHubCadReadme(params, metrics, origin, sanitizedGithub),
                        'text/markdown'
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#0EA5E9] hover:bg-[#0284C7] text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>README.md</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        `${params.serialNumber}-blueprint.svg`,
                        previewSvg,
                        'image/svg+xml'
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#1B2332] bg-[#090C11] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>Blueprint (.svg)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        `${params.serialNumber}-housing.stl`,
                        generateSlabShellAsciiStl(params)
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#1B2332] bg-[#090C11] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>Housing (.stl)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        `${params.serialNumber}-profile.dxf`,
                        generateSlabDxf(params, metrics)
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#1B2332] bg-[#090C11] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>2D CAD (.dxf)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        `${params.serialNumber}-parametric.scad`,
                        generateOpenScadSource(params, metrics)
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#1B2332] bg-[#090C11] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>OpenSCAD (.scad)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        `${params.serialNumber}-bom.csv`,
                        generateBomCsv(generateBom(params, metrics)),
                        'text/csv'
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#1B2332] bg-[#090C11] hover:border-[#38BDF8] text-[#E2E8F0] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>BOM (.csv)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
