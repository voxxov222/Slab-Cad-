import { useMemo, useState } from 'react';
import { calculateEngineeringMetrics, generateBom } from './cad/engineeringMath';
import {
  DEFAULT_GITHUB_CAD_URL,
  GITHUB_CAD_STORAGE_KEY,
  parseAppModeAndEmbedFromSearch,
  sanitizeGitHubRepoUrl,
} from './cad/embedConfig';
import { DEFAULT_SLAB_PARAMETERS, SlabParameters } from './cad/types';
import { CadStudioView } from './components/CadStudioView';
import { CreateVideoView } from './components/CreateVideoView';
import { DigitalPassportView } from './components/DigitalPassportView';
import { EmbedBlueprintView } from './components/EmbedBlueprintView';
import { EmbedShareModal } from './components/EmbedShareModal';
import { ManufacturingView } from './components/ManufacturingView';
import { NfcSecurityView } from './components/NfcSecurityView';
import { AppSection, TopBar } from './components/TopBar';
import { VideoFormatCategory } from './cad/videoCreator';

function readInitialRouteState() {
  if (typeof window === 'undefined') {
    return parseAppModeAndEmbedFromSearch('');
  }
  return parseAppModeAndEmbedFromSearch(window.location.search);
}

function getInitialSection(cadOnly: boolean): AppSection {
  if (typeof window === 'undefined') return 'studio';
  if (cadOnly) return 'studio';
  const autostart = new URLSearchParams(window.location.search).get('autostart');
  if (autostart === 'video' || autostart === '1') return 'video';
  return 'studio';
}

function loadSavedGithubUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_GITHUB_CAD_URL;
  try {
    const saved = window.localStorage.getItem(GITHUB_CAD_STORAGE_KEY);
    return saved ? sanitizeGitHubRepoUrl(saved) : DEFAULT_GITHUB_CAD_URL;
  } catch {
    return DEFAULT_GITHUB_CAD_URL;
  }
}

export default function App() {
  const routeState = useMemo(() => readInitialRouteState(), []);
  const [activeSection, setActiveSection] = useState<AppSection>(() =>
    getInitialSection(routeState.cadOnly)
  );
  const [params, setParams] = useState<SlabParameters>(() => ({
    ...DEFAULT_SLAB_PARAMETERS,
    ...routeState.paramOverrides,
  }));
  const [githubUrl, setGithubUrl] = useState<string>(loadSavedGithubUrl);
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false);
  const [videoLaunchReq, setVideoLaunchReq] = useState<{
    id: number;
    prompt: string;
    category?: VideoFormatCategory;
  } | null>(null);

  const handleUpdateGithubUrl = (nextUrl: string) => {
    const clean = sanitizeGitHubRepoUrl(nextUrl);
    setGithubUrl(clean);
    try {
      window.localStorage.setItem(GITHUB_CAD_STORAGE_KEY, clean);
    } catch {
      // ignore storage failure
    }
  };

  const metrics = useMemo(() => calculateEngineeringMetrics(params), [params]);
  const bom = useMemo(() => generateBom(params, metrics), [params, metrics]);

  // Chromeless interactive blueprint embed route (?embed=blueprint)
  if (routeState.mode === 'embed-blueprint') {
    return (
      <EmbedBlueprintView
        initialParams={params}
        initialEmbed={routeState.embed}
        githubUrl={githubUrl}
      />
    );
  }

  const mobileNavItems: { id: AppSection; label: string }[] = (
    [
      { id: 'studio', label: 'CAD' },
      { id: 'video', label: 'Create Video' },
      { id: 'nfc', label: 'NFC' },
      { id: 'manufacturing', label: 'Mfg' },
      { id: 'passport', label: 'Passport' },
    ] as { id: AppSection; label: string }[]
  ).filter((item) => !(routeState.cadOnly && item.id === 'video'));

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#090C11] text-[#F1F5F9]">
      <TopBar
        activeSection={activeSection}
        cadOnlyMode={routeState.cadOnly}
        githubUrl={githubUrl}
        onSelectSection={setActiveSection}
        onOpenEmbedModal={() => setEmbedModalOpen(true)}
        onSimulateTap={() => setActiveSection('passport')}
      />

      {/* Mobile secondary nav strip (only visible below md breakpoint) */}
      <div
        className={`grid ${routeState.cadOnly ? 'grid-cols-4' : 'grid-cols-5'} md:hidden border-b border-[#1B2332] bg-[#0D121B] px-2 py-1.5 gap-1 shrink-0`}
      >
        {mobileNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveSection(item.id)}
            className={`px-1.5 py-1 text-[11px] font-medium rounded text-center truncate cursor-pointer ${
              activeSection === item.id
                ? 'bg-[#0EA5E9] text-white'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeSection === 'studio' && (
          <CadStudioView
            params={params}
            metrics={metrics}
            cadOnlyMode={routeState.cadOnly}
            onChangeParams={setParams}
            onCreateVideoFromPrompt={(promptText, category) => {
              setVideoLaunchReq({ id: Date.now(), prompt: promptText, category });
              setActiveSection('video');
            }}
            onOpenEmbed={() => setEmbedModalOpen(true)}
          />
        )}
        {!routeState.cadOnly && activeSection === 'video' && (
          <CreateVideoView
            params={params}
            metrics={metrics}
            initialRequest={videoLaunchReq}
          />
        )}
        {activeSection === 'nfc' && (
          <NfcSecurityView params={params} metrics={metrics} onChangeParams={setParams} />
        )}
        {activeSection === 'manufacturing' && (
          <ManufacturingView
            params={params}
            metrics={metrics}
            bom={bom}
            onChangeParams={setParams}
          />
        )}
        {activeSection === 'passport' && <DigitalPassportView params={params} />}
      </main>

      <EmbedShareModal
        open={embedModalOpen}
        onClose={() => setEmbedModalOpen(false)}
        params={params}
        metrics={metrics}
        githubUrl={githubUrl}
        onChangeGithubUrl={handleUpdateGithubUrl}
      />
    </div>
  );
}
