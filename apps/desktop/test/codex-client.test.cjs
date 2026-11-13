const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractMessages, redact } = require('../codex-client.cjs');

test('review text masks common credentials and excludes tool output and attachments', () => {
  const secret = `AQ.${'a'.repeat(32)}`;
  const result = extractMessages([{ items: [
    { type: 'userMessage', content: [{ type: 'text', text: `Please continue. ${secret}` }, { type: 'localImage', path: 'private.png' }] },
    { type: 'reasoning', content: ['private reasoning'] },
    { type: 'commandExecution', aggregatedOutput: 'private command output' },
    { type: 'agentMessage', text: 'The next step is ready.' }
  ] }]);
  assert.equal(result.messageCount, 2);
  assert.equal(result.omittedAttachments, 1);
  assert.ok(result.text.includes('[REDACTED SECRET]'));
  assert.ok(!result.text.includes(secret));
  assert.ok(!result.text.includes('private command output'));
  assert.ok(!result.text.includes('private reasoning'));
});

test('empty or oversized chats are rejected rather than silently truncated', () => {
  assert.throws(() => extractMessages([{ items: [{ type: 'commandExecution' }] }]), /No text messages/);
  assert.throws(() => extractMessages([{ items: [{ type: 'agentMessage', text: 'x'.repeat(240001) }] }]), /240,000-character/);
});

test('credential assignments and bearer values are masked', () => {
  for (const value of [`password=${'x'.repeat(20)}`, `API key: ${'a'.repeat(30)}`, `Bearer ${'y'.repeat(32)}`, `gsk_${'z'.repeat(32)}`]) {
    assert.notEqual(redact(value), value);
  }
});
