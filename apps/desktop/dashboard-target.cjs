const DEFAULT_DASHBOARD = 'http://127.0.0.1:5173/#dashboard';

function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function normalizeDashboardUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost(url.hostname))) return null;
    url.hash = 'dashboard';
    return url.toString();
  } catch { return null; }
}

async function resolveDashboardUrl({ configured = process.env.RELAY_DASHBOARD_URL, fetchImpl = fetch } = {}) {
  const explicit = configured && normalizeDashboardUrl(configured);
  if (explicit) return explicit;

  for (const port of [5173, 5174]) {
    const base = `http://127.0.0.1:${port}`;
    try {
      const response = await fetchImpl(base, { signal: AbortSignal.timeout(700) });
      if (!response.ok) continue;
      const html = await response.text();
      if (/<title>\s*Relay AI\b/i.test(html)) return `${base}/#dashboard`;
    } catch { /* try the next local development port */ }
  }
  return DEFAULT_DASHBOARD;
}

module.exports = { DEFAULT_DASHBOARD, resolveDashboardUrl };
