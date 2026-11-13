const assert = require('node:assert/strict');
const test = require('node:test');
const { DEFAULT_DASHBOARD, resolveDashboardUrl } = require('../dashboard-target.cjs');

test('desktop opens the active Relay Vite port instead of an unrelated app on 5173', async () => {
  const visited = [];
  const url = await resolveDashboardUrl({ fetchImpl: async target => {
    visited.push(target);
    return new Response(target.endsWith(':5173') ? '<title>Another app</title>' : '<title>Relay AI — Switch agents. Keep progress.</title>', { status: 200 });
  } });
  assert.equal(url, 'http://127.0.0.1:5174/#dashboard');
  assert.deepEqual(visited, ['http://127.0.0.1:5173', 'http://127.0.0.1:5174']);
});

test('desktop honors a safe configured dashboard URL', async () => {
  const url = await resolveDashboardUrl({ configured: 'https://relay.example/#top', fetchImpl: () => { throw new Error('should not probe'); } });
  assert.equal(url, 'https://relay.example/#dashboard');
});

test('desktop ignores unsafe dashboard overrides and falls back to loopback', async () => {
  const url = await resolveDashboardUrl({ configured: 'http://attacker.example/#dashboard', fetchImpl: async () => new Response('unavailable', { status: 503 }) });
  assert.equal(url, DEFAULT_DASHBOARD);
});
