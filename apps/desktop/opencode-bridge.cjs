const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

// The runtime MCP API is experimental. Fail closed if this OpenCode version
// cannot connect; never silently claim that a package reached the assistant.
async function startBridge({ executable, node, root, projectPath, handoffId, apiBase }) {
  const port = await freePort();
  const password = crypto.randomBytes(32).toString('hex');
  const base = `http://127.0.0.1:${port}`;
  const authorization = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
  const child = spawn(executable, ['serve', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: projectPath, env: { ...process.env, OPENCODE_PASSWORD: password }, windowsHide: true, stdio: 'ignore',
  });
  let exited = false;
  child.on('error', () => { exited = true; });
  child.on('exit', () => { exited = true; });
  const request = (route, options = {}) => fetch(`${base}${route}`, {
    ...options, headers: { authorization, ...(options.headers || {}) }, signal: AbortSignal.timeout(2500),
  });
  try {
    let ready = false;
    for (let i = 0; i < 80 && !exited; i++) {
      try { const response = await request('/api/location'); if (response.ok) { ready = true; break; } } catch { /* startup */ }
      await pause(250);
    }
    if (!ready) throw new Error('Could not start the authenticated OpenCode service.');
    const result = await request('/api/experimental/mcp/relay-desktop-handoff', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: { type: 'local', command: [node, path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(root, 'apps', 'mcp', 'src', 'index.ts')], environment: { RELAY_API_URL: apiBase, RELAY_SCOPED_HANDOFF_ID: handoffId } } }),
    });
    if (!result.ok) throw new Error(`OpenCode could not register the handoff MCP (HTTP ${result.status}).`);
    let connected = false;
    for (let i = 0; i < 40 && !exited; i++) {
      const response = await request('/api/mcp');
      if (!response.ok) throw new Error('Could not check OpenCode MCP connection.');
      const list = await response.json();
      const status = list.data?.find(item => item.name === 'relay-desktop-handoff')?.status?.status;
      if (status === 'connected') { connected = true; break; }
      if (status && !['pending', 'connecting'].includes(status)) throw new Error(`OpenCode handoff MCP is ${status}.`);
      await pause(500);
    }
    if (!connected) throw new Error('OpenCode did not connect to the handoff MCP in time.');
    return { base, password, stop: () => { if (!exited) child.kill(); } };
  } catch (error) {
    if (!exited) child.kill();
    throw error;
  }
}

module.exports = { startBridge };
