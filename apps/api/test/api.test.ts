import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";

const port = 44317 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}/api/v1`;
let temp = "";
let projectRoot = "";
let child: ChildProcess | undefined;
let childError = "";

before(async () => {
  temp = await mkdtemp(join(tmpdir(), "relay-api-"));
  projectRoot = join(temp, "project");
  await mkdir(projectRoot);
  const env = { ...process.env, PORT: String(port), HOST: "127.0.0.1", RELAY_DB_PATH: join(temp, "relay.sqlite"), GROQ_API_KEY: "" };
  child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], { cwd: resolve("."), env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stdout?.on("data", (chunk) => { childError += String(chunk); });
  child.stderr?.on("data", (chunk) => { childError += String(chunk); });
  child.on("exit", (code, signal) => { childError += `\nchild exited code=${code} signal=${signal}`; });
  let lastHealthError = "";
  for (let n = 0; n < 50; n++) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch (error) { lastHealthError = String(error); }
    await delay(100);
  }
  throw new Error(`API did not respond at ${base}/health: ${lastHealthError}; child: ${childError}`);
});

after(async () => {
  if (child && child.exitCode === null) {
    const exited = once(child, "exit").catch(() => undefined);
    child.kill();
    await Promise.race([exited, delay(2000)]);
  }
  await delay(100);
  if (temp) await rm(temp, { recursive: true, force: true });
});

const post = async (url: string, data: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });

test("SQLite project and memory persistence plus approved destination handoff flow", async () => {
  const created = await post(`${base}/projects`, { name: "Relay fixture", rootPath: projectRoot });
  assert.equal(created.status, 201);
  const project = await created.json() as any;
  const memory = await post(`${base}/projects/${project.id}/memory`, { kind: "task", content: "Finish the login redirect", status: "in-progress", source: "user", tags: ["auth"] });
  assert.equal(memory.status, 201);
  const item = await memory.json() as any;
  const duplicate = await post(`${base}/projects/${project.id}/memory`, { kind: "task", content: "Finish the login redirect", status: "in-progress" });
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json() as any).id, item.id);

  const handoffResponse = await post(`${base}/projects/${project.id}/handoffs`, { source: "opencode", destination: "codex" });
  assert.equal(handoffResponse.status, 201);
  const handoff = await handoffResponse.json() as any;
  assert.equal(handoff.status, "draft");
  assert.ok(handoff.memoryItemIds.includes(item.id));
  assert.equal((await fetch(`${base}/handoffs/${handoff.id}/context?destination=codex`)).status, 409);

  const approved = await post(`${base}/handoffs/${handoff.id}/approve`, { includeItemIds: [item.id] });
  assert.equal(approved.status, 200);
  assert.equal((await post(`${base}/handoffs/${handoff.id}/load`, { destination: "opencode" })).status, 403);
  const loaded = await post(`${base}/handoffs/${handoff.id}/load`, { destination: "codex" });
  assert.equal(loaded.status, 200);
  const payload = await loaded.json() as any;
  assert.equal(payload.handoff.status, "loaded");
  assert.equal(payload.items[0].id, item.id);
  const replay = await post(`${base}/handoffs/${handoff.id}/load`, { destination: "codex" });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json() as any).items[0].id, item.id);
  assert.equal((await fetch(`${base}/handoffs/${handoff.id}/context?destination=opencode`)).status, 403);
  const history = await fetch(`${base}/projects/${project.id}/handoffs`);
  assert.equal((await history.json() as any[]).length, 1);
});

test("MCP retrieves only an approved handoff for the intended destination", async () => {
  const mcpRoot = join(temp, "mcp-project");
  await mkdir(mcpRoot);
  const project = await (await post(`${base}/projects`, { name: "MCP handoff fixture", rootPath: mcpRoot })).json() as any;
  const item = await (await post(`${base}/projects/${project.id}/memory`, { kind: "task", content: "Finish the synthetic redirect", source: "user" })).json() as any;
  const draft = await (await post(`${base}/projects/${project.id}/handoffs`, { source: "codex", destination: "opencode", memoryItemIds: [item.id] })).json() as any;
  const mcp = spawn(process.execPath, ["--import", "tsx", "../mcp/src/index.ts"], {
    cwd: resolve("."), env: { ...process.env, RELAY_API_URL: base }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
  let buffer = "";
  const replies = new Map<number, any>();
  mcp.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) { const message = JSON.parse(line); if (message.id) replies.set(message.id, message); }
  });
  async function call(id: number, method: string, params: unknown) {
    mcp.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    for (let n = 0; n < 100 && !replies.has(id); n++) await delay(50);
    assert.ok(replies.has(id), `MCP did not respond to ${method}`);
    return replies.get(id);
  }
  const load = (id: number, destination: string) => call(id, "tools/call", { name: "relay_load_handoff", arguments: { handoffId: draft.id, destination } });
  try {
    const init = await call(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "relay-handoff-test", version: "1" } });
    assert.equal(init.result.serverInfo.name, "relay-ai");
    mcp.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    assert.equal((await load(2, "opencode")).result.isError, true, "draft must not be available");
    assert.equal((await post(`${base}/handoffs/${draft.id}/approve`, { includeItemIds: [item.id] })).status, 200);
    assert.equal((await load(3, "codex")).result.isError, true, "wrong destination must not receive the package");
    const received = await load(4, "opencode");
    assert.notEqual(received.result.isError, true);
    const payload = JSON.parse(received.result.content[0].text);
    assert.equal(payload.handoff.status, "loaded");
    assert.equal(payload.items[0].id, item.id);
    assert.match(payload.items[0].content, /synthetic redirect/);
  } finally {
    mcp.stdin.end();
    if (mcp.exitCode === null) mcp.kill();
    await Promise.race([once(mcp, "close"), delay(2000)]);
  }
});

test("project registration rejects a missing path and extraction works without Groq", async () => {
  const missing = await post(`${base}/projects`, { name: "missing", rootPath: join(temp, "missing") });
  assert.equal(missing.status, 400);
  const filePath = join(temp, "not-a-directory.txt");
  await writeFile(filePath, "not a repository");
  assert.equal((await post(`${base}/projects`, { name: "file", rootPath: filePath })).status, 400);
  const projects = await fetch(`${base}/projects`);
  const project = (await projects.json() as any[])[0];
  const extraction = await post(`${base}/projects/${project.id}/extract`, { text: "Decision: keep SQLite local. Next, finish the redirect." });
  assert.equal(extraction.status, 200);
  const result = await extraction.json() as any;
  assert.equal(result.engine, "local-fallback");
  assert.ok(result.items.length > 0);
});

test("explicit handoff items stay project-scoped and tracked changes invalidate a draft", async () => {
  const root = join(temp, "git-project");
  await mkdir(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, windowsHide: true, stdio: "ignore" });
  git("init");
  await writeFile(join(root, "example.txt"), "original\n");
  git("add", "example.txt");
  git("-c", "user.name=Relay test", "-c", "user.email=relay@example.invalid", "commit", "-m", "fixture");
  const project = await (await post(`${base}/projects`, { name: "Git fixture", rootPath: root })).json() as any;
  const item = await (await post(`${base}/projects/${project.id}/memory`, { kind: "note", content: "Continue this selected chat; an older example mentioned missing.ts", source: "user", tags: ["codex-chat"] })).json() as any;
  const rejected = await post(`${base}/projects/${project.id}/handoffs`, { source: "codex", destination: "opencode", memoryItemIds: ["not-a-project-item"] });
  assert.equal(rejected.status, 400);
  const draftResponse = await post(`${base}/projects/${project.id}/handoffs`, { source: "codex", destination: "opencode", memoryItemIds: [item.id] });
  assert.equal(draftResponse.status, 201);
  const draft = await draftResponse.json() as any;
  assert.deepEqual(draft.memoryItemIds, [item.id]);
  assert.notEqual(draft.verification, "conflict");
  assert.match(draft.evidence.find((entry: any) => entry.kind === "git-status").description, /^Repository snapshot:/);
  assert.equal((await post(`${base}/handoffs/${draft.id}/approve`, { includeItemIds: [item.id] })).status, 200);
  await writeFile(join(root, "example.txt"), "changed after approval\n");
  const stale = await post(`${base}/handoffs/${draft.id}/load`, { destination: "opencode" });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json() as any).error.code, "REPOSITORY_CHANGED");
  const stalePreview = await fetch(`${base}/handoffs/${draft.id}/context?destination=opencode`);
  assert.equal(stalePreview.status, 409);
  assert.equal((await stalePreview.json() as any).error.code, "REPOSITORY_CHANGED");

  const dirtyDraft = await (await post(`${base}/projects/${project.id}/handoffs`, { source: "codex", destination: "opencode", memoryItemIds: [item.id] })).json() as any;
  await writeFile(join(root, "example.txt"), "different tracked contents, still dirty\n");
  const staleApproval = await post(`${base}/handoffs/${dirtyDraft.id}/approve`, { includeItemIds: [item.id] });
  assert.equal(staleApproval.status, 409);
  assert.equal((await staleApproval.json() as any).error.code, "REPOSITORY_CHANGED");

  const freshDraft = await (await post(`${base}/projects/${project.id}/handoffs`, { source: "codex", destination: "opencode", memoryItemIds: [item.id] })).json() as any;
  assert.equal((await post(`${base}/handoffs/${freshDraft.id}/approve`, { includeItemIds: [item.id] })).status, 200);
  assert.equal((await post(`${base}/handoffs/${freshDraft.id}/load`, { destination: "opencode" })).status, 200);
  await writeFile(join(root, "example.txt"), "changed after loading\n");
  assert.equal((await fetch(`${base}/handoffs/${freshDraft.id}/context?destination=opencode`)).status, 409);
  assert.equal((await post(`${base}/handoffs/${freshDraft.id}/load`, { destination: "opencode" })).status, 409);
});
