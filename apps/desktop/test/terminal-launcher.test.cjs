const assert = require('node:assert/strict');
const test = require('node:test');
const { launchOpenCode } = require('../terminal-launcher.cjs');

test('OpenCode launches in an interactive Windows terminal without exposing a plaintext command line', () => {
  let launch;
  launchOpenCode({ platform: 'win32', command: 'C:\\tools\\opencode.cmd', projectPath: "C:\\work\\my repo", bridgeUrl: 'http://127.0.0.1:32100', prompt: 'Read Relay context', password: 'synthetic-secret', spawnProcess: (...args) => (launch = args, { unref() {} }) });
  assert.equal(launch[0], 'powershell.exe');
  assert.ok(launch[1].includes('-EncodedCommand'));
  assert.ok(!launch[1].join(' ').includes('synthetic-secret'));
  const script = Buffer.from(launch[1].at(-1), 'base64').toString('utf16le');
  assert.match(script, /Set-Location -LiteralPath 'C:\\work\\my repo'/);
  assert.match(script, /OPENCODE_PASSWORD='synthetic-secret'/);
});

test('macOS opens Terminal in the project and supplies the password through the shell environment', () => {
  let launch;
  launchOpenCode({ platform: 'darwin', command: '/usr/local/bin/opencode', projectPath: "/Users/dev/my 'repo", bridgeUrl: 'http://127.0.0.1:32100', prompt: 'Read Relay context', password: 'synthetic-secret', spawnProcess: (...args) => (launch = args, { unref() {} }) });
  assert.equal(launch[0], 'osascript');
  assert.match(launch[1][1], /Terminal/);
  assert.ok(launch[1][1].includes('OPENCODE_PASSWORD'));
  assert.ok(launch[1][1].includes('my'));
  assert.ok(launch[1][1].includes('repo'));
});

test('Linux opens the configured project in its terminal emulator', () => {
  let launch;
  launchOpenCode({ platform: 'linux', command: '/usr/bin/opencode', projectPath: '/home/dev/my repo', bridgeUrl: 'http://127.0.0.1:32100', prompt: 'Read Relay context', password: 'synthetic-secret', spawnProcess: (...args) => (launch = args, { unref() {} }) });
  assert.equal(launch[0], 'x-terminal-emulator');
  assert.equal(launch[1][0], '-e');
  assert.match(launch[1].at(-1), /cd '\/home\/dev\/my repo'/);
  assert.match(launch[1].at(-1), /OPENCODE_PASSWORD='synthetic-secret'/);
});
