const { spawn } = require('node:child_process');
const path = require('node:path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function isRelayHealth(payload) {
  return payload?.ok === true && payload?.service === 'relay-ai';
}

function startupErrorMessage(error, port) {
  if (error?.code === 'ENOENT') return 'Node.js 22.9 or newer was not found on PATH. Install Node.js, then restart Relay.';
  if (error?.code === 'EADDRINUSE') return `Port ${port} is already in use. Stop the other service, then restart Relay.`;
  if (error?.code === 'FOREIGN_SERVICE') return `Port ${port} responds, but it is not a Relay API. Stop the other service, then restart Relay.`;
  if (error?.code === 'EXITED') return `The Relay API exited during startup (code ${error.exitCode ?? 'unknown'}). Check apps/api/.env and restart Relay.`;
  return `Relay could not start its local API on port ${port}. Check the local service configuration and restart Relay.`;
}

async function startLocalApi({
  apiBase = 'http://127.0.0.1:4317/api/v1',
  apiRoot,
  dbPath,
  fetchImpl = fetch,
  spawnProcess = spawn,
  sleepImpl = sleep,
  attempts = 20,
  intervalMs = 500,
} = {}) {
  const healthUrl = `${apiBase}/health`;
  const port = new URL(apiBase).port || '80';
  const probe = async () => {
    try {
      const response = await fetchImpl(healthUrl, { signal: AbortSignal.timeout(1200) });
      if (!response.ok) return { ready: false, foreign: false };
      const payload = await response.json();
      return { ready: isRelayHealth(payload), foreign: !isRelayHealth(payload) };
    } catch { return { ready: false, foreign: false }; }
  };

  if ((await probe()).ready) return { process: null, notice: 'Watching local projects' };
  const child = spawnProcess('node', ['--env-file-if-exists=.env', '--import', 'tsx', 'src/server.ts'], {
    cwd: apiRoot,
    env: { ...process.env, HOST: '127.0.0.1', PORT: port, RELAY_DB_PATH: dbPath ?? path.join(apiRoot, 'data', 'relay.sqlite') },
    windowsHide: true,
    stdio: 'ignore',
  });

  let failure = null;
  let exited = false;
  child.once('error', error => { failure = error; });
  child.once('exit', code => {
    exited = true;
    if (code !== 0 && !failure) failure = Object.assign(new Error('Relay API exited during startup'), { code: 'EXITED', exitCode: code });
  });

  for (let attempt = 0; attempt < attempts; attempt++) {
    await sleepImpl(intervalMs);
    const health = await probe();
    if (health.ready) return { process: child, notice: 'Watching local projects' };
    if (health.foreign) return { process: child, notice: startupErrorMessage(Object.assign(new Error(), { code: 'FOREIGN_SERVICE' }), port) };
    if (failure) return { process: child, notice: startupErrorMessage(failure, port) };
    if (exited) return { process: child, notice: startupErrorMessage(failure, port) };
  }

  return { process: child, notice: startupErrorMessage(null, port) };
}

module.exports = { isRelayHealth, startLocalApi, startupErrorMessage };
