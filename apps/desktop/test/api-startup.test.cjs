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

test('packaged desktop launches the bundled API with local user data and dashboard origin', async () => {
  const child = new EventEmitter();
  let spawned;
  let probes = 0;
  const result = await startLocalApi({
    apiBase: 'http://127.0.0.1:4317/api/v1', apiRoot: 'C:/app/api', dbPath: 'C:/user/Relay/data/relay.sqlite',
    packaged: true, runtimePath: 'C:/app/Relay.exe', apiEntry: 'C:/app/api/server.cjs', userDataPath: 'C:/user/Relay',
    envFilePath: 'C:/user/Relay/api.env', dashboardOrigin: 'http://127.0.0.1:49823', configPath: 'C:/user/Relay/api.env',
    attempts: 2, intervalMs: 0, sleepImpl: async () => {},
    fetchImpl: async () => ++probes === 1 ? new Response('{}', { status: 503 }) : relayHealth(),
    spawnProcess: (command, args, options) => { spawned = { command, args, options }; return child; },
  });
  assert.equal(result.notice, 'Watching local projects');
  assert.equal(spawned.command, 'C:/app/Relay.exe');
  assert.deepEqual(spawned.args, ['--env-file-if-exists=C:/user/Relay/api.env', 'C:/app/api/server.cjs']);
  assert.equal(spawned.options.cwd, 'C:/user/Relay');
  assert.equal(spawned.options.env.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(spawned.options.env.RELAY_DB_PATH, 'C:/user/Relay/data/relay.sqlite');
  assert.equal(spawned.options.env.WEB_ORIGIN, 'http://127.0.0.1:49823');
});
