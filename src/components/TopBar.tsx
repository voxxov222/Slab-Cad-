import React from 'react';
import { Code2, ExternalLink, GitBranch } from 'lucide-react';
import { sanitizeGitHubRepoUrl } from '../cad/embedConfig';

export type AppSection = 'studio' | 'video' | 'nfc' | 'manufacturing' | 'passport';

interface TopBarProps {
  activeSection: AppSection;
  cadOnlyMode?: boolean;
  githubUrl: string;
  onSelectSection: (section: AppSection) => void;
  onOpenEmbedModal: () => void;
  onSimulateTap: () => void;
}

const NAV_ITEMS: { id: AppSection; label: string }[] = [
  { id: 'studio', label: 'CAD Studio' },
  { id: 'video', label: 'Create Video' },
  { id: 'nfc', label: 'NFC & Security' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'passport', label: 'Digital Passport' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  cadOnlyMode = false,
  githubUrl,
  onSelectSection,
  onOpenEmbedModal,
  onSimulateTap,
}) => {
  const visibleItems = cadOnlyMode ? NAV_ITEMS.filter((n) => n.id !== 'video') : NAV_ITEMS;
  const safeGithubUrl = sanitizeGitHubRepoUrl(githubUrl);

  return (
    <header className="h-14 shrink-0 border-b border-[#1B2332] bg-[#090C11] px-5 flex items-center justify-between gap-4 z-30">
      {/* Zone 1: Single-line Brand Wordmark */}
      <button
        type="button"
        onClick={() => onSelectSection('studio')}
        className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-[#38BDF8] transition-colors cursor-pointer"
      >
        VCA Slab Studio
      </button>

      {/* Zone 2: Primary Navigation Links */}
      <nav aria-label="Primary Engineering Sections" className="hidden md:flex items-center gap-5">
        {visibleItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
                isActive
                  ? 'text-white border-[#0EA5E9]'
                  : 'text-[#94A3B8] border-transparent hover:text-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: GitHub CAD Link, Blueprint Embeds & Primary CTA */}
      <div className="shrink-0 flex items-center gap-2">
        <a
          href={safeGithubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open VCA CAD Repository on GitHub"
          title="Open VCA CAD Repository on GitHub"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#CBD5E1] hover:text-white border border-[#1B2332] hover:border-[#38BDF8] bg-[#11161F] rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <GitBranch className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>GitHub CAD</span>
          <ExternalLink className="w-3 h-3 text-[#64748B]" />
        </a>

        <button
          type="button"
          onClick={onOpenEmbedModal}
          aria-label="Open GitHub and Blueprint Embed Studio"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#E2E8F0] hover:text-white border border-[#1B2332] hover:border-[#38BDF8] bg-[#11161F] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Code2 className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>Embed</span>
        </button>

        <button
          type="button"
          onClick={onSimulateTap}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0EA5E9] hover:bg-[#0284C7] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Simulate NFC Tap
        </button>
      </div>
    </header>
  );
};
