const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { startBridge } = require('../opencode-bridge.cjs');

test('OpenCode bridge attaches a native, handoff-scoped Relay MCP tool', async () => {
  let spawned;
  let registration;
  const child = new EventEmitter();
  child.exitCode = null;
  child.kill = () => { child.exitCode = 0; child.emit('exit', 0, null); return true; };
  const calls = [];
  const bridge = await startBridge({
    executable: 'opencode-fixture', node: 'node-fixture', root: 'C:/relay', projectPath: 'C:/work/project',
    handoffId: 'approved-handoff', apiBase: 'http://127.0.0.1:4317/api/v1',
    allocatePort: async () => 43123,
    spawnProcess: (executable, args, options) => { spawned = { executable, args, options }; return child; },
    fetchImpl: async (input, options = {}) => {
      const url = new URL(input);
      calls.push({ url: url.pathname, authorization: options.headers?.authorization });
      if (url.pathname === '/api/info') return new Response('{}', { status: 200 });
      if (url.pathname === '/api/experimental/mcp/relay-desktop-handoff') {
        registration = JSON.parse(options.body).config;
        return new Response('{}', { status: 200 });
      }
      if (url.pathname === '/api/mcp') return new Response(JSON.stringify({ data: [{ name: 'relay-desktop-handoff', status: { status: 'connected' } }] }), { status: 200 });
      return new Response('{}', { status: 404 });
    },
  });

  try {
    assert.equal(spawned.executable, 'opencode-fixture');
    assert.deepEqual(spawned.args.slice(0, 3), ['serve', '--hostname', '127.0.0.1']);
    assert.equal(spawned.options.env.OPENCODE_PASSWORD, bridge.password);
    assert.equal(new URL(bridge.base).hostname, '127.0.0.1');
    assert.equal(registration.type, 'local');
    assert.equal(registration.codemode, false, 'the destination model must receive Relay in its native tool list');
    assert.deepEqual(registration.environment, { RELAY_API_URL: 'http://127.0.0.1:4317/api/v1', RELAY_SCOPED_HANDOFF_ID: 'approved-handoff' });
    assert.ok(calls.some(call => call.url === '/api/info'));
    assert.ok(calls.some(call => call.url === '/api/mcp'));
  } finally {
    await bridge.stop();
  }
});
