import React, { useState } from 'react';
import { Download, FileCode2, FileText, Info, Printer } from 'lucide-react';
import {
  generateBomCsv,
  generateManufacturerRfqSpec,
  generateOpenScadSource,
  generateSlabDxf,
  generateSlabShellAsciiStl,
} from '../cad/cadExporters';
import { BomItem, EngineeringMetrics, POLYMER_SPECS } from '../cad/engineeringMath';
import { PolymerMaterialId, SlabParameters } from '../cad/types';

interface ManufacturingViewProps {
  params: SlabParameters;
  metrics: EngineeringMetrics;
  bom: BomItem[];
  onChangeParams: (next: SlabParameters) => void;
}

function triggerDownload(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ManufacturingView: React.FC<ManufacturingViewProps> = ({
  params,
  metrics,
  bom,
  onChangeParams,
}) => {
  const [exportNote, setExportNote] = useState<string | null>(null);
  const poly = POLYMER_SPECS[params.polymerGrade];

  const handleExportStl = () => {
    const stl = generateSlabShellAsciiStl(params);
    triggerDownload(`${params.serialNumber}_housing_shell.stl`, stl);
    setExportNote(`Exported ASCII STL (${params.serialNumber}_housing_shell.stl) from live dimensions.`);
  };

  const handleExportDxf = () => {
    const dxf = generateSlabDxf(params, metrics);
    triggerDownload(`${params.serialNumber}_2d_profiles.dxf`, dxf);
    setExportNote(`Exported AutoCAD R12 DXF (${params.serialNumber}_2d_profiles.dxf) with 4 CAD layers.`);
  };

  const handleExportScad = () => {
    const scad = generateOpenScadSource(params, metrics);
    triggerDownload(`${params.serialNumber}_parametric.scad`, scad);
    setExportNote(
      `Exported OpenSCAD script (${params.serialNumber}_parametric.scad) — open in FreeCAD to convert to native B-Rep STEP (.step).`
    );
  };

  const handleExportBom = () => {
    const csv = generateBomCsv(bom);
    triggerDownload(`${params.serialNumber}_BOM.csv`, csv, 'text/csv;charset=utf-8');
    setExportNote(`Exported 7-line Bill of Materials (${params.serialNumber}_BOM.csv).`);
  };

  const handleExportRfq = () => {
    const rfq = generateManufacturerRfqSpec(params, metrics, bom);
    triggerDownload(`${params.serialNumber}_RFQ_Specification.md`, rfq, 'text/markdown;charset=utf-8');
    setExportNote(`Exported Manufacturer RFQ Package (${params.serialNumber}_RFQ_Specification.md).`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#090C11] px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-[#1B2332] pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-mono text-[#38BDF8]">
              Stages B, F & G · Injection Moulding DFM & Manufacturer Handoff
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Manufacturing Engineering, Drawings & CAD Export Package
            </h1>
            <p className="text-sm text-[#94A3B8] max-w-2xl">
              Live dimensioned 2D engineering drawing, optical polymer material matrix, Bill of
              Materials, and real client-side CAD/RFQ file generation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportStl}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#11161F] hover:bg-[#192233] border border-[#1B2332] hover:border-[#0EA5E9] text-white rounded cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Export STL</span>
            </button>
            <button
              type="button"
              onClick={handleExportDxf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#11161F] hover:bg-[#192233] border border-[#1B2332] hover:border-[#0EA5E9] text-white rounded cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Export DXF</span>
            </button>
            <button
              type="button"
              onClick={handleExportScad}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#11161F] hover:bg-[#192233] border border-[#1B2332] hover:border-[#0EA5E9] text-white rounded cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>OpenSCAD (STEP Prep)</span>
            </button>
            <button
              type="button"
              onClick={handleExportBom}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#11161F] hover:bg-[#192233] border border-[#1B2332] hover:border-[#0EA5E9] text-white rounded cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>BOM CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportRfq}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download RFQ Spec</span>
            </button>
          </div>
        </div>

        {/* Honest STEP / CAD Interchange Disclosure */}
        <div className="bg-[#11161F] border border-[#1B2332] rounded-lg p-4 flex items-start gap-3 text-xs text-[#CBD5E1]">
          <Info className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-white">
              CAD Export Format & B-Rep STEP Interchange Transparency
            </div>
            <p className="text-[#94A3B8] leading-relaxed">
              This browser workstation directly generates watertight <strong>ASCII STL</strong>{' '}
              meshes, <strong>AutoCAD R12 DXF</strong> 2D profiles, <strong>BOM CSV</strong>, and
              editable <strong>OpenSCAD (.scad)</strong> parametric solid source. Native NURBS{' '}
              <strong>STEP (.step/.stp)</strong> B-Rep files require a desktop solid-modeling kernel
              (e.g., FreeCAD OpenSCAD Workbench or SolidWorks); use the exported{' '}
              <code className="text-[#38BDF8]">.scad</code> +{' '}
              <code className="text-[#38BDF8]">.dxf</code> files for lossless STEP conversion prior
              to tool steel cutting.
            </p>
            {exportNote && (
              <div className="font-mono text-emerald-400 pt-1">{exportNote}</div>
            )}
          </div>
        </div>

        {/* 01. Live Dimensioned 2D Engineering Blueprint */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              01. Live 2D Dimensioned Engineering Drawing (Units: mm)
            </h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#1B2332] bg-[#11161F] hover:border-[#38BDF8] text-[#CBD5E1] rounded cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Engineering Sheet</span>
            </button>
          </div>

          <div className="bg-[#0D121B] border border-[#1B2332] rounded-lg p-6 overflow-x-auto">
            <svg
              viewBox="0 0 820 440"
              className="w-full min-w-[680px] h-auto"
              role="img"
              aria-label="VCA Slab 2D Dimensioned Blueprint"
            >
              {/* Title Block Frame */}
              <rect x="10" y="10" width="800" height="420" fill="#090C11" stroke="#1E293B" strokeWidth="1.5" />

              {/* FRONT ELEVATION (Left) */}
              <g transform="translate(150, 210)">
                {/* Outer Chamfered VCA Silhouette (scaled 2.2x) */}
                {(() => {
                  const s = 2.2;
                  const hw = (params.overallWidthMm / 2) * s;
                  const hh = (params.overallHeightMm / 2) * s;
                  const c = params.shoulderChamferMm * s;
                  const bc = c * 0.58;
                  const pts = `${-hw + bc},${-hh} ${hw - bc},${-hh} ${hw},${-hh + bc} ${hw},${hh - c} ${hw - c},${hh} ${-hw + c},${hh} ${-hw},${hh - c} ${-hw},${-hh + bc}`;
                  const cw = metrics.internalCavityWidthMm * s;
                  const ch = metrics.internalCavityHeightMm * s;
                  const lw = params.labelWidthMm * s;
                  const lh = params.labelHeightMm * s;
                  const pw = params.nfcPocketWidthMm * s;
                  const ph = params.nfcPocketHeightMm * s;

                  return (
                    <>
                      <polygon points={pts} fill="none" stroke="#E2E8F0" strokeWidth="1.8" />
                      {/* Card Cavity */}
                      <rect
                        x={-cw / 2}
                        y={14 * s - ch / 2}
                        width={cw}
                        height={ch}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="1.2"
                        strokeDasharray="4 2"
                      />
                      {/* Label Bay */}
                      <rect
                        x={-lw / 2}
                        y={-hh + 14}
                        width={lw}
                        height={lh}
                        fill="none"
                        stroke="#94A3B8"
                        strokeWidth="1.2"
                      />
                      {/* NFC Pocket */}
                      <rect
                        x={lw / 2 - pw - 4}
                        y={-hh + 14 + (lh - ph) / 2}
                        width={pw}
                        height={ph}
                        fill="rgba(14,165,233,0.12)"
                        stroke="#0EA5E9"
                        strokeWidth="1.4"
                      />
                      {/* Dimension Callouts */}
                      <line x1={-hw} y1={hh + 18} x2={hw} y2={hh + 18} stroke="#64748B" strokeWidth="1" />
                      <text x="0" y={hh + 32} fill="#38BDF8" fontSize="11" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
                        {params.overallWidthMm.toFixed(2)} mm (±{params.assemblyToleranceMm.toFixed(2)})
                      </text>
                      <line x1={-hw - 22} y1={-hh} x2={-hw - 22} y2={hh} stroke="#64748B" strokeWidth="1" />
                      <text
                        x={-hw - 28}
                        y="0"
                        fill="#38BDF8"
                        fontSize="11"
                        textAnchor="middle"
                        transform={`rotate(-90, ${-hw - 28}, 0)`}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {params.overallHeightMm.toFixed(2)} mm
                      </text>
                      <text x="0" y={14 * s} fill="#94A3B8" fontSize="10" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
                        CAVITY: {metrics.internalCavityWidthMm} × {metrics.internalCavityHeightMm} mm
                      </text>
                      <text x="0" y={-hh - 12} fill="#F8FAFC" fontSize="11" textAnchor="middle" fontFamily="Outfit, sans-serif">
                        FRONT ELEVATION (PROPOSED)
                      </text>
                    </>
                  );
                })()}
              </g>

              {/* SIDE PROFILE & WALL STACKUP (Center) */}
              <g transform="translate(380, 210)">
                {(() => {
                  const s = 2.2;
                  const hh = (params.overallHeightMm / 2) * s;
                  const t = params.overallThicknessMm * 4.5;
                  const wt = params.wallThicknessMm * 4.5;
                  return (
                    <>
                      <rect x={-t / 2} y={-hh} width={t} height={hh * 2} fill="none" stroke="#E2E8F0" strokeWidth="1.6" />
                      <line x1={-t / 2 + wt} y1={-hh + 10} x2={-t / 2 + wt} y2={hh - 10} stroke="#38BDF8" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1={t / 2 - wt} y1={-hh + 10} x2={t / 2 - wt} y2={hh - 10} stroke="#38BDF8" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="0" y={hh + 26} fill="#38BDF8" fontSize="11" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
                        T = {params.overallThicknessMm.toFixed(2)} mm
                      </text>
                      <text x="0" y={-hh - 12} fill="#F8FAFC" fontSize="11" textAnchor="middle" fontFamily="Outfit, sans-serif">
                        SIDE SECTION A-A
                      </text>
                    </>
                  );
                })()}
              </g>

              {/* ENGINEERING TITLE BLOCK (Right) */}
              <g transform="translate(470, 32)">
                <rect x="0" y="0" width="318" height="356" fill="#11161F" stroke="#1E293B" strokeWidth="1.2" />
                <text x="16" y="28" fill="#38BDF8" fontSize="13" fontWeight="700" fontFamily="Outfit, sans-serif">
                  VCA — VERIFIED CARD AUTHORITY
                </text>
                <text x="16" y="48" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  DWG NO: {params.serialNumber}-DFM-REV1
                </text>
                <line x1="16" y1="62" x2="302" y2="62" stroke="#1E293B" />

                <text x="16" y="88" fill="#CBD5E1" fontSize="11" fontFamily="JetBrains Mono, monospace">
                  RESIN: {poly.name}
                </text>
                <text x="16" y="108" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  SHRINKAGE: {metrics.nominalShrinkagePct}% (TOOLING COMP.)
                </text>
                <text x="16" y="128" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  TOOL CAVITY: {metrics.compensatedToolWidthMm} × {metrics.compensatedToolHeightMm} mm
                </text>
                <text x="16" y="148" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  WALL THICKNESS: {params.wallThicknessMm.toFixed(2)} mm
                </text>
                <text x="16" y="168" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  DRAFT ANGLE: {params.draftAngleDeg.toFixed(1)}° MIN
                </text>
                <text x="16" y="188" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  CAVITY DEPTH: {metrics.internalCavityDepthMm} mm
                </text>
                <text x="16" y="208" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  EST. PART MASS: {metrics.estimatedTotalMassG} g
                </text>
                <text x="16" y="228" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  CLAMP FORCE (2-CAV): ~{metrics.estimatedClampingForceTons} TONS
                </text>
                <line x1="16" y1="248" x2="302" y2="248" stroke="#1E293B" />
                <text x="16" y="274" fill="#F8FAFC" fontSize="10" fontWeight="600" fontFamily="JetBrains Mono, monospace">
                  SURFACE FINISH REQUIREMENTS:
                </text>
                <text x="16" y="294" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  1. CARD WINDOW: SPI A-1 OPTICAL POLISH
                </text>
                <text x="16" y="312" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  2. PERIMETER BEZEL: VDI 27 MATTE
                </text>
                <text x="16" y="336" fill="#F59E0B" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  STATUS: PROPOSED · CONFIRM W/ MOULDER
                </text>
              </g>
            </svg>
          </div>
        </section>

        {/* 02. Optical Polymer Comparison Matrix */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            02. Optical Polymer Selection Matrix (Click Grade to Update 3D Model)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(Object.keys(POLYMER_SPECS) as PolymerMaterialId[]).map((key) => {
              const spec = POLYMER_SPECS[key];
              const isSelected = params.polymerGrade === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChangeParams({ ...params, polymerGrade: key })}
                  className={`text-left rounded-lg border p-5 transition-colors cursor-pointer space-y-3 ${
                    isSelected
                      ? 'bg-[#111926] border-[#0EA5E9]'
                      : 'bg-[#11161F] border-[#1B2332] hover:border-[#334155]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{spec.name}</h3>
                      <div className="text-[11px] font-mono text-[#94A3B8] mt-0.5">
                        {spec.gradeExample}
                      </div>
                    </div>
                    {spec.recommended && (
                      <span className="text-[11px] font-mono text-[#38BDF8] shrink-0">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-[#1B2332]">
                    <div>
                      <span className="text-[#64748B]">Transmittance: </span>
                      <span className="text-white">{spec.lightTransmittancePct}%</span>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Shrinkage: </span>
                      <span className="text-white">
                        {spec.moldShrinkageMinPct}–{spec.moldShrinkageMaxPct}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Ultrasonic: </span>
                      <span className="text-white">{spec.ultrasonicWeldability}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Est. Resin: </span>
                      <span className="text-white">${spec.estimatedResinCostPerKgUsd}/kg</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">{spec.notes}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 03. Bill of Materials */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            03. Live Production Bill of Materials (BOM)
          </h2>
          <div className="overflow-x-auto border border-[#1B2332] rounded-lg bg-[#11161F]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#1B2332] bg-[#0D121B] text-[#94A3B8]">
                <tr>
                  <th className="py-3 px-4 font-semibold">#</th>
                  <th className="py-3 px-4 font-semibold">Part Number</th>
                  <th className="py-3 px-4 font-semibold">Component Description</th>
                  <th className="py-3 px-4 font-semibold">Proposed Material</th>
                  <th className="py-3 px-4 font-semibold">Qty</th>
                  <th className="py-3 px-4 font-semibold">Mass (g)</th>
                  <th className="py-3 px-4 font-semibold">Confirmation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B2332]">
                {bom.map((row) => (
                  <tr key={row.partNumber} className="hover:bg-[#161E2E]/40">
                    <td className="py-3 px-4 font-mono text-[#64748B] tabular-nums">{row.itemNo}</td>
                    <td className="py-3 px-4 font-mono text-[#38BDF8] whitespace-nowrap">
                      {row.partNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-white">{row.description}</td>
                    <td className="py-3 px-4 text-[#CBD5E1]">{row.material}</td>
                    <td className="py-3 px-4 font-mono text-white tabular-nums">{row.qty}</td>
                    <td className="py-3 px-4 font-mono text-white tabular-nums">
                      {row.unitMassG.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-400 whitespace-nowrap">
                      {row.specStatus}
                    </td>
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
