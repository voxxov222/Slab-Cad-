import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { NfcTapSimulationResult, simulateNfcTap } from '../cad/nfcCrypto';
import { SAMPLE_CARD_ART_PATH } from '../cad/slabTextures';
import { SlabParameters } from '../cad/types';

interface DigitalPassportViewProps {
  params: SlabParameters;
}

interface OwnershipEvent {
  date: string;
  event: string;
  actor: string;
  txHash: string;
}

export const DigitalPassportView: React.FC<DigitalPassportViewProps> = ({ params }) => {
  const [counter, setCounter] = useState<number>(42);
  const [scenario, setScenario] = useState<'normal' | 'clone_replay' | 'tampered_seal' | 'revoked'>(
    'normal'
  );
  const [tapResult, setTapResult] = useState<NfcTapSimulationResult>(() =>
    simulateNfcTap({
      serialNumber: params.serialNumber,
      chipType: params.nfcChipConfig,
      uidHex: '04A39B72C15080',
      counter: 42,
      scenario: 'normal',
    })
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [currentOwner, setCurrentOwner] = useState<string>('0x71C9...9A4E (Vault Custody)');
  const [transferAddress, setTransferAddress] = useState<string>('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [history, setHistory] = useState<OwnershipEvent[]>([
    {
      date: '2026-10-14',
      event: 'Encapsulated & Cryptographically Provisioned',
      actor: 'VCA Certification Lab · Grade VCA 10',
      txHash: '0x94b2...e81c',
    },
    {
      date: '2026-10-15',
      event: 'ERC-721 Digital Passport Minted',
      actor: '0x71C9...9A4E (Vault Custody)',
      txHash: '0x4f18...3d70',
    },
  ]);

  useEffect(() => {
    QRCode.toDataURL(`https://vcaslabs.com/v/${params.serialNumber}`, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'H',
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [params.serialNumber]);

  const runTap = (nextScenario: 'normal' | 'clone_replay' | 'tampered_seal' | 'revoked') => {
    const nextCounter = nextScenario === 'normal' ? counter + 1 : counter;
    setCounter(nextCounter);
    setScenario(nextScenario);
    const res = simulateNfcTap({
      serialNumber: params.serialNumber,
      chipType: params.nfcChipConfig,
      uidHex: '04A39B72C15080',
      counter: nextCounter,
      scenario: nextScenario,
    });
    setTapResult(res);
  };

  useEffect(() => {
    setTapResult(
      simulateNfcTap({
        serialNumber: params.serialNumber,
        chipType: params.nfcChipConfig,
        uidHex: '04A39B72C15080',
        counter,
        scenario,
      })
    );
  }, [params.serialNumber, params.nfcChipConfig]);

  const handleTransferOwnership = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = transferAddress.trim();
    if (cleaned.length < 6) {
      setTransferError('Enter a valid wallet address (0x...) or VCA Collector ID.');
      return;
    }
    setTransferError(null);
    setCurrentOwner(cleaned);
    setHistory((prev) => [
      {
        date: new Date().toISOString().slice(0, 10),
        event: 'Digital Passport & Physical Custody Transferred',
        actor: cleaned,
        txHash: '0x' + Math.random().toString(16).slice(2, 6) + '...' + Math.random().toString(16).slice(2, 6),
      },
      ...prev,
    ]);
    setTransferAddress('');
  };

  const isAuthentic = tapResult.outcome === 'AUTHENTIC_NTAG424';
  const isProtoWarn = tapResult.outcome === 'PROTOTYPE_NTAG215_UNVERIFIED_CRYPTO';

  return (
    <div className="flex-1 overflow-y-auto bg-[#090C11] px-6 py-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Customer Mobile NFC Tap Preview (vcaslabs.com Experience) */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-[390px] rounded-[28px] border-2 border-[#263248] bg-[#0B0F17] p-5 shadow-2xl space-y-5">
            {/* Mobile Brand Header */}
            <div className="flex items-center justify-between border-b border-[#1B2332] pb-3">
              <div>
                <div className="text-base font-bold tracking-tight text-white">VCA</div>
                <div className="text-[11px] font-mono text-[#94A3B8]">vcaslabs.com/verify</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-[#38BDF8] font-semibold">
                  {params.serialNumber}
                </div>
                <div className="text-[11px] text-[#94A3B8]">Cert Date: 2026-10-14</div>
              </div>
            </div>

            {/* Cryptographic Verification Banner */}
            <div
              className={`rounded-lg border p-3.5 flex items-start gap-3 ${
                isAuthentic
                  ? 'bg-emerald-950/35 border-emerald-500/40'
                  : isProtoWarn
                    ? 'bg-amber-950/35 border-amber-500/40'
                    : 'bg-rose-950/40 border-rose-500/50'
              }`}
            >
              {isAuthentic ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    isProtoWarn ? 'text-amber-400' : 'text-rose-400'
                  }`}
                />
              )}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-white">{tapResult.headline}</div>
                <p className="text-[11px] text-[#CBD5E1] leading-relaxed">{tapResult.detail}</p>
              </div>
            </div>

            {/* Certified Card Preview */}
            <div className="flex gap-4 items-center bg-[#11161F] border border-[#1B2332] rounded-lg p-3.5">
              <div className="w-20 h-28 shrink-0 rounded overflow-hidden border border-[#263248] bg-[#090C11]">
                <img
                  src={SAMPLE_CARD_ART_PATH}
                  alt={params.cardTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="text-xs font-mono text-[#38BDF8] font-semibold">
                  {params.gradeLabel}
                </div>
                <div className="text-sm font-semibold text-white truncate">{params.cardTitle}</div>
                <div className="text-xs text-[#94A3B8] truncate">{params.cardSet}</div>
                <div className="text-[10px] font-mono text-[#64748B] pt-1 leading-snug">
                  CEN 10 · COR 10 · EDG 10 · SUR 9.5
                </div>
              </div>
            </div>

            {/* Blockchain & Ownership Snapshot */}
            <div className="bg-[#11161F] border border-[#1B2332] rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">NFT Token Anchor</span>
                <span className="font-mono text-[#38BDF8] inline-flex items-center gap-1">
                  Polygon ERC-721 #202 <ExternalLink className="w-3 h-3" />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Registered Owner</span>
                <span className="font-mono text-white truncate max-w-[190px]">{currentOwner}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Physical NFC UID</span>
                <span className="font-mono text-white">{tapResult.uidHex}</span>
              </div>
              {tapResult.cmacHex && (
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">AES-128 CMAC</span>
                  <span className="font-mono text-emerald-400">
                    {tapResult.cmacHex} (#{tapResult.readCounter})
                  </span>
                </div>
              )}
            </div>

            {/* QR Fallback & Certificate Action */}
            <div className="flex items-center justify-between gap-3 pt-1">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${params.serialNumber}`}
                  className="w-16 h-16 rounded bg-white p-1 shrink-0"
                />
              )}
              <div className="text-[11px] text-[#94A3B8] space-y-1 flex-1">
                <div className="font-medium text-white">Physical-to-Digital Binding</div>
                <p className="leading-snug">
                  Scan QR or tap upper-right NFC emblem to verify live cryptographic signature.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive NFC Security Simulator & Blockchain Provenance Controls */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-1.5 border-b border-[#1B2332] pb-5">
            <div className="text-xs font-mono text-[#38BDF8]">
              Stage D & Customer Verification Portal
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Physical-to-Digital NFC Verification & Blockchain Provenance
            </h1>
            <p className="text-sm text-[#94A3B8]">
              Test how the VCA backend validates dynamic SUN/CMAC payloads, blocks UID cloning,
              detects broken tamper loops, and manages verified ERC-721 custody transfers.
            </p>
          </div>

          {/* Interactive Tap Scenario Buttons */}
          <div className="bg-[#11161F] border border-[#1B2332] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#38BDF8]" />
                <span>01. Simulate Smartphone NFC Tap Scenarios</span>
              </h2>
              <span className="text-xs font-mono text-[#94A3B8]">
                Active IC: {params.nfcChipConfig === 'ntag424_dna' ? 'NTAG424 DNA' : 'NTAG215'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => runTap('normal')}
                className={`px-3 py-2 text-xs font-medium rounded border cursor-pointer ${
                  scenario === 'normal'
                    ? 'bg-[#0EA5E9] border-[#38BDF8] text-white'
                    : 'bg-[#090C11] border-[#1B2332] text-[#CBD5E1] hover:border-[#38BDF8]'
                }`}
              >
                Valid Tap
              </button>
              <button
                type="button"
                onClick={() => runTap('clone_replay')}
                className={`px-3 py-2 text-xs font-medium rounded border cursor-pointer ${
                  scenario === 'clone_replay'
                    ? 'bg-rose-600 border-rose-400 text-white'
                    : 'bg-[#090C11] border-[#1B2332] text-[#CBD5E1] hover:border-rose-500'
                }`}
              >
                Simulate Clone
              </button>
              <button
                type="button"
                onClick={() => runTap('tampered_seal')}
                className={`px-3 py-2 text-xs font-medium rounded border cursor-pointer ${
                  scenario === 'tampered_seal'
                    ? 'bg-rose-600 border-rose-400 text-white'
                    : 'bg-[#090C11] border-[#1B2332] text-[#CBD5E1] hover:border-rose-500'
                }`}
              >
                Broken Seal
              </button>
              <button
                type="button"
                onClick={() => runTap('revoked')}
                className={`px-3 py-2 text-xs font-medium rounded border cursor-pointer ${
                  scenario === 'revoked'
                    ? 'bg-rose-600 border-rose-400 text-white'
                    : 'bg-[#090C11] border-[#1B2332] text-[#CBD5E1] hover:border-rose-500'
                }`}
              >
                Revoked Serial
              </button>
            </div>

            {/* Decoded Payload & Verification Checklist */}
            <div className="p-3 rounded bg-[#090C11] border border-[#1B2332] font-mono text-[11px] text-[#38BDF8] break-all">
              {tapResult.ndfUrl}
            </div>

            <div className="space-y-2">
              {tapResult.checks.map((chk) => (
                <div
                  key={chk.label}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-[#1B2332] last:border-b-0"
                >
                  <span className="flex items-center gap-2 text-white font-medium">
                    {chk.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    {chk.label}
                  </span>
                  <span className="font-mono text-[#94A3B8]">{chk.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ownership Transfer & Provenance Audit Log */}
          <div className="bg-[#11161F] border border-[#1B2332] rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-[#38BDF8]" />
              <span>02. Ownership Transfer & Verification Audit Trail</span>
            </h2>

            <form onSubmit={handleTransferOwnership} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={transferAddress}
                onChange={(e) => setTransferAddress(e.target.value)}
                placeholder="New Owner Wallet (0x...) or VCA Collector Handle"
                aria-label="New Owner Wallet or Collector Handle"
                className="flex-1 bg-[#090C11] border border-[#1B2332] focus:border-[#0EA5E9] rounded px-3 py-2 text-xs text-white outline-none font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded whitespace-nowrap cursor-pointer"
              >
                Transfer Custody
              </button>
            </form>
            {transferError && <p className="text-xs text-rose-400">{transferError}</p>}

            <div className="space-y-2.5 pt-2">
              {history.map((item, idx) => (
                <div
                  key={`${item.txHash}-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs py-2 border-b border-[#1B2332] last:border-b-0"
                >
                  <div>
                    <div className="font-medium text-white">{item.event}</div>
                    <div className="text-[#94A3B8]">{item.actor}</div>
                  </div>
                  <div className="font-mono text-[11px] text-[#64748B] sm:text-right">
                    <div>{item.date}</div>
                    <div className="text-[#38BDF8]">{item.txHash}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
