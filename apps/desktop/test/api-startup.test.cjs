const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { isRelayHealth, startLocalApi } = require('../api-startup.cjs');

const relayHealth = () => new Response(JSON.stringify({ ok: true, service: 'relay-ai', version: '0.1.0' }), { status: 200 });
const foreignHealth = () => new Response(JSON.stringify({ ok: true, service: 'another-app' }), { status: 200 });

test('local startup accepts only a Relay API health response', async () => {
  assert.equal(isRelayHealth({ ok: true, service: 'relay-ai' }), true);
  assert.equal(isRelayHealth({ ok: true, service: 'another-app' }), false);
  assert.equal(isRelayHealth({ ok: true }), false);
});

test('desktop reuses an already-running Relay API without starting another process', async () => {
  let spawned = false;
  const result = await startLocalApi({
    apiRoot: 'C:/relay/apps/api',
    fetchImpl: async () => relayHealth(),
    spawnProcess: () => { spawned = true; throw new Error('must not spawn'); },
  });
  assert.equal(result.notice, 'Watching local projects');
  assert.equal(result.process, null);
  assert.equal(spawned, false);
});

test('desktop reports a clear message when Node.js cannot be spawned', async () => {
  const child = new EventEmitter();
  const result = await startLocalApi({
    apiRoot: 'C:/relay/apps/api',
    attempts: 2,
    intervalMs: 0,
    sleepImpl: async () => {},
    fetchImpl: async () => new Response('{}', { status: 503 }),
    spawnProcess: () => { queueMicrotask(() => child.emit('error', Object.assign(new Error('missing node'), { code: 'ENOENT' }))); return child; },
  });
  assert.match(result.notice, /Node\.js 22\.9 or newer/i);
});

test('desktop detects a different service occupying Relay API port', async () => {
  const child = new EventEmitter();
  const result = await startLocalApi({
    apiRoot: 'C:/relay/apps/api',
    attempts: 2,
    intervalMs: 0,
    sleepImpl: async () => {},
    fetchImpl: async () => foreignHealth(),
    spawnProcess: () => { queueMicrotask(() => child.emit('exit', 1)); return child; },
  });
  assert.match(result.notice, /not a Relay API/);
});

test('desktop waits for Relay identity before declaring startup ready', async () => {
  const child = new EventEmitter();
  let probes = 0;
  const result = await startLocalApi({
    apiRoot: 'C:/relay/apps/api',
    attempts: 3,
    intervalMs: 0,
    sleepImpl: async () => {},
    fetchImpl: async () => ++probes < 3 ? new Response('{}', { status: 503 }) : relayHealth(),
    spawnProcess: () => child,
  });
  assert.equal(result.notice, 'Watching local projects');
  assert.equal(result.process, child);
});
