import React from 'react';
import { CheckCircle2, Lock, Radio, ShieldAlert, Wrench } from 'lucide-react';
import { EngineeringMetrics } from '../cad/engineeringMath';
import { SlabParameters } from '../cad/types';

interface NfcSecurityViewProps {
  params: SlabParameters;
  metrics: EngineeringMetrics;
  onChangeParams: (next: SlabParameters) => void;
}

const JOINING_METHODS = [
  {
    method: '20 kHz Ultrasonic Fusion + Tongue-Groove + Shear Pins',
    selected: true,
    tamperEvidence: 'Irreversible polymer melt + stress whitening & pin shear on pry',
    cycleTime: '0.85 s total (0.35 s weld / 0.50 s hold)',
    cardSafety: 'Zero solvent vapor, localized heat strictly at perimeter director',
    verdict: 'Selected for Production',
  },
  {
    method: 'Chemical Solvent Welding (MEK / Methylene Chloride)',
    selected: false,
    tamperEvidence: 'Permanent bond, high risk of capillary fogging onto card window',
    cycleTime: '15–45 s fixture clamp + 24 hr outgassing',
    cardSafety: 'High risk — solvent fumes damage card ink and archival sleeves',
    verdict: 'Rejected (Optical & Card Risk)',
  },
  {
    method: 'Mechanical Snap-Fit + Pressure-Sensitive Adhesive',
    selected: false,
    tamperEvidence: 'Low — can be shimmed open with thin spudger and re-closed cleanly',
    cycleTime: '2–3 s press assembly',
    cardSafety: 'Safe, but fails anti-counterfeit re-encapsulation requirement',
    verdict: 'Rejected (Insufficient Tamper Security)',
  },
  {
    method: 'Ultrasonic Staked Brass Inserts / Micro-Rivets',
    selected: false,
    tamperEvidence: 'Moderate — drilling out rivets leaves visible scars, adds metal mass',
    cycleTime: '3–5 s multi-point press',
    cardSafety: 'Safe, but metal hardware degrades 13.56 MHz NFC RF field near corners',
    verdict: 'Rejected (RF Interference & Cost)',
  },
];

const QA_PROCEDURES = [
  {
    testId: 'QC-RF-01',
    parameter: 'Closed-Slab NFC Read Distance',
    method: 'ISO/IEC 14443-A reference reader + iOS/Android smartphone sweep',
    criteria: '>= 18.0 mm axial read through 1.85 mm front shell (Target)',
    sampling: '100% inline verification during encoding',
  },
  {
    testId: 'QC-RF-02',
    parameter: 'Antenna Resonant Frequency & Q',
    method: 'VNA inductive loop sweep across sealed NFC isolation pocket',
    criteria: '13.45 – 13.75 MHz center frequency; Q-factor 22 – 38',
    sampling: '100% inlay incoming QC + 1% post-weld audit',
  },
  {
    testId: 'QC-CR-03',
    parameter: 'Cryptographic SDM / CMAC Check',
    method: 'Automated tap challenge against VCA HSM verification endpoint',
    criteria: 'HTTP 200 valid AES-128 CMAC + monotonic counter increment (NTAG424)',
    sampling: '100% inline post-weld serialization gate',
  },
  {
    testId: 'QC-OP-04',
    parameter: 'QR Readability & Serial Binding',
    method: 'Machine vision camera decode vs NFC NDEF URL & laser plate text',
    criteria: '100% string parity; ECC-H decode < 150 ms under 45° glare',
    sampling: '100% inline vision check',
  },
  {
    testId: 'QC-ME-05',
    parameter: 'Ultrasonic Seam Destructive Pull',
    method: 'Universal tensile fixture pry test on perimeter weld flange',
    criteria: '>= 220 N separation force; cohesive polymer tear required',
    sampling: '3 units per 1,000-slab production lot (AQL)',
  },
  {
    testId: 'QC-ME-06',
    parameter: 'Card Cavity Go/No-Go & Optical Haze',
    method: 'CMM / Pin gauge cavity check + ASTM D1003 hazemeter on window',
    criteria: 'XY ±0.05 mm tolerance; Optical haze <= 1.0% (Confirm w/ Moulder)',
    sampling: 'First-article inspection + 5 pcs per cavity shift',
  },
];

export const NfcSecurityView: React.FC<NfcSecurityViewProps> = ({
  params,
  metrics,
  onChangeParams,
}) => {
  // Build SVG spiral path for live antenna geometry preview
  const pitch = params.antennaTraceWidthMm + params.antennaTraceSpacingMm;
  const scale = 220 / Math.max(24, params.nfcPocketWidthMm + 4);
  const cx = 140;
  const cy = 140;

  const coilRects = Array.from({ length: params.antennaTurns }, (_, i) => {
    const w = Math.max(2, params.antennaOuterWidthMm - i * 2 * pitch) * scale;
    const h = Math.max(2, params.antennaOuterHeightMm - i * 2 * pitch) * scale;
    return {
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      strokeW: Math.max(1.2, params.antennaTraceWidthMm * scale),
    };
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#090C11] px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-[#1B2332] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-mono text-[#38BDF8]">
              Stage C & Tamper-Evident Security · 13.56 MHz ISO/IEC 14443-A
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Embedded NFC Architecture & Anti-Tamper Engineering
            </h1>
            <p className="text-sm text-[#94A3B8] max-w-2xl">
              Comparison of Prototype (NTAG215) vs Production (NTAG424 DNA) configurations, live
              planar spiral antenna RLC calculations, ultrasonic tamper-evident joining, and QA/QC
              acceptance gates.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#11161F] p-1 rounded-lg border border-[#1B2332] shrink-0">
            <button
              type="button"
              onClick={() => onChangeParams({ ...params, nfcChipConfig: 'ntag215' })}
              className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap ${
                params.nfcChipConfig === 'ntag215'
                  ? 'bg-[#0EA5E9] text-white'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Prototype: NTAG215
            </button>
            <button
              type="button"
              onClick={() => onChangeParams({ ...params, nfcChipConfig: 'ntag424_dna' })}
              className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap ${
                params.nfcChipConfig === 'ntag424_dna'
                  ? 'bg-[#0EA5E9] text-white'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Production: NTAG424 DNA
            </button>
          </div>
        </div>

        {/* 01. Live NFC Antenna Schematic & RLC Tuning Calculator */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            01. Recessed NFC Compartment & Planar Spiral Antenna Geometry
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* SVG Coil Drawing */}
            <div className="lg:col-span-5 bg-[#11161F] border border-[#1B2332] rounded-lg p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-3">
                <span className="font-semibold text-white">Planar Spiral Coil Schematic</span>
                <span className="font-mono tabular-nums">
                  {params.antennaOuterWidthMm} × {params.antennaOuterHeightMm} mm
                </span>
              </div>

              <div className="flex items-center justify-center py-2">
                <svg
                  viewBox="0 0 280 280"
                  className="w-64 h-64 bg-[#090C11] rounded border border-[#1B2332]"
                  role="img"
                  aria-label="NFC Spiral Antenna Schematic"
                >
                  {/* Moulded Isolation Pocket Boundary */}
                  <rect
                    x={cx - (params.nfcPocketWidthMm * scale) / 2}
                    y={cy - (params.nfcPocketHeightMm * scale) / 2}
                    width={params.nfcPocketWidthMm * scale}
                    height={params.nfcPocketHeightMm * scale}
                    fill="none"
                    stroke="#1E293B"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  {/* Copper Spiral Turns */}
                  {coilRects.map((r, idx) => (
                    <rect
                      key={idx}
                      x={r.x}
                      y={r.y}
                      width={r.w}
                      height={r.h}
                      fill="none"
                      stroke="#E68A3E"
                      strokeWidth={r.strokeW}
                      rx="2"
                    />
                  ))}
                  {/* IC Die Placement */}
                  <rect
                    x={cx - 10}
                    y={cy + (params.antennaOuterHeightMm * scale) / 2 - 22}
                    width={20}
                    height={14}
                    fill="#0EA5E9"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    rx="1.5"
                  />
                  {/* Tamper Tag Continuity Bridge (NTAG424 DNA) */}
                  {params.nfcChipConfig === 'ntag424_dna' && (
                    <path
                      d={`M ${cx + 10} ${cy + (params.antennaOuterHeightMm * scale) / 2 - 15} L ${
                        cx + (params.nfcPocketWidthMm * scale) / 2 - 6
                      } ${cy + (params.nfcPocketHeightMm * scale) / 2 - 6}`}
                      stroke="#22D3EE"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                      fill="none"
                    />
                  )}
                  <text
                    x="14"
                    y="24"
                    fill="#64748B"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    Pocket: {params.nfcPocketWidthMm}x{params.nfcPocketHeightMm} mm
                  </text>
                  <text
                    x="14"
                    y="266"
                    fill="#38BDF8"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {params.nfcChipConfig === 'ntag424_dna'
                      ? 'IC: NTAG424 DNA + TT Loop'
                      : 'IC: NTAG215 Prototype'}
                  </text>
                </svg>
              </div>

              <div className="text-xs text-[#94A3B8] pt-3 border-t border-[#1B2332] flex justify-between font-mono">
                <span>Turns: {params.antennaTurns}</span>
                <span>Trace/Gap: {params.antennaTraceWidthMm}/{params.antennaTraceSpacingMm} mm</span>
                <span>Cu: {params.antennaCopperThicknessUm} µm</span>
              </div>
            </div>

            {/* Live Tuning Metrics & Editable Sliders */}
            <div className="lg:col-span-7 bg-[#11161F] border border-[#1B2332] rounded-lg p-5 flex flex-col justify-between space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-3 rounded bg-[#090C11] border border-[#1B2332]">
                  <div className="text-[11px] text-[#94A3B8]">Wheeler Inductance</div>
                  <div className="text-lg font-mono font-semibold text-white tabular-nums mt-0.5">
                    {metrics.estimatedInductanceUh} µH
                  </div>
                </div>
                <div className="p-3 rounded bg-[#090C11] border border-[#1B2332]">
                  <div className="text-[11px] text-[#94A3B8]">Target Tuning Cap</div>
                  <div className="text-lg font-mono font-semibold text-[#38BDF8] tabular-nums mt-0.5">
                    {metrics.requiredTuningCapacitancePf} pF
                  </div>
                </div>
                <div className="p-3 rounded bg-[#090C11] border border-[#1B2332]">
                  <div className="text-[11px] text-[#94A3B8]">Loaded Q-Factor</div>
                  <div className="text-lg font-mono font-semibold text-white tabular-nums mt-0.5">
                    {metrics.estimatedQFactor}
                  </div>
                </div>
                <div className="p-3 rounded bg-[#090C11] border border-[#1B2332]">
                  <div className="text-[11px] text-[#94A3B8]">Coil Trace Resistance</div>
                  <div className="text-lg font-mono font-semibold text-white tabular-nums mt-0.5">
                    {metrics.estimatedDcResistanceOhm} Ω
                  </div>
                </div>
                <div className="p-3 rounded bg-[#090C11] border border-[#1B2332]">
                  <div className="text-[11px] text-[#94A3B8]">Est. Closed Read Range</div>
                  <div className="text-lg font-mono font-semibold text-[#38BDF8] tabular-nums mt-0.5">
                    ~{metrics.estimatedReadRangeMm} mm
                  </div>
                </div>
                <div className="p-3 rounded bg-[#090C11] border border-[#1B2332]">
                  <div className="text-[11px] text-[#94A3B8]">Pocket Clearance</div>
                  <div
                    className={`text-sm font-mono font-semibold mt-1 ${
                      metrics.nfcFitInPocketOk ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {metrics.nfcFitInPocketOk ? 'PASS (>= 1.5 mm)' : 'CHECK MARGIN'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1B2332]">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#CBD5E1]">Antenna Outer Size</span>
                    <span className="font-mono text-[#38BDF8] tabular-nums">
                      {params.antennaOuterWidthMm.toFixed(1)} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    className="w-full vca-slider"
                    min={12}
                    max={24}
                    step={0.5}
                    value={params.antennaOuterWidthMm}
                    aria-label="Antenna Outer Size"
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onChangeParams({ ...params, antennaOuterWidthMm: v, antennaOuterHeightMm: v });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#CBD5E1]">Spiral Turns (N)</span>
                    <span className="font-mono text-[#38BDF8] tabular-nums">
                      {params.antennaTurns} turns
                    </span>
                  </div>
                  <input
                    type="range"
                    className="w-full vca-slider"
                    min={3}
                    max={10}
                    step={1}
                    value={params.antennaTurns}
                    aria-label="Spiral Turns"
                    onChange={(e) =>
                      onChangeParams({ ...params, antennaTurns: parseInt(e.target.value, 10) })
                    }
                  />
                </div>
              </div>

              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Engineering Note: Polycarbonate dielectric constant (εᵣ ≈ 2.9 at 13.56 MHz) shifts
                unloaded coil self-resonance downward by ~250–400 kHz once ultrasonically sealed.
                Inlay manufacturer must tune bare coil resonant frequency ~13.9 MHz in free air so
                the completed slab settles precisely at 13.56 MHz (confirm with VNA during EVT).
              </p>
            </div>
          </div>
        </section>

        {/* 02. Prototype vs Production NFC IC Comparison */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            02. Prototype (NTAG215) vs Production (NTAG424 DNA) Specification
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className={`rounded-lg border p-5 space-y-3 ${
                params.nfcChipConfig === 'ntag215'
                  ? 'bg-[#111926] border-[#0EA5E9]'
                  : 'bg-[#11161F] border-[#1B2332]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#94A3B8]" />
                  <span>Prototype: NXP NTAG215</span>
                </h3>
                <span className="text-xs font-mono text-[#94A3B8]">EVT / R&D Only</span>
              </div>
              <ul className="text-xs text-[#CBD5E1] space-y-2 leading-relaxed">
                <li>
                  <strong className="text-white">Security Model:</strong> 7-byte factory UID + static
                  NDEF URL record (`https://vcaslabs.com/v/VCA-26-00202`). Optional 32-bit password
                  lock for write protection only.
                </li>
                <li>
                  <strong className="text-amber-400">Critical Limitation:</strong> Does NOT provide
                  cryptographic anti-cloning. Static NDEF URLs and UIDs can be read and duplicated
                  onto blank Magic UID tags.
                </li>
                <li>
                  <strong className="text-white">Cost & Programming:</strong> Low inlay unit cost;
                  fast batch NDEF encoding via standard desktop USB NFC writer during prototyping.
                </li>
              </ul>
            </div>

            <div
              className={`rounded-lg border p-5 space-y-3 ${
                params.nfcChipConfig === 'ntag424_dna'
                  ? 'bg-[#111926] border-[#0EA5E9]'
                  : 'bg-[#11161F] border-[#1B2332]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#38BDF8]" />
                  <span>Production: NXP NTAG424 DNA (TT)</span>
                </h3>
                <span className="text-xs font-mono text-[#38BDF8]">Recommended Mass Prod.</span>
              </div>
              <ul className="text-xs text-[#CBD5E1] space-y-2 leading-relaxed">
                <li>
                  <strong className="text-white">Cryptographic SUN Messaging:</strong> Every phone
                  tap dynamically generates a unique encrypted PICCData + 8-byte AES-128 CMAC
                  signature + monotonic read counter in the URL query string.
                </li>
                <li>
                  <strong className="text-emerald-400">Anti-Cloning & Tamper Tag:</strong> VCA
                  backend verifies CMAC via HSM and rejects replayed counters. Optional Tamper Tag
                  (TT) loop across the ultrasonic seam reports physical opening.
                </li>
                <li>
                  <strong className="text-white">Manufacturing Requirement:</strong> Requires
                  HSM-backed key diversification station in factory provisioning line before slab
                  ultrasonic sealing.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 03. Tamper-Evident Joining Method Matrix */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            03. Tamper-Evident Assembly & Joining Method Comparison
          </h2>
          <div className="overflow-x-auto border border-[#1B2332] rounded-lg bg-[#11161F]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#1B2332] bg-[#0D121B] text-[#94A3B8]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Joining Architecture</th>
                  <th className="py-3 px-4 font-semibold">Tamper Evidence</th>
                  <th className="py-3 px-4 font-semibold">Cycle Time</th>
                  <th className="py-3 px-4 font-semibold">Card & Optical Safety</th>
                  <th className="py-3 px-4 font-semibold">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B2332]">
                {JOINING_METHODS.map((row) => (
                  <tr
                    key={row.method}
                    className={row.selected ? 'bg-[#0EA5E9]/8' : 'hover:bg-[#161E2E]/40'}
                  >
                    <td className="py-3 px-4 font-medium text-white">{row.method}</td>
                    <td className="py-3 px-4 text-[#CBD5E1]">{row.tamperEvidence}</td>
                    <td className="py-3 px-4 font-mono text-[#94A3B8] tabular-nums">
                      {row.cycleTime}
                    </td>
                    <td className="py-3 px-4 text-[#CBD5E1]">{row.cardSafety}</td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      {row.selected ? (
                        <span className="inline-flex items-center gap-1 text-[#38BDF8] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {row.verdict}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#64748B]">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {row.verdict}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 04. Production QA / QC Testing Protocol */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#38BDF8]" />
            <span>04. Production NFC & Mechanical Quality Control Procedure</span>
          </h2>
          <div className="overflow-x-auto border border-[#1B2332] rounded-lg bg-[#11161F]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#1B2332] bg-[#0D121B] text-[#94A3B8]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Gate ID</th>
                  <th className="py-3 px-4 font-semibold">Test Parameter</th>
                  <th className="py-3 px-4 font-semibold">Inspection Apparatus</th>
                  <th className="py-3 px-4 font-semibold">Measurable Pass/Fail Target</th>
                  <th className="py-3 px-4 font-semibold">Lot Sampling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B2332]">
                {QA_PROCEDURES.map((qc) => (
                  <tr key={qc.testId} className="hover:bg-[#161E2E]/40">
                    <td className="py-3 px-4 font-mono text-[#38BDF8] font-semibold whitespace-nowrap">
                      {qc.testId}
                    </td>
                    <td className="py-3 px-4 font-medium text-white">{qc.parameter}</td>
                    <td className="py-3 px-4 text-[#94A3B8]">{qc.method}</td>
                    <td className="py-3 px-4 font-mono text-[#E2E8F0]">{qc.criteria}</td>
                    <td className="py-3 px-4 text-[#94A3B8]">{qc.sampling}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
