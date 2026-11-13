const { spawn } = require('node:child_process');
const readline = require('node:readline');

// Codex app-server speaks newline-delimited JSON RPC on stdio.
async function withCodex(callback) {
  const child = spawn(process.platform === 'win32' ? 'codex.exe' : 'codex', ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = readline.createInterface({ input: child.stdout });
  const pending = new Map();
  child.stdin.on('error', () => {});
  let nextId = 0;
  let failure;
  const failPending = error => {
    failure = error;
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
    pending.clear();
  };
  child.on('error', () => failPending(new Error('Could not start Codex. Check that Codex is installed and available on PATH.')));
  child.on('exit', () => failPending(new Error('The Codex session service stopped unexpectedly.')));
  lines.on('line', line => {
    let message; try { message = JSON.parse(line); } catch { return; }
    if (!pending.has(message.id)) return;
    const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message || 'Codex could not complete the request.'));
    else request.resolve(message.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    if (failure) return reject(failure);
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Codex took too long to respond.')); }, 20000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  });
  try {
    await call('initialize', { clientInfo: { name: 'relay_ai', title: 'Relay AI', version: '0.1.0' } });
    child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`);
    return await callback(call);
  } finally {
    lines.close();
    child.kill();
  }
}

async function listChats() {
  return withCodex(async call => {
    const sessions = [];
    let cursor;
    do {
      const result = await call('thread/list', { limit: 100, sortKey: 'updated_at', ...(cursor ? { cursor } : {}) });
      for (const thread of result.data || []) {
        if (!thread.id || !thread.cwd) continue;
        sessions.push({ id: thread.id, title: redact(String(thread.name || thread.preview || 'Untitled Codex chat')).slice(0, 200), cwd: thread.cwd, updatedAt: thread.updatedAt });
      }
      cursor = result.nextCursor;
    } while (cursor && sessions.length < 500);
    return { sessions, hasMore: Boolean(cursor) };
  });
}

function redact(text) {
  return text
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9_-]{16,}|github_pat_[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|AQ\.[A-Za-z0-9_-]{20,})\b/g, '[REDACTED SECRET]')
    .replace(/\bBearer\s+[A-Za-z0-9._~-]{16,}/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:api[ _-]?key|access[ _-]?token|secret|password)\b\s*[:=]\s*["']?[^\s"',;]{8,}/gi, '[REDACTED CREDENTIAL]')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]');
}

async function readChat(threadId) {
  return withCodex(async call => {
    const turns = [];
    let cursor;
    do {
      const result = await call('thread/turns/list', { threadId, limit: 50, sortDirection: 'asc', itemsView: 'full', ...(cursor ? { cursor } : {}) });
      turns.push(...(result.data || []));
      cursor = result.nextCursor;
      if (turns.length > 1000) throw new Error('This chat has more than 1,000 turns. Select a shorter chat for this handoff.');
    } while (cursor);
    return extractMessages(turns);
  });
}

function extractMessages(turns) {
  const messages = [];
  let omittedAttachments = 0;
  for (const turn of turns) for (const item of turn.items || []) {
    if (item.type === 'userMessage') {
      const text = (item.content || []).filter(part => part.type === 'text').map(part => part.text || '').join('\n');
      omittedAttachments += (item.content || []).filter(part => part.type !== 'text').length;
      if (text.trim()) messages.push(`USER:\n${redact(text.trim())}`);
    } else if (item.type === 'agentMessage' && item.text?.trim()) messages.push(`CODEX:\n${redact(item.text.trim())}`);
  }
  const text = messages.join('\n\n---\n\n');
  if (text.length > 240000) throw new Error('This chat exceeds the current 240,000-character review limit. Choose a shorter chat.');
  if (!text.trim()) throw new Error('No text messages were found in this chat.');
  return { text, messageCount: messages.length, omittedAttachments };
}

module.exports = { listChats, readChat, redact, extractMessages };
