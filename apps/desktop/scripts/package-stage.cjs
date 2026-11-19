const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { version } = require('../package.json');

const desktopRoot = path.resolve(__dirname, '..');
const root = path.resolve(desktopRoot, '../..');
const stage = path.join(desktopRoot, 'package-stage');

function copy(source, destination) {
  fs.cpSync(source, destination, { recursive: true, force: true });
}

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
for (const name of ['main.cjs', 'preload.cjs', 'api-startup.cjs', 'dashboard-server.cjs', 'dashboard-target.cjs', 'codex-client.cjs', 'opencode-bridge.cjs', 'terminal-launcher.cjs', 'companion.html', 'companion.css', 'companion.js']) {
  copy(path.join(desktopRoot, name), path.join(stage, name));
}
copy(path.join(desktopRoot, 'assets'), path.join(stage, 'assets'));
copy(path.join(root, 'apps', 'api', '.env.example'), path.join(stage, 'api.env.example'));

for (const [entry, outfile] of [
  [path.join(desktopRoot, 'opencode-desktop.cjs'), path.join(stage, 'opencode-desktop.cjs')],
  [path.join(root, 'apps', 'api', 'src', 'server.ts'), path.join(stage, 'api', 'server.cjs')],
  [path.join(root, 'apps', 'api', 'src', 'database-copy.ts'), path.join(stage, 'api', 'database-copy.cjs')],
  [path.join(root, 'apps', 'mcp', 'src', 'index.ts'), path.join(stage, 'mcp', 'index.cjs')],
]) {
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  buildSync({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'cjs', target: 'node24', packages: 'bundle', sourcemap: false, logLevel: 'warning' });
}

const webDist = path.join(root, 'apps', 'web', 'dist');
if (!fs.existsSync(path.join(webDist, 'index.html'))) throw new Error('Build the web workspace before packaging the desktop application.');
copy(webDist, path.join(stage, 'web'));

fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
  name: 'relay-ai-desktop', productName: 'Relay AI', description: 'Local context handoffs for Codex and OpenCode',
  version, private: true, main: 'main.cjs',
}, null, 2) + '\n');
process.stdout.write(`Prepared desktop package at ${stage}\n`);
