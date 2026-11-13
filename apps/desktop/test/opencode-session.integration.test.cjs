const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startBridge } = require('../opencode-bridge.cjs');

const executable = process.env.RELAY_OPENCODE_BIN || (process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules', '@opencode', 'cli', 'bin', 'opencode.exe'));
const root = path.resolve(__dirname, '../../..');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('installed OpenCode v2 exposes and calls Relay handoff tool with a local mock model', { skip: !executable || !require('node:fs').existsSync(executable) }, async () => {
  const runtime = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-opencode-runtime-'));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-opencode-project-'));
  const originalEnv = Object.fromEntries(['USERPROFILE','HOME','APPDATA','LOCALAPPDATA','OPENCODE_CONFIG_DIR','XDG_CONFIG_HOME','XDG_DATA_HOME'].map(key => [key, process.env[key]]));
  let bridge;
  let sessionId;
  let retrievals = 0;
  let offeredRelayTool = '';
  let providerCalls = 0;
  const relay = http.createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/api/v1/handoffs/synthetic-handoff/load') {
      retrievals++;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ handoff: { id: 'synthetic-handoff', status: 'loaded' }, items: [{ id: 'fixture-item', content: 'Synthetic task: finish the blue button.' }] }));
      return;
    }
    response.writeHead(404).end();
  });
  const relayPort = await listen(relay);
  const model = http.createServer((request, response) => {
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      providerCalls++;
      const payload = JSON.parse(raw);
      const tools = payload.tools ?? [];
      const toolName = tools.map(tool => tool.function?.name ?? tool.name).find(name => name?.includes('relay_load_approved_handoff'));
      if (!toolName) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'Relay tool absent from model request' } }));
        return;
      }
      offeredRelayTool = toolName;
      const alreadyCalled = payload.messages.some(message => message.role === 'tool');
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const chunk = delta => response.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'fixture', choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
      if (!alreadyCalled) chunk({ role: 'assistant', tool_calls: [{ index: 0, id: 'relay-call', type: 'function', function: { name: toolName, arguments: '{}' } }] });
      else chunk({ role: 'assistant', content: 'Synthetic Relay context retrieved.' });
      response.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'fixture', choices: [{ index: 0, delta: {}, finish_reason: alreadyCalled ? 'stop' : 'tool_calls' }] })}\n\n`);
      response.end('data: [DONE]\n\n');
    });
  });
  const modelPort = await listen(model);

  try {
    await fs.writeFile(path.join(project, 'opencode.json'), JSON.stringify({
      model: 'relayfixture/fixture',
      permissions: [{ action: 'relay-desktop-handoff_relay_load_approved_handoff', resource: '*', effect: 'allow' }],
      providers: { relayfixture: { name: 'Local fixture', package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${modelPort}/v1`, apiKey: 'synthetic-only' }, models: { fixture: { name: 'Synthetic model', capabilities: { tools: true, input: ['text'], output: ['text'] } } } } },
    }));
    // Isolate OpenCode's own config/auth/log files from the developer account.
    process.env.USERPROFILE = runtime;
    process.env.HOME = runtime;
    process.env.APPDATA = path.join(runtime, 'roaming');
    process.env.LOCALAPPDATA = path.join(runtime, 'local');
    process.env.OPENCODE_CONFIG_DIR = path.join(runtime, 'config', 'opencode');
    process.env.XDG_CONFIG_HOME = path.join(runtime, 'xdg-config');
    process.env.XDG_DATA_HOME = path.join(runtime, 'xdg-data');

    bridge = await startBridge({ executable, node: process.execPath, root, projectPath: project, handoffId: 'synthetic-handoff', apiBase: `http://127.0.0.1:${relayPort}/api/v1` });
    const authorization = `Basic ${Buffer.from(`opencode:${bridge.password}`).toString('base64')}`;
    const call = async (route, body, method = body ? 'POST' : 'GET') => {
      let result;
      try { result = await fetch(`${bridge.base}${route}`, { method, headers: { authorization, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
      catch (error) { throw new Error(`OpenCode request ${route} failed: ${String(error)}`); }
      const text = await result.text();
      assert.ok(result.ok, `OpenCode returned ${result.status}: ${text.slice(0, 300)}`);
      return text ? JSON.parse(text) : undefined;
    };
    const created = await call('/api/session', { title: 'Synthetic MCP test', location: { directory: project }, model: { providerID: 'relayfixture', id: 'fixture' }, permissions: [{ action: '*', resource: '*', effect: 'allow' }] });
    sessionId = created.data.id;
    await call(`/api/session/${sessionId}/prompt`, { text: 'Call the approved Relay handoff tool now.' });
    for (let attempt = 0; attempt < 80 && retrievals === 0; attempt++) await pause(250);
    assert.equal(offeredRelayTool, 'relay-desktop-handoff_relay_load_approved_handoff', 'OpenCode exposes Relay as a native provider tool');
    assert.equal(retrievals, 1, 'mock model called the tool and Relay served the package once');
    if (providerCalls < 2) {
      const messages = await call(`/api/session/${sessionId}/message`);
      assert.ok(providerCalls >= 2, `mock model was not called with the tool result: ${JSON.stringify(messages.data).slice(0, 1500)}`);
    }
  } finally {
    if (bridge && sessionId) await fetch(`${bridge.base}/api/session/${sessionId}`, { method: 'DELETE', headers: { authorization: `Basic ${Buffer.from(`opencode:${bridge.password}`).toString('base64')}` } }).catch(() => {});
    await bridge?.stop();
    await close(model);
    await close(relay);
    for (const directory of [project, runtime]) {
      if (path.dirname(directory) === path.resolve(os.tmpdir()) && path.basename(directory).startsWith('relay-opencode-')) {
        for (let attempt = 0; attempt < 8; attempt++) {
          try { await fs.rm(directory, { recursive: true, force: true }); break; }
          catch (error) { if (attempt === 7) throw error; await pause(250); }
        }
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
