export type ContactInquiryTopic =
  | 'Manufacturing / DFM Inquiry'
  | 'Tooling Quote'
  | '3D CAD & Label Prototype'
  | 'NFC Hardware Engineering'
  | 'General Message';

export interface ContactRelayInput {
  senderName: string;
  company?: string;
  replyContact: string;
  topic?: string;
  serialNumber?: string;
  message: string;
}

export interface ValidatedContactPayload {
  senderName: string;
  company: string;
  replyContact: string;
  topic: string;
  serialNumber: string;
  message: string;
}

export interface ContactValidationResult {
  ok: boolean;
  error?: string;
  payload?: ValidatedContactPayload;
}

const ALLOWED_TOPICS = new Set<string>([
  'Manufacturing / DFM Inquiry',
  'Tooling Quote',
  '3D CAD & Label Prototype',
  'NFC Hardware Engineering',
  'General Message',
]);

export function validateContactRelayInput(raw: ContactRelayInput): ContactValidationResult {
  const senderName = (raw.senderName || '').trim().slice(0, 80);
  const company = (raw.company || '').trim().slice(0, 100);
  const replyContact = (raw.replyContact || '').trim().slice(0, 120);
  const topicRaw = (raw.topic || '').trim();
  const topic = ALLOWED_TOPICS.has(topicRaw) ? topicRaw : 'Manufacturing / DFM Inquiry';
  const serialNumber =
    (raw.serialNumber || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28) || 'VCA-26-00202';
  const message = (raw.message || '').trim().slice(0, 1500);

  if (senderName.length < 2) {
    return { ok: false, error: 'Please enter your name (at least 2 characters).' };
  }
  if (replyContact.length < 5) {
    return {
      ok: false,
      error: 'Please enter a valid email or phone number so VCA can reply.',
    };
  }
  if (message.length < 5) {
    return { ok: false, error: 'Please enter a message (at least 5 characters).' };
  }

  return {
    ok: true,
    payload: {
      senderName,
      company,
      replyContact,
      topic,
      serialNumber,
      message,
    },
  };
}

export function formatDirectSmsBody(payload: ValidatedContactPayload): string {
  const org = payload.company ? ` (${payload.company})` : '';
  return [
    `[VCA Slab Studio · ${payload.serialNumber}]`,
    `Topic: ${payload.topic}`,
    `From: ${payload.senderName}${org}`,
    `Reply: ${payload.replyContact}`,
    `Message: ${payload.message}`,
  ].join('\n');
}

export function redactProtectedNumber(input: string, protectedDigits: string): string {
  const digits = protectedDigits.replace(/\D/g, '');
  if (!digits) return input;
  const last10 = digits.length > 10 ? digits.slice(-10) : digits;
  const area = last10.slice(0, 3);
  const mid = last10.slice(3, 6);
  const end = last10.slice(6, 10);
  const pattern = new RegExp(
    `(?:\\+?1[\\s.-]*)?(?:\\(?${area}\\)?[\\s.-]*${mid}[\\s.-]*${end}|${digits})`,
    'g'
  );
  return input.replace(pattern, '[PROTECTED-LINE]');
}
