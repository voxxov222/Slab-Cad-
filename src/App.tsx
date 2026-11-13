import { useMemo, useState } from 'react';
import { calculateEngineeringMetrics, generateBom } from './cad/engineeringMath';
import { DEFAULT_SLAB_PARAMETERS, SlabParameters } from './cad/types';
import { CadStudioView } from './components/CadStudioView';
import { DigitalPassportView } from './components/DigitalPassportView';
import { FilmStudioView } from './components/FilmStudioView';
import { ManufacturingView } from './components/ManufacturingView';
import { NfcSecurityView } from './components/NfcSecurityView';
import { AppSection, TopBar } from './components/TopBar';

function getInitialSection(): AppSection {
  if (typeof window === 'undefined') return 'studio';
  const autostart = new URLSearchParams(window.location.search).get('autostart');
  if (autostart === 'film' || autostart === '1') return 'film';
  return 'studio';
}

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>(getInitialSection);
  const [params, setParams] = useState<SlabParameters>(DEFAULT_SLAB_PARAMETERS);

  const metrics = useMemo(() => calculateEngineeringMetrics(params), [params]);
  const bom = useMemo(() => generateBom(params, metrics), [params, metrics]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#090C11] text-[#F1F5F9]">
      <TopBar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onSimulateTap={() => setActiveSection('passport')}
      />

      {/* Mobile secondary nav strip (only visible below md breakpoint) */}
      <div className="grid grid-cols-5 md:hidden border-b border-[#1B2332] bg-[#0D121B] px-2 py-1.5 gap-1 shrink-0">
        {(
          [
            { id: 'studio', label: 'CAD' },
            { id: 'film', label: 'Film' },
            { id: 'nfc', label: 'NFC' },
            { id: 'manufacturing', label: 'Mfg' },
            { id: 'passport', label: 'Passport' },
          ] as { id: AppSection; label: string }[]
        ).map((item) => (
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
            onChangeParams={setParams}
            onOpenFilmStudio={() => setActiveSection('film')}
          />
        )}
        {activeSection === 'film' && <FilmStudioView params={params} metrics={metrics} />}
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
    </div>
  );
}
