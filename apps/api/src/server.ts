import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "./db.js";
import { collectRepositoryEvidence, validateRootPath } from "./repository.js";
import type { AgentKind, Evidence, Handoff, MemoryItem, MemoryKind, Project } from "../../../packages/shared/src/contracts.js";
import { configuredExtractionProvider, extractContext } from "./intelligence.js";

const API = "/api/v1";
const exec = promisify(execFile);
const PORT = Number(process.env.PORT ?? 4317);
const HOST = process.env.HOST ?? "127.0.0.1";
const allowedOrigins = new Set(
  ["http://localhost:5173", "http://127.0.0.1:5173", process.env.WEB_ORIGIN, ...(process.env.WEB_ORIGINS ?? "").split(",")]
    .flatMap((value) => {
      const candidate = value?.trim();
      if (!candidate) return [];
      try {
        const parsed = new URL(candidate);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? [parsed.origin] : [];
      } catch { return []; }
    }),
);
const agentKinds = new Set<AgentKind>(["opencode", "codex", "other"]);
const memoryKinds = new Set<MemoryKind>(["task", "decision", "file", "issue", "note"]);

function json(res: ServerResponse, status: number, payload: unknown, origin?: string | null) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...(origin && allowedOrigins.has(origin) ? { "access-control-allow-origin": origin, "vary": "Origin" } : {}),
  });
  res.end(JSON.stringify(payload));
}

function fail(res: ServerResponse, status: number, code: string, message: string, origin?: string | null, details?: unknown) {
  json(res, status, { error: { code, message, ...(details === undefined ? {} : { details }) } }, origin);
}

async function body(req: IncomingMessage): Promise<any> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw Object.assign(new Error("Request body is too large"), { status: 413, code: "BODY_TOO_LARGE" });
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error("Request body must be valid JSON"), { status: 400, code: "INVALID_JSON" }); }
}

function projectFrom(row: any): Project {
  return { id: row.id, name: row.name, rootPath: row.root_path, ...(row.repository ? { repository: row.repository } : {}), createdAt: row.created_at, updatedAt: row.updated_at };
}
function memoryFrom(row: any): MemoryItem {
  return { id: row.id, projectId: row.project_id, ...(row.session_id ? { sessionId: row.session_id } : {}), kind: row.kind, content: row.content, ...(row.status ? { status: row.status } : {}), source: row.source, ...(row.confidence == null ? {} : { confidence: row.confidence }), tags: JSON.parse(row.tags_json), evidence: JSON.parse(row.evidence_json), createdAt: row.created_at, updatedAt: row.updated_at };
}
function handoffFrom(row: any): Handoff {
  return { id: row.id, projectId: row.project_id, source: row.source, destination: row.destination, title: row.title, summary: row.summary, memoryItemIds: JSON.parse(row.memory_ids_json), evidence: JSON.parse(row.evidence_json), verification: row.verification, status: row.status, createdAt: row.created_at, ...(row.approved_at ? { approvedAt: row.approved_at } : {}), ...(row.loaded_at ? { loadedAt: row.loaded_at } : {}) };
}
function loadProject(id: string): Project {
  const row = db.prepare("SELECT * FROM projects WHERE id=?").get(id) as any;
  if (!row) throw Object.assign(new Error("Project was not found"), { status: 404, code: "PROJECT_NOT_FOUND" });
  return projectFrom(row);
}
function loadHandoff(id: string): Handoff {
  const row = db.prepare("SELECT * FROM handoffs WHERE id=?").get(id) as any;
  if (!row) throw Object.assign(new Error("Handoff was not found"), { status: 404, code: "HANDOFF_NOT_FOUND" });
  return handoffFrom(row);
}
function allMemory(projectId: string): MemoryItem[] {
  return (db.prepare("SELECT * FROM memory_items WHERE project_id=? ORDER BY updated_at DESC").all(projectId) as any[]).map(memoryFrom);
}
function normalize(content: string) { return content.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
function rankItems(items: MemoryItem[], query = ""): MemoryItem[] {
  const terms = new Set(normalize(query).split(" ").filter((s) => s.length > 2));
  return [...items].map((item) => {
    const text = normalize(`${item.content} ${item.tags.join(" ")}`);
    const score = [...terms].reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0)
      + (item.status === "in-progress" ? 5 : item.status === "blocked" ? 4 : item.status === "open" ? 3 : 0)
      + (item.kind === "decision" ? 1 : 0);
    return { item, score };
  }).sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt)).map(({ item }) => item).slice(0, 40);
}
function saveHandoff(h: Handoff) {
  db.prepare(`INSERT INTO handoffs (id,project_id,source,destination,title,summary,memory_ids_json,evidence_json,verification,status,created_at,approved_at,loaded_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(h.id,h.projectId,h.source,h.destination,h.title,h.summary,JSON.stringify(h.memoryItemIds),JSON.stringify(h.evidence),h.verification,h.status,h.createdAt,h.approvedAt ?? null,h.loadedAt ?? null);
}
function updateHandoff(h: Handoff) {
  db.prepare("UPDATE handoffs SET memory_ids_json=?,evidence_json=?,verification=?,status=?,approved_at=?,loaded_at=? WHERE id=?")
    .run(JSON.stringify(h.memoryItemIds),JSON.stringify(h.evidence),h.verification,h.status,h.approvedAt ?? null,h.loadedAt ?? null,h.id);
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return fail(res, 403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed to access the Relay service", origin);
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": origin && allowedOrigins.has(origin) ? origin : "null", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600", vary: "Origin" });
    return res.end();
  }
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    if (req.method === "GET" && url.pathname === `${API}/health`) return json(res, 200, { ok: true, version: "0.1.0", intelligenceProvider: configuredExtractionProvider() }, origin);
  if (!url.pathname.startsWith(API)) return fail(res, 404, "NOT_FOUND", "Route not found", origin);
  const path = url.pathname.slice(API.length).split("/").filter(Boolean).map(decodeURIComponent);
  const method = req.method ?? "GET";

  if (method === "GET" && path.length === 1 && path[0] === "projects") {
    return json(res, 200, (db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as any[]).map(projectFrom), origin);
  }
  if (method === "POST" && path.length === 1 && path[0] === "projects") {
    const data = await body(req);
    const name = typeof data.name === "string" ? data.name.trim().slice(0, 120) : "";
    if (!name) return fail(res, 400, "INVALID_NAME", "Project name is required", origin);
    const rootPath = await validateRootPath(data.rootPath);
    const now = new Date().toISOString();
    const id = randomUUID();
    try { db.prepare("INSERT INTO projects (id,name,root_path,created_at,updated_at) VALUES (?,?,?,?,?)").run(id,name,rootPath,now,now); }
    catch (e: any) { if (String(e.message).includes("UNIQUE")) return fail(res, 409, "PROJECT_EXISTS", "That directory is already registered", origin); throw e; }
    return json(res, 201, projectFrom(db.prepare("SELECT * FROM projects WHERE id=?").get(id) as any), origin);
  }
  if (path[0] === "projects" && path[1] && path.length === 2 && method === "GET") return json(res, 200, loadProject(path[1]), origin);
  if (path[0] === "projects" && path[1] && path[2] === "memory") {
    loadProject(path[1]);
    if (method === "GET") {
      const kind = url.searchParams.get("kind");
      if (kind && !memoryKinds.has(kind as MemoryKind)) return fail(res, 400, "INVALID_KIND", "Unknown memory kind", origin);
      const q = normalize(url.searchParams.get("q") ?? "");
      const filtered = allMemory(path[1]).filter((m) => (!kind || m.kind === kind) && (!q || normalize(`${m.content} ${m.tags.join(" ")}`).includes(q)));
      return json(res, 200, filtered, origin);
    }
    if (method === "POST") {
      const data = await body(req);
      if (!memoryKinds.has(data.kind) || typeof data.content !== "string" || !data.content.trim()) return fail(res, 400, "INVALID_MEMORY", "kind and non-empty content are required", origin);
      const content = data.content.trim().slice(0, 16_000);
      const norm = normalize(content);
      const duplicate = db.prepare("SELECT * FROM memory_items WHERE project_id=? AND normalized=?").get(path[1], norm) as any;
      if (duplicate) return json(res, 200, memoryFrom(duplicate), origin);
      const now = new Date().toISOString(); const id = randomUUID();
      const item: MemoryItem = { id, projectId: path[1], ...(typeof data.sessionId === "string" ? { sessionId: data.sessionId } : {}), kind: data.kind, content, ...(data.status ? { status: data.status } : {}), source: ["user","assistant","model"].includes(data.source) ? data.source : "user", ...(Number.isFinite(data.confidence) ? { confidence: Math.min(1, Math.max(0, data.confidence)) } : {}), tags: Array.isArray(data.tags) ? data.tags.filter((x: unknown) => typeof x === "string").slice(0, 30) : [], evidence: Array.isArray(data.evidence) ? data.evidence.slice(0, 30).map((e: any) => ({ kind: ["git-status","git-diff","file-exists","file-content"].includes(e?.kind) ? e.kind : "file-exists", status: "unverified", description: typeof e?.description === "string" ? e.description.slice(0,500) : "Client-supplied evidence; not checked by Relay.", ...(typeof e?.path === "string" ? { path: e.path.slice(0,500) } : {}), observedAt: now, source: "user" })) as Evidence[] : [], createdAt: now, updatedAt: now };
      if (item.sessionId && !db.prepare("SELECT id FROM sessions WHERE id=? AND project_id=?").get(item.sessionId, path[1])) return fail(res, 400, "SESSION_NOT_FOUND", "Session does not belong to this project", origin);
      db.prepare(`INSERT INTO memory_items (id,project_id,session_id,kind,content,status,source,confidence,tags_json,evidence_json,normalized,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id,item.projectId,item.sessionId ?? null,item.kind,item.content,item.status ?? null,item.source,item.confidence ?? null,JSON.stringify(item.tags),JSON.stringify(item.evidence),norm,now,now);
      db.prepare("UPDATE projects SET updated_at=? WHERE id=?").run(now,path[1]);
      return json(res, 201, item, origin);
    }
  }
  if (path[0] === "projects" && path[1] && path[2] === "extract" && method === "POST") {
    loadProject(path[1]);
    const data = await body(req);
    if (typeof data.text !== "string" || !data.text.trim()) return fail(res, 400, "INVALID_TEXT", "Non-empty text is required", origin);
    // Extraction is a proposal only. The caller reviews and explicitly saves items to memory.
    return json(res, 200, await extractContext(data.text), origin);
  }
  if (path[0] === "projects" && path[1] && path[2] === "sessions") {
    loadProject(path[1]);
    if (method === "GET") return json(res, 200, db.prepare("SELECT id,project_id AS projectId,agent,label,started_at AS startedAt,ended_at AS endedAt FROM sessions WHERE project_id=? ORDER BY started_at DESC").all(path[1]), origin);
    if (method === "POST") {
      const data = await body(req); if (!agentKinds.has(data.agent)) return fail(res, 400, "INVALID_AGENT", "Unknown agent type", origin);
      const session = { id: randomUUID(), projectId: path[1], agent: data.agent, ...(typeof data.label === "string" ? { label: data.label.slice(0, 120) } : {}), startedAt: new Date().toISOString() };
      db.prepare("INSERT INTO sessions (id,project_id,agent,label,started_at) VALUES (?,?,?,?,?)").run(session.id,session.projectId,session.agent,session.label ?? null,session.startedAt);
      return json(res, 201, session, origin);
    }
  }
  if (path[0] === "projects" && path[1] && path[2] === "handoffs" && method === "GET") {
    loadProject(path[1]);
    return json(res, 200, (db.prepare("SELECT * FROM handoffs WHERE project_id=? ORDER BY created_at DESC").all(path[1]) as any[]).map(handoffFrom), origin);
  }
  if (path[0] === "projects" && path[1] && path[2] === "handoffs" && method === "POST") {
    const project = loadProject(path[1]); const data = await body(req);
    if (!agentKinds.has(data.source) || !agentKinds.has(data.destination) || data.source === data.destination) return fail(res, 400, "INVALID_AGENTS", "Choose two different supported agents", origin);
    let candidates: MemoryItem[];
    if (data.memoryItemIds !== undefined) {
      if (!Array.isArray(data.memoryItemIds) || data.memoryItemIds.length === 0 || data.memoryItemIds.length > 24 || data.memoryItemIds.some((id: unknown) => typeof id !== "string")) return fail(res, 400, "INVALID_ITEMS", "Choose between 1 and 24 project memory items", origin);
      const ids = [...new Set<string>(data.memoryItemIds)];
      candidates = memoryByIds(project.id, ids);
      if (candidates.length !== ids.length) return fail(res, 400, "ITEM_NOT_IN_PROJECT", "Every selected item must belong to this project", origin);
    } else candidates = rankItems(allMemory(project.id), typeof data.query === "string" ? data.query : "");
    const [repo, gitState] = await Promise.all([collectRepositoryEvidence(project.rootPath, candidates), getGitState(project.rootPath)]);
    const evidence = [...gitState, ...repo.evidence.filter((entry) => entry.kind !== "git-status")];
    const items = (data.memoryItemIds !== undefined ? candidates : candidates.filter((item) => item.kind !== "file" || item.status !== "open")).slice(0, 24);
    const now = new Date().toISOString();
    const itemEvidence = repo.evidence.filter((e) => e.kind !== "git-status");
    const verification = repo.conflicts.length ? "conflict" : itemEvidence.some((e) => e.status === "verified") ? "partial" : "unverified";
    const summary = items.length ? items.slice(0, 6).map((x) => `• ${x.content}`).join("\n") : "No saved project context matched this handoff yet.";
    const handoff: Handoff = { id: randomUUID(), projectId: project.id, source: data.source, destination: data.destination, title: typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, 120) : `Continue in ${data.destination}`, summary, memoryItemIds: items.map((x) => x.id), evidence, verification, status: "draft", createdAt: now };
    saveHandoff(handoff); return json(res, 201, handoff, origin);
  }
  if (path[0] === "projects" && path[1] && path[2] === "verification" && method === "GET") {
    const project = loadProject(path[1]); const items = allMemory(project.id); const [repo, gitState] = await Promise.all([collectRepositoryEvidence(project.rootPath, items), getGitState(project.rootPath)]);
    return json(res, 200, { checkedAt: new Date().toISOString(), evidence: [...gitState, ...repo.evidence.filter((entry) => entry.kind !== "git-status")], conflicts: repo.conflicts }, origin);
  }
  if (path[0] === "handoffs" && path[1]) {
    let handoff = loadHandoff(path[1]);
    if (path.length === 3 && path[2] === "approve" && method === "POST") {
      if (handoff.status !== "draft") return fail(res, 409, "INVALID_HANDOFF_STATE", "Only draft handoffs can be approved", origin);
      if (!(await snapshotIsCurrent(handoff))) return fail(res, 409, "REPOSITORY_CHANGED", "Repository state changed after this handoff was prepared; create and review a new draft", origin);
      const data = await body(req);
      if (Array.isArray(data.includeItemIds)) {
        const requested: string[] = [...new Set<string>(data.includeItemIds.filter((x: unknown): x is string => typeof x === "string"))];
        if (requested.some((id: string) => !handoff.memoryItemIds.includes(id))) return fail(res, 400, "ITEM_NOT_IN_HANDOFF", "Approved items must come from this draft package", origin);
        handoff = { ...handoff, memoryItemIds: requested };
      }
      handoff = { ...handoff, status: "approved", approvedAt: new Date().toISOString() }; updateHandoff(handoff); return json(res, 200, handoff, origin);
    }
    if (path.length === 3 && path[2] === "load" && method === "POST") {
      const data = await body(req);
      if (typeof data.destination !== "string") return fail(res, 400, "DESTINATION_REQUIRED", "The destination assistant is required", origin);
      if (data.destination !== handoff.destination) return fail(res, 403, "DESTINATION_MISMATCH", "This package was approved for a different destination", origin);
      if (handoff.status !== "approved" && handoff.status !== "loaded") return fail(res, 409, "HANDOFF_NOT_APPROVED", "Approve the handoff before loading it into a destination", origin);
      if (!(await snapshotIsCurrent(handoff))) return fail(res, 409, "REPOSITORY_CHANGED", "Repository state changed after this handoff was prepared; create and review a new draft", origin);
      if (handoff.status === "approved") {
        handoff = { ...handoff, status: "loaded", loadedAt: new Date().toISOString() };
        updateHandoff(handoff);
      }
      return json(res, 200, { handoff, items: memoryByIds(handoff.projectId, handoff.memoryItemIds) }, origin);
    }
    if (path.length === 3 && path[2] === "context" && method === "GET") {
      const destination = url.searchParams.get("destination");
      if (!destination) return fail(res, 400, "DESTINATION_REQUIRED", "The destination assistant is required", origin);
      if (destination !== handoff.destination) return fail(res, 403, "DESTINATION_MISMATCH", "This package was approved for a different destination", origin);
      if (handoff.status !== "approved" && handoff.status !== "loaded") return fail(res, 409, "HANDOFF_NOT_APPROVED", "This context is not available until the handoff is approved", origin);
      if (!(await snapshotIsCurrent(handoff))) return fail(res, 409, "REPOSITORY_CHANGED", "Repository state changed after this handoff was prepared; create and review a new draft", origin);
      return json(res, 200, { handoff, items: memoryByIds(handoff.projectId, handoff.memoryItemIds) }, origin);
    }
  }
  return fail(res, 404, "NOT_FOUND", "Route not found", origin);
}

function memoryByIds(projectId: string, ids: string[]): MemoryItem[] {
  return ids.map((id) => db.prepare("SELECT * FROM memory_items WHERE id=? AND project_id=?").get(id,projectId)).filter(Boolean).map((r: any) => memoryFrom(r));
}
async function snapshotIsCurrent(handoff: Handoff): Promise<boolean> {
  const snapshot = handoff.evidence.find((entry) => entry.kind === "git-status" && entry.description.startsWith("Repository snapshot:"));
  if (!snapshot) return true;
  const current = (await getGitState(loadProject(handoff.projectId).rootPath))[0];
  return current.description === snapshot.description;
}
async function getGitState(root: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();
  try {
    const options = { timeout: 5000, windowsHide: true, maxBuffer: 5_000_000 };
    const [status, head, diff] = await Promise.all([
      exec("git", ["-C",root,"status","--short","--branch"], options),
      exec("git", ["-C",root,"rev-parse","HEAD"], options),
      exec("git", ["-C",root,"diff","--binary","HEAD"], options),
    ]);
    const fingerprint = createHash("sha256").update(head.stdout).update("\0").update(status.stdout).update("\0").update(diff.stdout).digest("hex").slice(0, 16);
    return [{ kind: "git-status", status: "verified", description: `Repository snapshot: ${fingerprint}. Git HEAD, status, and tracked diff observed; untracked file contents are not checked.`, observedAt, source: "repository" }];
  } catch { return [{ kind: "git-status", status: "unverified", description: "Git state could not be read for this directory.", observedAt, source: "repository" }]; }
}

const server = createServer((req, res) => {
  void route(req, res).catch((error: any) => {
    const origin = req.headers.origin;
    fail(res, Number(error.status) || 500, error.code || "INTERNAL_ERROR", Number(error.status) ? error.message : "The local service could not complete the request", origin);
  });
});
server.listen(PORT, HOST, () => process.stdout.write(`Relay AI local API listening on http://${HOST}:${PORT}\n`));
