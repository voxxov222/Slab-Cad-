import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDirectSmsBody,
  redactProtectedNumber,
  validateContactRelayInput,
} from './contactRelay';

test('validateContactRelayInput rejects empty or incomplete contact fields', () => {
  const missingName = validateContactRelayInput({
    senderName: 'A',
    replyContact: 'mfg@example.com',
    message: 'Need a quote for 5k units.',
  });
  assert.equal(missingName.ok, false);

  const missingReply = validateContactRelayInput({
    senderName: 'Alex Chen',
    replyContact: 'hi',
    message: 'Need a quote for 5k units.',
  });
  assert.equal(missingReply.ok, false);

  const shortMsg = validateContactRelayInput({
    senderName: 'Alex Chen',
    replyContact: 'mfg@example.com',
    message: 'Hi',
  });
  assert.equal(shortMsg.ok, false);
});

test('validateContactRelayInput sanitizes payload and formatDirectSmsBody structures SMS text', () => {
  const res = validateContactRelayInput({
    senderName: '  Alex Chen  ',
    company: 'Apex Moulding Ltd.',
    replyContact: 'alex@apexmould.example',
    topic: 'Tooling Quote',
    serialNumber: 'VCA-26-00202<script>',
    message: 'Can confirm SPI A-1 polish on 2-cavity Makrolon mould.',
  });
  assert.equal(res.ok, true);
  assert.ok(res.payload);
  assert.equal(res.payload.serialNumber, 'VCA-26-00202script');
  assert.equal(res.payload.topic, 'Tooling Quote');

  const sms = formatDirectSmsBody(res.payload);
  assert.match(sms, /\[VCA Slab Studio · VCA-26-00202script\]/);
  assert.match(sms, /From: Alex Chen \(Apex Moulding Ltd\.\)/);
  assert.match(sms, /Reply: alex@apexmould\.example/);
});

test('redactProtectedNumber strips formatted or raw protected phone digits from strings', () => {
  const sampleSecret = '5550199999';
  const raw = 'Delivery failed to +1 (555) 019-9999 and 5550199999 and 555.019.9999.';
  const cleaned = redactProtectedNumber(raw, sampleSecret);
  assert.doesNotMatch(cleaned, /555/);
  assert.doesNotMatch(cleaned, /9999/);
  assert.match(cleaned, /\[PROTECTED-LINE\]/);
});
