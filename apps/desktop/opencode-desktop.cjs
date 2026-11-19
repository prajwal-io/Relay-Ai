const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const jsonc = require('jsonc-parser');

function openProjectUrl(projectPath) {
  const url = new URL('opencode://open-project');
  url.searchParams.set('directory', projectPath);
  return url.href;
}

function installScopedMcp({ configPath, journalPath, handoffId, command, environment, cwd }) {
  if (fs.existsSync(journalPath)) throw new Error('Another desktop handoff is still active. Finish or retry it before starting another.');
  const original = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : null;
  const source = original ?? '{}\n';
  const errors = [];
  const config = jsonc.parse(source, errors, { allowTrailingComma: true });
  if (errors.length || !config || Array.isArray(config) || typeof config !== 'object') {
    throw new Error('OpenCode’s configuration could not be read safely. Fix its JSONC syntax or use Terminal mode.');
  }
  const name = `relay-handoff-${crypto.randomUUID()}`;
  const server = { type: 'local', codemode: false, command, environment, ...(cwd ? { cwd } : {}) };
  const edited = jsonc.applyEdits(source, jsonc.modify(source, ['mcp', 'servers', name], server, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
  const journal = {
    handoffId, configPath, name,
    original: original === null ? null : Buffer.from(original).toString('base64'),
    serverHash: hash(JSON.stringify(server)),
    writtenHash: hash(edited),
  };
  atomicWrite(journalPath, JSON.stringify(journal), 0o600);
  try { atomicWrite(configPath, edited, 0o600); }
  catch (error) { fs.rmSync(journalPath, { force: true }); throw error; }
  return journal;
}

function restoreScopedMcp(journalPath, handoffId) {
  if (!fs.existsSync(journalPath)) return false;
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  if (handoffId && journal.handoffId !== handoffId) return false;
  if (!fs.existsSync(journal.configPath)) {
    if (journal.original !== null) throw new Error('OpenCode configuration disappeared before Relay could restore it.');
    fs.rmSync(journalPath, { force: true });
    return true;
  }
  const current = fs.readFileSync(journal.configPath, 'utf8');
  if (hash(current) === journal.writtenHash) {
    if (journal.original === null) fs.rmSync(journal.configPath, { force: true });
    else atomicWrite(journal.configPath, Buffer.from(journal.original, 'base64').toString('utf8'), 0o600);
  } else {
    const errors = [];
    const config = jsonc.parse(current, errors, { allowTrailingComma: true });
    const value = config?.mcp?.servers?.[journal.name];
    if (errors.length) throw new Error('OpenCode configuration changed and can no longer be safely restored.');
    if (value && hash(JSON.stringify(value)) === journal.serverHash) {
      let restored = jsonc.applyEdits(current, jsonc.modify(current, ['mcp', 'servers', journal.name], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
      const remaining = jsonc.parse(restored);
      if (!Object.keys(remaining.mcp?.servers ?? {}).length) {
        restored = jsonc.applyEdits(restored, jsonc.modify(restored, ['mcp', 'servers'], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
        if (!Object.keys(jsonc.parse(restored).mcp ?? {}).length) restored = jsonc.applyEdits(restored, jsonc.modify(restored, ['mcp'], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
      }
      atomicWrite(journal.configPath, restored, 0o600);
    }
  }
  fs.rmSync(journalPath, { force: true });
  return true;
}

function atomicWrite(file, contents, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { mode });
    fs.renameSync(temporary, file);
  } finally { fs.rmSync(temporary, { force: true }); }
}

function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

module.exports = { installScopedMcp, openProjectUrl, restoreScopedMcp };
