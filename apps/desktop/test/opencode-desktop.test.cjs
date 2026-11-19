const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const jsonc = require('jsonc-parser');
const { installScopedMcp, openProjectUrl, restoreScopedMcp } = require('../opencode-desktop.cjs');

test('desktop handoff URL opens the exact project path', () => {
  const url = new URL(openProjectUrl('C:\\Users\\Relay User\\repo&docs'));
  assert.equal(url.protocol, 'opencode:');
  assert.equal(url.hostname, 'open-project');
  assert.equal(url.searchParams.get('directory'), 'C:\\Users\\Relay User\\repo&docs');
});

test('temporary desktop MCP config preserves comments and restores the exact user file', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-opencode-config-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const configPath = path.join(dir, 'opencode.jsonc');
  const journalPath = path.join(dir, 'relay-restore.json');
  const cwd = path.join(dir, 'apps', 'mcp');
  const original = '{\n  // User preferences\n  "model": "provider/model",\n}\n';
  fs.writeFileSync(configPath, original);
  installScopedMcp({ configPath, journalPath, handoffId: 'handoff-1', command: ['relay.exe', 'mcp.cjs'], environment: { RELAY_SCOPED_HANDOFF_ID: 'handoff-1', RELAY_MCP_ACCESS_TOKEN: 'scoped-token' }, cwd });
  const injected = fs.readFileSync(configPath, 'utf8');
  assert.match(injected, /\/\/ User preferences/);
  const servers = jsonc.parse(injected, [], { allowTrailingComma: true }).mcp.servers;
  assert.equal(Object.keys(servers).length, 1);
  assert.match(Object.keys(servers)[0], /^relay-handoff-/);
  assert.equal(Object.values(servers)[0].environment.RELAY_SCOPED_HANDOFF_ID, 'handoff-1');
  assert.equal(Object.values(servers)[0].cwd, cwd);
  assert.equal(restoreScopedMcp(journalPath, 'another-handoff'), false);
  assert.equal(restoreScopedMcp(journalPath, 'handoff-1'), true);
  assert.equal(fs.readFileSync(configPath, 'utf8'), original);
  assert.equal(fs.existsSync(journalPath), false);
});

test('desktop MCP cleanup removes only Relay data when OpenCode config changes meanwhile', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-opencode-config-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const configPath = path.join(dir, 'opencode.json');
  const journalPath = path.join(dir, 'relay-restore.json');
  fs.writeFileSync(configPath, '{"model":"provider/model"}');
  installScopedMcp({ configPath, journalPath, handoffId: 'handoff-2', command: ['relay.exe', 'mcp.cjs'], environment: { RELAY_SCOPED_HANDOFF_ID: 'handoff-2', RELAY_MCP_ACCESS_TOKEN: 'scoped-token' } });
  const updated = jsonc.parse(fs.readFileSync(configPath, 'utf8'));
  updated.theme = 'new-user-setting';
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));
  assert.equal(restoreScopedMcp(journalPath, 'handoff-2'), true);
  const restored = jsonc.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(restored.theme, 'new-user-setting');
  assert.equal(restored.model, 'provider/model');
  assert.equal(restored.mcp, undefined);
});

test('invalid OpenCode config is left untouched and reports an actionable failure', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-opencode-config-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const configPath = path.join(dir, 'opencode.json');
  const journalPath = path.join(dir, 'relay-restore.json');
  const original = '{ invalid';
  fs.writeFileSync(configPath, original);
  assert.throws(() => installScopedMcp({ configPath, journalPath, handoffId: 'handoff-3', command: ['relay.exe'], environment: {} }), /configuration could not be read safely/);
  assert.equal(fs.readFileSync(configPath, 'utf8'), original);
  assert.equal(fs.existsSync(journalPath), false);
});
