import React, { useState } from 'react';
import { CheckCircle2, Lock, MessageSquare, Send, ShieldCheck, X } from 'lucide-react';
import { ContactInquiryTopic, validateContactRelayInput } from '../cad/contactRelay';

interface MessageMeOverlayProps {
  serialNumber: string;
  contactEmail: string;
}

interface RelayReceipt {
  receiptId: string;
  receivedAt: string;
  routedTo: string;
  statusNote: string;
}

const TOPICS: ContactInquiryTopic[] = [
  'Manufacturing / DFM Inquiry',
  'Tooling Quote',
  '3D CAD & Label Prototype',
  'NFC Hardware Engineering',
  'General Message',
];

export const MessageMeOverlay: React.FC<MessageMeOverlayProps> = ({
  serialNumber,
  contactEmail,
}) => {
  const [open, setOpen] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [company, setCompany] = useState('');
  const [replyContact, setReplyContact] = useState('');
  const [topic, setTopic] = useState<ContactInquiryTopic>('Manufacturing / DFM Inquiry');
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<RelayReceipt | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validateContactRelayInput({
      senderName,
      company,
      replyContact,
      topic,
      serialNumber,
      message,
    });

    if (!validation.ok || !validation.payload) {
      setErrorMsg(validation.error || 'Please check the required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        receiptId?: string;
        receivedAt?: string;
        routedTo?: string;
        statusNote?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Unable to send message right now.');
        return;
      }

      setReceipt({
        receiptId: data.receiptId || 'VCA-MSG-SENT',
        receivedAt: data.receivedAt || new Date().toISOString(),
        routedTo: data.routedTo || 'VCA Private Direct Line (Number Hidden)',
        statusNote:
          data.statusNote ||
          'Delivered directly to the private VCA line without exposing the recipient phone number.',
      });
      setMessage('');
    } catch {
      setErrorMsg('Network error sending message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end">
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Message VCA Directly"
          data-testid="message-me-popup"
          className="mb-3 w-[calc(100vw-2rem)] sm:w-[390px] rounded-xl border border-[#1E3A5F] bg-[#0B0F17] text-[#F1F5F9] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#1B2332] bg-[#090C11] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md bg-[#0EA5E9]/15 border border-[#38BDF8]/40 flex items-center justify-center shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-[#38BDF8]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-semibold text-white truncate">Message Me Directly</h2>
                <p className="text-[11px] text-[#94A3B8] truncate">
                  Private direct line · {serialNumber}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Message Me popup"
              className="p-1.5 rounded border border-[#1B2332] bg-[#11161F] text-[#94A3B8] hover:text-white hover:border-[#38BDF8] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Privacy Shield Banner */}
          <div className="px-4 py-2 bg-[#081322] border-b border-[#1E3A5F]/70 flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-[#7DD3FC]">
              <Lock className="w-3 h-3 shrink-0" />
              <span>Connected to private SMS line (number hidden)</span>
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          </div>

          {receipt ? (
            <div className="p-4 space-y-3" data-testid="message-me-receipt">
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Direct Message Sent</span>
                </div>
                <div className="font-mono text-[11px] text-white">
                  Receipt: {receipt.receiptId}
                </div>
                <div className="text-[11px] text-[#CBD5E1]">{receipt.routedTo}</div>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed">{receipt.statusNote}</p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-[11px] font-mono text-[#38BDF8] hover:underline"
                >
                  {contactEmail}
                </a>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-[#1E3A5F] bg-[#11161F] hover:border-[#38BDF8] text-white cursor-pointer"
                >
                  Send Another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="msgme-name" className="block text-[11px] font-medium text-[#CBD5E1]">
                    Your Name *
                  </label>
                  <input
                    id="msgme-name"
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Alex Chen"
                    className="w-full bg-[#090C11] border border-[#1B2332] focus:border-[#0EA5E9] rounded-md px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="msgme-company" className="block text-[11px] font-medium text-[#94A3B8]">
                    Company / Vendor
                  </label>
                  <input
                    id="msgme-company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Apex Moulding"
                    className="w-full bg-[#090C11] border border-[#1B2332] focus:border-[#0EA5E9] rounded-md px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="msgme-reply" className="block text-[11px] font-medium text-[#CBD5E1]">
                    Your Email or Phone *
                  </label>
                  <input
                    id="msgme-reply"
                    type="text"
                    required
                    value={replyContact}
                    onChange={(e) => setReplyContact(e.target.value)}
                    placeholder="reply@company.com"
                    className="w-full bg-[#090C11] border border-[#1B2332] focus:border-[#0EA5E9] rounded-md px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="msgme-topic" className="block text-[11px] font-medium text-[#CBD5E1]">
                    Inquiry Topic
                  </label>
                  <select
                    id="msgme-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value as ContactInquiryTopic)}
                    className="w-full bg-[#090C11] border border-[#1B2332] focus:border-[#0EA5E9] rounded-md px-2 py-1.5 text-xs text-white outline-none"
                  >
                    {TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="msgme-body" className="block text-[11px] font-medium text-[#CBD5E1]">
                  Message *
                </label>
                <textarea
                  id="msgme-body"
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share tooling tolerances, resin availability, label prototype questions, or schedule a call..."
                  className="w-full bg-[#090C11] border border-[#1B2332] focus:border-[#0EA5E9] rounded-md px-2.5 py-2 text-xs text-white outline-none resize-none"
                />
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-300"
                >
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-[11px] font-mono text-[#94A3B8] hover:text-[#38BDF8]"
                >
                  {contactEmail}
                </a>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 text-white cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Sending...' : 'Send Message'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Floating Message Me Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? 'Hide Message Me overlay' : 'Open Message Me overlay'}
        data-testid="message-me-trigger"
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#38BDF8]/60 bg-[#0B1422] hover:bg-[#0EA5E9] text-white shadow-2xl transition-colors cursor-pointer"
      >
        <MessageSquare className="w-4 h-4 text-[#38BDF8]" />
        <span className="text-xs font-semibold">Message Me</span>
      </button>
    </div>
  );
};
