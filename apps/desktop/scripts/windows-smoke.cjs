const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: wait } = require('node:timers/promises');
const { createHmac } = require('node:crypto');

const exe = path.resolve(process.argv[2] ?? path.join(__dirname, '../release/win-unpacked/Relay AI.exe'));
const soak = Number(process.env.RELAY_SMOKE_SOAK_SECONDS ?? 0);
const api = 'http://127.0.0.1:4317/api/v1';

async function until(check, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let error;
  while (Date.now() < deadline) {
    try { const value = await check(); if (value) return value; } catch (failure) { error = failure; }
    await wait(250);
  }
  throw new Error(`${label}: ${error?.message ?? 'timed out'}`);
}

async function devtools(page, method, params = {}) {
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => { socket.close(); reject(new Error(`DevTools timed out for ${method}`)); }, 5000);
    socket.addEventListener('open', () => socket.send(JSON.stringify({ id: 1, method, params })));
    socket.addEventListener('error', () => { clearTimeout(deadline); reject(new Error(`DevTools could not connect for ${method}`)); }, { once: true });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(deadline);
      socket.close();
      if (message.error || message.result?.exceptionDetails) reject(new Error(JSON.stringify(message.error ?? message.result.exceptionDetails)));
      else resolve(message.result);
    });
  });
}

async function evaluate(page, expression) {
  const result = await devtools(page, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return result.result.value;
}

async function main() {
  assert.equal(process.platform, 'win32');
  assert.ok(await fetch(`${api}/health`, { signal: AbortSignal.timeout(700) }).then(() => false, () => true),
    'Port 4317 must be free. Close other Relay instances before the smoke test.');
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-windows-smoke-'));
  const profile = path.join(scratch, 'Relay AI');
  const project = path.join(scratch, 'fixture');
  const otherProject = path.join(scratch, 'other');
  await fs.mkdir(profile);
  await fs.mkdir(project);
  await fs.mkdir(otherProject);
  await fs.writeFile(path.join(profile, 'setup-shown'), '');
  const launch = () => spawn(exe, [`--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1'], {
    cwd: scratch, env: { ...process.env, APPDATA: scratch, LOCALAPPDATA: scratch }, windowsHide: true, stdio: 'ignore',
  });
  let app = launch();
  const stop = async () => {
    if (!app.pid || app.exitCode !== null) return;
    try { execFileSync(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(app.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }
    catch { app.kill(); }
  };
  try {
    const port = await until(async () => Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]), 'Electron startup');
    const pages = async () => await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const companion = await until(async () => (await pages()).find(page => page.url.endsWith('/companion.html')), 'Companion');
    const token = (await fs.readFile(path.join(profile, 'installation-token'), 'utf8')).trim();
    await until(async () => {
      const response = await fetch(`${api}/health`, { headers: { authorization: `Bearer ${token}` } });
      return response.ok;
    }, 'Authenticated local API startup');
    await until(() => evaluate(companion, 'document.readyState === "complete" && Boolean(window.relayDesktop)'), 'Companion preload');
    await until(() => evaluate(companion, 'window.relayDesktop.openDashboard().then(() => true).catch(() => false)'), 'Dashboard IPC');
    const dashboard = await until(async () => (await pages()).find(page => page.url.endsWith('/#dashboard')), 'Dashboard');
    const title = 'Packaged smoke handoff';
    assert.equal((await fetch(`${api}/projects`)).status, 401);
    let dashboardRecoveryAttemptedAt = 0;
    async function request(route, body, credential = token) {
      const response = await fetch(api + route, {
        method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.ok(response.ok, `${route} returned ${response.status}`);
      return response.json();
    }
    await until(async () => {
      const content = await evaluate(dashboard, 'document.body.innerText');
      if (content.includes('Local service offline')) {
        const apiState = await evaluate(dashboard, `Promise.all(['/health','/projects'].map(async path => { const response = await fetch('http://127.0.0.1:4317/api/v1' + path, { signal: AbortSignal.timeout(4000) }); return [path, response.status, await response.text()]; }))`);
        if (apiState.every(([, status]) => status === 200) && !dashboardRecoveryAttemptedAt) {
          dashboardRecoveryAttemptedAt = Date.now();
          await evaluate(dashboard, 'document.querySelector(".service-error button")?.click(); true');
          return false;
        }
        if (dashboardRecoveryAttemptedAt && Date.now() - dashboardRecoveryAttemptedAt < 8000) return false;
        throw new Error(`Dashboard stayed offline after recovery attempt (API: ${JSON.stringify(apiState)})`);
      }
      return content.includes('Local service connected');
    }, 'Authenticated dashboard');
    assert.equal(await evaluate(dashboard, 'document.querySelector(".skip-link").click(); document.activeElement.id + location.hash'), 'main-content#dashboard');
    await evaluate(dashboard, 'location.hash = "top"; true');
    await until(() => evaluate(dashboard, 'Boolean(document.querySelector(".relay-header"))'), 'Landing page route');
    const downloadBefore = await evaluate(dashboard, 'location.href');
    assert.equal(await evaluate(dashboard, '(() => { const button = document.querySelector(".header-launch"); if (!button) return false; button.click(); return true; })()'), true, 'The website exposes its current release action');
    await until(() => evaluate(dashboard, 'Boolean(document.querySelector("[role=dialog][aria-modal=true]"))'), 'Website download sign-in gate');
    const authGate = await evaluate(dashboard, '({ hasEmailInput: Boolean(document.querySelector("[role=dialog] input[type=email]")), text: document.querySelector("[role=dialog]").innerText })');
    assert.match(authGate.text, /sign in|email|not published|release/i, 'The gate explains how downloads are accessed');
    assert.ok(authGate.hasEmailInput || /email sign-in is not enabled/i.test(authGate.text), 'The download gate offers email sign-in or clearly reports missing Supabase setup');
    assert.equal(await evaluate(dashboard, 'location.href'), downloadBefore, 'An unauthenticated click does not navigate directly to release files');
    await devtools(dashboard, 'Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate(dashboard, 'document.documentElement.scrollWidth <= innerWidth'), true, 'No mobile page overflow');
    await evaluate(dashboard, 'document.querySelector(".header-dashboard").click(); true');
    await until(() => evaluate(dashboard, 'location.hash === "#dashboard" && document.body.textContent.includes("Local service connected")'), 'Website to dashboard');
    await request('/projects', { name: 'Initially selected project', rootPath: otherProject });
    await until(() => evaluate(dashboard, 'document.body.textContent.includes("Initially selected project")'), 'Dashboard sees first project');
    const registered = await request('/projects', { name: 'Packaged smoke fixture', rootPath: project });
    const item = await request(`/projects/${registered.id}/memory`, { kind: 'note', source: 'user', content: 'Synthetic release fixture' });
    const draft = await request(`/projects/${registered.id}/handoffs`, { source: 'codex', destination: 'opencode', title, memoryItemIds: [item.id] });
    await until(() => evaluate(dashboard, `document.body.innerText.includes(${JSON.stringify(title)})`), 'Dashboard receives external draft');
    await until(() => evaluate(companion, `document.querySelector("#handoff-title").textContent === ${JSON.stringify(title)}`), 'Companion receives external draft');
    assert.equal(await evaluate(companion, 'document.querySelectorAll("input[name=launch-mode]").length'), 2, 'Companion offers Terminal and Desktop app handoff modes');
    await evaluate(dashboard, `[...document.querySelectorAll(".handoff-row")].find(button => button.textContent.includes(${JSON.stringify(title)})).click(); true`);
    await until(() => evaluate(dashboard, 'document.body.textContent.includes("Synthetic release fixture")'), 'Review includes saved context');
    await until(() => evaluate(dashboard, '[...document.querySelectorAll(".review-actions button")].some(button => button.textContent.includes("Approve selected context") && !button.disabled)'), 'Approval action ready');
    await evaluate(dashboard, '[...document.querySelectorAll("button")].find(b => b.textContent.includes("Approve selected context")).click(); true');
    const approvalStarted = Date.now();
    await until(async () => {
      const handoff = await request(`/handoffs/${draft.id}`);
      if (handoff.status === 'approved') return true;
      const review = await evaluate(dashboard, '({status: document.querySelector(".handoff-review .eyebrow")?.textContent, button: [...document.querySelectorAll(".review-actions button")].map(button => ({text: button.textContent, disabled: button.disabled})), error: document.querySelector(".service-error")?.innerText, formError: document.querySelector(".form-error")?.innerText})');
      if (review.button.some(button => button.disabled) || review.error || review.formError) throw new Error(`Approval blocked: ${JSON.stringify({handoff: handoff.status, verification: handoff.verification, review})}`);
      if (Date.now() - approvalStarted > 2000) throw new Error(`Approval did not update: ${JSON.stringify({handoff, review})}`);
      return false;
    }, 'Dashboard approval');
    await until(() => evaluate(dashboard, 'Boolean(document.querySelector(".desktop-launch select"))'), 'Approved handoff launch choices');
    assert.deepEqual(await evaluate(dashboard, 'Array.from(document.querySelector(".desktop-launch select").options, option => option.value)'), ['terminal', 'desktop']);
    await evaluate(dashboard, 'const choice = document.querySelector(".desktop-launch select"); choice.value = "desktop"; choice.dispatchEvent(new Event("change", { bubbles: true })); true');
    assert.match(await evaluate(dashboard, 'document.querySelector(".desktop-launch button").textContent'), /Open Desktop app/);
    await evaluate(dashboard, 'const choice = document.querySelector(".desktop-launch select"); choice.value = "terminal"; choice.dispatchEvent(new Event("change", { bubbles: true })); true');
    const scoped = createHmac('sha256', token).update(`load:${draft.id}`).digest('hex');
    await request(`/handoffs/${draft.id}/load`, { destination: 'opencode' }, scoped);
    await until(() => evaluate(companion, 'document.querySelector("#handoff-meta").textContent.includes("Retrieved by destination")'), 'Companion retrieval');
    const receipt = await request(`/handoffs/${draft.id}/receipt`);
    assert.equal(receipt.approvedItems[0].content, item.content);
    assert.equal(receipt.retrievalCount, 1, 'The receipt records the actual retrieval');

    // Verify user data lives in the installation-scoped profile and survives a
    // full Electron + local API restart, rather than only surviving in memory.
    await stop();
    await fs.rm(path.join(profile, 'DevToolsActivePort'), { force: true });
    app = launch();
    const restartedPort = await until(async () => Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]), 'Electron restart');
    const restartedPages = async () => await (await fetch(`http://127.0.0.1:${restartedPort}/json/list`)).json();
    const restartedCompanion = await until(async () => (await restartedPages()).find(page => page.url.endsWith('/companion.html')), 'Companion after restart');
    await until(() => evaluate(restartedCompanion, 'document.readyState === "complete" && Boolean(window.relayDesktop)'), 'Companion preload after restart');
    await until(async () => (await fetch(`${api}/health`, { headers: { authorization: `Bearer ${token}` } })).ok, 'Local API after restart');
    await until(() => evaluate(restartedCompanion, 'document.querySelector("#presence-label").textContent.includes("RELAY IS LISTENING LOCALLY")'), 'Companion service state after restart');
    await evaluate(restartedCompanion, 'window.relayDesktop.openDashboard().then(() => true)');
    const restartedDashboard = await until(async () => (await restartedPages()).find(page => page.url.endsWith('/#dashboard')), 'Dashboard after restart');
    await until(() => evaluate(restartedDashboard, 'document.body.textContent.includes("Local service connected")'), 'Local service after restart');
    assert.equal((await request(`/handoffs/${draft.id}`)).status, 'loaded', 'Handoff state persists across restart');
    assert.equal((await request(`/projects/${registered.id}/memory`)).some(entry => entry.id === item.id), true, 'Project memory persists across restart');
    const started = Date.now();
    while (Date.now() - started < soak * 1000) {
      await wait(3000);
      assert.equal((await request('/activity')).handoffs.find(handoff => handoff.id === draft.id)?.status, 'loaded');
      assert.equal(await evaluate(restartedDashboard, 'document.body.textContent.includes("Local service connected")'), true);
    }
    console.log(`Packaged website, dashboard and companion passed sync checks (${soak}s soak).`);
  } finally {
    await stop();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
