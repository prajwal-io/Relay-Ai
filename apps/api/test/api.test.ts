import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createHmac, randomBytes } from "node:crypto";

const installationToken = randomBytes(32).toString("hex");
const fetch = (url: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("authorization")) headers.set("authorization", `Bearer ${installationToken}`);
  return globalThis.fetch(url, { ...init, headers });
};

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
  const env = { ...process.env, PORT: String(port), HOST: "127.0.0.1", RELAY_DB_PATH: join(temp, "relay.sqlite"), GROQ_API_KEY: "", RELAY_INSTALLATION_TOKEN: installationToken };
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

test("installation credentials and scoped handoff access are enforced", async () => {
  assert.equal((await globalThis.fetch(`${base}/projects`)).status, 401);
  const challenge = randomBytes(32).toString("hex");
  const health = await globalThis.fetch(`${base}/health?challenge=${challenge}`);
  assert.deepEqual(await health.json(), { proof: createHmac("sha256", installationToken).update(`health:${challenge}`).digest("hex") });
  const root = join(temp, "scoped-project");
  await mkdir(root);
  const project = await (await post(`${base}/projects`, { name: "Scoped", rootPath: root })).json() as any;
  const draft = await (await post(`${base}/projects/${project.id}/handoffs`, { source: "codex", destination: "opencode" })).json() as any;
  const token = createHmac("sha256", installationToken).update(`load:${draft.id}`).digest("hex");
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const scoped = (path: string) => fetch(`${base}/handoffs/${path}`, { method: "POST", headers, body: '{"destination":"opencode"}' });
  assert.equal((await fetch(`${base}/projects`, { headers })).status, 401);
  assert.equal((await fetch(`${base}/activity`, { headers })).status, 401);
  assert.equal((await scoped(`${draft.id}/approve`)).status, 401);
  assert.equal((await fetch(`${base}/handoffs/${draft.id}`, { headers })).status, 401);
  assert.equal((await (await fetch(`${base}/handoffs/${draft.id}`)).json() as any).status, "draft");
  assert.equal((await scoped(`00000000-0000-4000-8000-000000000000/load`)).status, 401);
  assert.equal((await scoped(`${draft.id}/load`)).status, 409);
  assert.equal((await post(`${base}/handoffs/${draft.id}/approve`, {})).status, 200);
  assert.equal((await scoped(`${draft.id}/load`)).status, 200);
});

test("activity is global, bounded, and promotes recently retrieved packages", async () => {
  const fixtures = [];
  for (let index = 0; index < 24; index++) {
    const root = join(temp, `activity-${index}`);
    await mkdir(root);
    const project = await (await post(`${base}/projects`, { name: `Activity ${index}`, rootPath: root })).json() as any;
    fixtures.push(await (await post(`${base}/projects/${project.id}/handoffs`, {
      source: "codex", destination: "opencode", title: `Activity handoff ${index}`,
    })).json() as any);
  }
  const oldest = fixtures[0];
  const first = await (await fetch(`${base}/activity`)).json() as any;
  assert.ok(first.projectCount >= 24);
  assert.equal(first.handoffs.length, 20);
  assert.equal(first.handoffs.some((handoff: any) => handoff.id === oldest.id), false);
  assert.equal((await post(`${base}/handoffs/${oldest.id}/approve`, {})).status, 200);
  assert.equal((await post(`${base}/handoffs/${oldest.id}/load`, { destination: "opencode" })).status, 200);
  const recent = await (await fetch(`${base}/activity`)).json() as any;
  assert.deepEqual(recent.handoffs[0], {
    id: oldest.id, projectId: oldest.projectId, title: oldest.title, source: "codex", destination: "opencode",
    status: "loaded", verification: oldest.verification, createdAt: oldest.createdAt, itemCount: 0,
  });
});

test("SQLite backup and restore preserve project data", async () => {
  const source = join(temp, "relay.sqlite");
  const backup = join(temp, "backup.sqlite");
  const restored = join(temp, "restored.sqlite");
  const copy = (...args: string[]) => execFileSync(process.execPath, ["--import", "tsx", "src/database-copy.ts", ...args], { windowsHide: true, stdio: "pipe" });
  copy(source, backup);
  const placeholder = new DatabaseSync(restored);
  placeholder.exec("CREATE TABLE placeholder (id INTEGER)");
  placeholder.close();
  copy(backup, restored, "--restore");
  const db = new DatabaseSync(restored, { readOnly: true });
  try {
    assert.equal(db.prepare("SELECT name FROM projects WHERE name = 'Scoped'").get()?.name, "Scoped");
    assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 1);
  } finally { db.close(); }
});

test("local API rejects hostile Host and cross-site browser requests", async () => {
  const hostileHost = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const target = new URL(`${base}/health`);
    const request = httpRequest({ hostname: target.hostname, port: target.port, path: target.pathname, headers: { host: "attacker.example" } }, response => {
      let body = ""; response.setEncoding("utf8").on("data", chunk => body += chunk).on("end", () => resolve({ status: response.statusCode ?? 0, body }));
    });
    request.on("error", reject); request.end();
  });
  assert.equal(hostileHost.status, 403);
  assert.equal(JSON.parse(hostileHost.body).error.code, "HOST_NOT_ALLOWED");
  const hostileOrigin = await fetch(`${base}/projects`, { headers: { origin: "https://attacker.example" } });
  assert.equal(hostileOrigin.status, 403);
  assert.equal((await hostileOrigin.json() as any).error.code, "ORIGIN_NOT_ALLOWED");
  const crossSite = await fetch(`${base}/health`, { headers: { "sec-fetch-site": "cross-site" } });
  assert.equal(crossSite.status, 403);
  assert.equal((await crossSite.json() as any).error.code, "CROSS_SITE_REQUEST");
  const unsupportedMethod = await fetch(`${base}/projects`, { method: "DELETE" });
  assert.equal(unsupportedMethod.status, 405);
  assert.equal(unsupportedMethod.headers.get("allow"), "GET, POST, OPTIONS");
  const wrongContentType = await fetch(`${base}/projects`, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(wrongContentType.status, 415);
  assert.equal((await wrongContentType.json() as any).error.code, "JSON_REQUIRED");
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200, "local desktop and MCP requests without browser metadata remain usable");
  assert.equal((await health.json() as any).service, "relay-ai", "desktop startup can distinguish Relay from another local service on the port");
});

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
  const emptyReceipt = await (await fetch(`${base}/handoffs/${handoff.id}/receipt`)).json() as any;
  assert.equal(emptyReceipt.retrievalCount, 0);
  assert.deepEqual(emptyReceipt.retrievals, []);
  assert.equal((await fetch(`${base}/handoffs/${handoff.id}/context?destination=codex`)).status, 409);

  const approved = await post(`${base}/handoffs/${handoff.id}/approve`, { includeItemIds: [item.id] });
  assert.equal(approved.status, 200);
  const directDb = new DatabaseSync(join(temp, "relay.sqlite"));
  directDb.exec("CREATE TRIGGER fail_receipt_insert BEFORE INSERT ON handoff_receipts BEGIN SELECT RAISE(FAIL, 'synthetic receipt storage failure'); END");
  const failedLoad = await post(`${base}/handoffs/${handoff.id}/load`, { destination: "codex" });
  assert.equal(failedLoad.status, 500, "a receipt storage failure is returned to the caller");
  const afterFailedLoad = (await (await fetch(`${base}/projects/${project.id}/handoffs`)).json() as any[])[0];
  assert.equal(afterFailedLoad.status, "approved", "loaded state and retrieval receipt are committed atomically");
  directDb.exec("DROP TRIGGER fail_receipt_insert");
  directDb.close();
  assert.equal((await post(`${base}/handoffs/${handoff.id}/load`, { destination: "opencode" })).status, 403);
  const loaded = await post(`${base}/handoffs/${handoff.id}/load`, { destination: "codex" });
  assert.equal(loaded.status, 200);
  const payload = await loaded.json() as any;
  assert.equal(payload.handoff.status, "loaded");
  assert.equal(payload.items[0].id, item.id);
  const replay = await post(`${base}/handoffs/${handoff.id}/load`, { destination: "codex" });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json() as any).items[0].id, item.id);
  const receipt = await (await fetch(`${base}/handoffs/${handoff.id}/receipt`)).json() as any;
  assert.equal(receipt.handoffId, handoff.id);
  assert.equal(receipt.destination, "codex");
  assert.deepEqual(receipt.approvedItemIds, [item.id]);
  assert.equal(receipt.approvedItems[0].content, "Finish the login redirect", "receipt retains the exact approved context returned at retrieval time");
  assert.equal(receipt.repositoryStatus, "unverified", "non-git folders are never labeled verified");
  assert.equal(receipt.retrievalCount, 2, "each successful retrieval endpoint call gets a receipt");
  assert.equal(receipt.retrievals.length, 2);
  assert.equal(receipt.retrievals[0].approvedItems[0].id, item.id);
  assert.ok(receipt.retrievals.every((entry: any) => entry.retrievedAt && entry.destination === "codex"));
  assert.ok(Array.isArray(receipt.evidence));
  assert.equal((await fetch(`${base}/handoffs/${handoff.id}/context?destination=opencode`)).status, 403);
  const history = await fetch(`${base}/projects/${project.id}/handoffs`);
  assert.equal((await history.json() as any[]).length, 1);
});

test("concurrent draft refreshes cannot undo a human-approved handoff", async () => {
  const root = join(temp, "approval-refresh-race");
  await mkdir(root);
  await writeFile(join(root, "tracked.txt"), "release fixture\n");
  execFileSync("git", ["init", root], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "config", "user.name", "Relay test"], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "config", "user.email", "relay-test@example.invalid"], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "add", "tracked.txt"], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "commit", "-m", "fixture"], { stdio: "ignore" });
  await Promise.all(Array.from({ length: 1200 }, (_, index) => writeFile(join(root, `untracked-${index}.txt`), `fixture ${index}\n`)));

  const project = await (await post(`${base}/projects`, { name: "Approval race fixture", rootPath: root })).json() as any;
  const draft = await (await post(`${base}/projects/${project.id}/handoffs`, { source: "codex", destination: "opencode" })).json() as any;
  const staleReads = Array.from({ length: 4 }, () => fetch(`${base}/handoffs/${draft.id}`).then(response => response.json() as Promise<any>));
  await delay(20);
  assert.equal((await post(`${base}/handoffs/${draft.id}/approve`, {})).status, 200);
  await Promise.all(staleReads);
  assert.equal((await (await fetch(`${base}/handoffs/${draft.id}`)).json() as any).status, "approved");
});

test("MCP retrieves only an approved handoff for the intended destination", async () => {
  const mcpRoot = join(temp, "mcp-project");
  await mkdir(mcpRoot);
  const project = await (await post(`${base}/projects`, { name: "MCP handoff fixture", rootPath: mcpRoot })).json() as any;
  const item = await (await post(`${base}/projects/${project.id}/memory`, { kind: "task", content: "Finish the synthetic redirect", source: "user" })).json() as any;
  const draft = await (await post(`${base}/projects/${project.id}/handoffs`, { source: "codex", destination: "opencode", memoryItemIds: [item.id] })).json() as any;
  const mcp = spawn(process.execPath, ["--import", "tsx", "../mcp/src/index.ts"], {
    cwd: resolve("."), env: { ...process.env, RELAY_API_URL: base, RELAY_MCP_ACCESS_TOKEN: installationToken }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
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

test("contradictory Git claims are flagged and must be removed or resolved before approval", async () => {
  const root = join(temp, "git-claim-project");
  await mkdir(root);
  execFileSync("git", ["init", root], { windowsHide: true, stdio: "ignore" });
  const project = await (await post(`${base}/projects`, { name: "Git claim fixture", rootPath: root })).json() as any;
  const item = await (await post(`${base}/projects/${project.id}/memory`, {
    kind: "note", content: "Checkout is not a Git repository, so Git evidence is unverified.", source: "assistant",
  })).json() as any;
  const draft = await (await post(`${base}/projects/${project.id}/handoffs`, {
    source: "codex", destination: "opencode", memoryItemIds: [item.id],
  })).json() as any;
  const db = new DatabaseSync(join(temp, "relay.sqlite"));
  db.prepare("UPDATE handoffs SET evidence_json=?,verification=? WHERE id=?").run("[]", "unverified", draft.id);
  db.close();
  const reopened = await (await fetch(`${base}/handoffs/${draft.id}`)).json() as any;
  assert.equal(reopened.verification, "conflict", "opening a saved draft refreshes current repository claims");
  assert.ok(draft.evidence.some((entry: any) => entry.kind === "memory-claim" && entry.status === "conflict" && entry.memoryItemId === item.id));
  const blocked = await post(`${base}/handoffs/${draft.id}/approve`, {});
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json() as any).error.code, "HANDOFF_CONFLICT");

  const excluded = await post(`${base}/handoffs/${draft.id}/approve`, { includeItemIds: [] });
  assert.equal(excluded.status, 200);
  const approved = await excluded.json() as any;
  assert.deepEqual(approved.memoryItemIds, []);
  assert.doesNotMatch(approved.summary, /not a Git repository/i);
  assert.equal(approved.verification, "unverified");
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

  const newFile = join(root, "untracked.txt");
  await writeFile(newFile, "alpha");
  const untrackedDraft = await (await post(`${base}/projects/${project.id}/handoffs`, { source: "codex", destination: "opencode" })).json() as any;
  await writeFile(newFile, "bravo");
  assert.equal((await post(`${base}/handoffs/${untrackedDraft.id}/approve`, {})).status, 409);

  const freshDraft = await (await post(`${base}/projects/${project.id}/handoffs`, { source: "codex", destination: "opencode", memoryItemIds: [item.id] })).json() as any;
  assert.equal((await post(`${base}/handoffs/${freshDraft.id}/approve`, { includeItemIds: [item.id] })).status, 200);
  assert.equal((await post(`${base}/handoffs/${freshDraft.id}/load`, { destination: "opencode" })).status, 200);
  await writeFile(join(root, "example.txt"), "changed after loading\n");
  assert.equal((await fetch(`${base}/handoffs/${freshDraft.id}/context?destination=opencode`)).status, 409);
  assert.equal((await post(`${base}/handoffs/${freshDraft.id}/load`, { destination: "opencode" })).status, 409);
  const staleReceipt = await (await fetch(`${base}/handoffs/${freshDraft.id}/receipt`)).json() as any;
  assert.equal(staleReceipt.repositoryStatus, "stale", "receipts surface repository drift after retrieval");
  assert.equal(staleReceipt.approvedItems[0].content, item.content, "the receipt preserves the retrieved text even if the repository later changes");
});
