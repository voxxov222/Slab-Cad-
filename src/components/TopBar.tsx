import React from 'react';

export type AppSection = 'studio' | 'film' | 'nfc' | 'manufacturing' | 'passport';

interface TopBarProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  onSimulateTap: () => void;
}

const NAV_ITEMS: { id: AppSection; label: string }[] = [
  { id: 'studio', label: 'CAD Studio' },
  { id: 'film', label: 'Film Studio' },
  { id: 'nfc', label: 'NFC & Security' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'passport', label: 'Digital Passport' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onSelectSection,
  onSimulateTap,
}) => {
  return (
    <header className="h-14 shrink-0 border-b border-[#1B2332] bg-[#090C11] px-6 flex items-center justify-between gap-8 z-30">
      {/* Zone 1: Single-line Brand Wordmark */}
      <button
        type="button"
        onClick={() => onSelectSection('studio')}
        className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-[#38BDF8] transition-colors cursor-pointer"
      >
        VCA Slab Studio
      </button>

      {/* Zone 2: 4 Single-line Navigation Links */}
      <nav aria-label="Primary Engineering Sections" className="hidden md:flex items-center gap-6">
        {NAV_ITEMS.map((item) => {
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

      {/* Zone 3: 1 Primary CTA */}
      <div className="shrink-0 flex items-center">
        <button
          type="button"
          onClick={onSimulateTap}
          className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0EA5E9] hover:bg-[#0284C7] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Simulate NFC Tap
        </button>
      </div>
    </header>
  );
};
