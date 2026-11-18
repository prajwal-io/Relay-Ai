const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startDashboardServer } = require('../dashboard-server.cjs');

test('packaged dashboard serves its build on loopback with a restrictive policy', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-dashboard-'));
  await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><title>Relay AI</title>');
  try {
    const server = await startDashboardServer({ staticRoot: root });
    try {
      assert.equal(new URL(server.url).hostname, '127.0.0.1');
      const response = await fetch(server.origin);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-security-policy'), /connect-src 'self' http:\/\/127\.0\.0\.1:4317/);
      assert.match(await response.text(), /Relay AI/);
      assert.notEqual((await fetch(`${server.origin}/%2e%2e/%2e%2e/package.json`)).status, 200);
      assert.equal((await fetch(server.origin, { method: 'POST' })).status, 405);
    } finally { await server.close(); }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
