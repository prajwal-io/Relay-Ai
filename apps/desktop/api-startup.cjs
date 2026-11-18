const { spawn } = require('node:child_process');
const { createHmac, randomBytes } = require('node:crypto');
const path = require('node:path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function isRelayHealth(payload) {
  return payload?.ok === true && payload?.service === 'relay-ai';
}

function startupErrorMessage(error, port, configPath = 'apps/api/.env', packaged = false) {
  if (error?.code === 'ENOENT') return packaged ? 'Relay’s bundled runtime could not be started. Reinstall Relay and try again.' : 'Node.js 22.9 or newer was not found on PATH. Install Node.js, then restart Relay.';
  if (error?.code === 'EADDRINUSE') return `Port ${port} is already in use. Stop the other service, then restart Relay.`;
  if (error?.code === 'FOREIGN_SERVICE') return `Port ${port} responds, but it is not a Relay API. Stop the other service, then restart Relay.`;
  if (error?.code === 'EXITED') return `The Relay API exited during startup (code ${error.exitCode ?? 'unknown'}). Check ${configPath} and restart Relay.`;
  return `Relay could not start its local API on port ${port}. Check the local service configuration and restart Relay.`;
}

async function startLocalApi({
  apiBase = 'http://127.0.0.1:4317/api/v1',
  apiRoot,
  dbPath,
  packaged = false,
  runtimePath = process.execPath,
  apiEntry,
  userDataPath,
  envFilePath,
  dashboardOrigin,
  installationToken,
  configPath,
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
      const challenge = installationToken && randomBytes(32).toString('hex');
      const response = await fetchImpl(challenge ? `${healthUrl}?challenge=${challenge}` : healthUrl, {
        signal: AbortSignal.timeout(1200),
        redirect: 'error',
      });
      if (!response.ok) return { ready: false, foreign: false };
      const payload = await response.json();
      if (challenge) {
        const ready = payload?.proof === createHmac('sha256', installationToken).update(`health:${challenge}`).digest('hex');
        return { ready, foreign: !ready };
      }
      return { ready: isRelayHealth(payload), foreign: !isRelayHealth(payload) };
    } catch { return { ready: false, foreign: false }; }
  };

  const existing = await probe();
  if (existing.ready) return { process: null, notice: 'Watching local projects' };
  if (installationToken && existing.foreign) return { process: null, notice: startupErrorMessage({ code: 'FOREIGN_SERVICE' }, port) };
  const executable = packaged ? runtimePath : 'node';
  const args = packaged
    ? [`--env-file-if-exists=${envFilePath}`, apiEntry]
    : ['--env-file-if-exists=.env', '--import', 'tsx', 'src/server.ts'];
  const child = spawnProcess(executable, args, {
    cwd: packaged ? userDataPath : apiRoot,
    env: {
      ...process.env,
      ...(packaged ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      HOST: '127.0.0.1', PORT: port,
      RELAY_DB_PATH: dbPath ?? path.join(apiRoot, 'data', 'relay.sqlite'),
      ...(packaged && dashboardOrigin ? { WEB_ORIGIN: dashboardOrigin } : {}),
      ...(installationToken ? { RELAY_INSTALLATION_TOKEN: installationToken } : {}),
    },
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
    if (failure) return { process: child, notice: startupErrorMessage(failure, port, configPath, packaged) };
    if (exited) return { process: child, notice: startupErrorMessage(failure, port, configPath, packaged) };
  }

  return { process: child, notice: startupErrorMessage(null, port, configPath, packaged) };
}

module.exports = { isRelayHealth, startLocalApi, startupErrorMessage };
