const { createReadStream } = require('node:fs');
const { stat } = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const TYPES = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function startDashboardServer({ staticRoot, serverFactory = http.createServer, listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address()));
}) } = {}) {
  const root = path.resolve(staticRoot);
  const server = serverFactory(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname); }
    catch { response.writeHead(400).end(); return; }
    let file = path.resolve(root, `.${pathname}`);
    if (!inside(root, file)) { response.writeHead(403).end(); return; }
    try {
      let info = await stat(file);
      if (info.isDirectory()) file = path.join(file, 'index.html');
      info = await stat(file);
      if (!info.isFile() || !inside(root, file)) throw new Error('Not a file');
      response.writeHead(200, {
        'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'content-length': info.size,
        'cache-control': path.basename(file) === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://127.0.0.1:4317; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file).pipe(response);
    } catch { response.writeHead(404).end(); }
  });
  const address = await listen(server);
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    url: `${origin}/#dashboard`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

module.exports = { inside, startDashboardServer };
