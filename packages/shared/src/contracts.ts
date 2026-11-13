/** Shared contracts for the Relay AI local service, web client, and MCP tools. */

export type AgentKind = "opencode" | "codex" | "other";
export type MemoryKind = "task" | "decision" | "file" | "issue" | "note";
export type EvidenceStatus = "verified" | "unverified" | "conflict";

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  repository?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  projectId: string;
  agent: AgentKind;
  label?: string;
  startedAt: string;
  endedAt?: string;
}

export interface Evidence {
  kind: "git-status" | "git-diff" | "file-exists" | "file-content";
  status: EvidenceStatus;
  description: string;
  path?: string;
  observedAt: string;
  source: "repository" | "model" | "user";
}

export interface MemoryItem {
  id: string;
  projectId: string;
  sessionId?: string;
  kind: MemoryKind;
  content: string;
  status?: "complete" | "in-progress" | "blocked" | "open";
  source: "user" | "assistant" | "model" | "repository";
  confidence?: number;
  tags: string[];
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
}

export interface Handoff {
  id: string;
  projectId: string;
  source: AgentKind;
  destination: AgentKind;
  title: string;
  summary: string;
  memoryItemIds: string[];
  evidence: Evidence[];
  verification: "verified" | "partial" | "unverified" | "conflict";
  status: "draft" | "approved" | "loaded" | "cancelled";
  createdAt: string;
  approvedAt?: string;
  loadedAt?: string;
}

/** Records calls to the approved-context retrieval endpoint; it does not claim model comprehension. */
export interface HandoffReceiptEntry {
  id: string;
  destination: AgentKind;
  approvedItemIds: string[];
  approvedItems: MemoryItem[];
  repositorySnapshot?: string;
  evidence: Evidence[];
  retrievedAt: string;
}

export interface HandoffReceipt {
  handoffId: string;
  destination: AgentKind;
  approvedItemIds: string[];
  approvedItems: MemoryItem[];
  repositoryStatus: "current" | "stale" | "unverified" | "unavailable";
  conflicts: string[];
  repositorySnapshot?: string;
  evidence: Evidence[];
  retrievedAt: string | null;
  retrievalCount: number;
  retrievals: HandoffReceiptEntry[];
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

/** API contract (all paths are rooted at /api/v1). */
export interface ApiContract {
  "GET /health": { response: { ok: true; version: string } };
  "GET /projects": { response: Project[] };
  "POST /projects": { body: { name: string; rootPath: string }; response: Project };
  "GET /projects/:projectId": { response: Project };
  "GET /projects/:projectId/memory": { query?: { q?: string; kind?: MemoryKind }; response: MemoryItem[] };
  "POST /projects/:projectId/memory": { body: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">; response: MemoryItem };
  "POST /projects/:projectId/handoffs": { body: { source: AgentKind; destination: AgentKind; title?: string; query?: string }; response: Handoff };
  "POST /handoffs/:handoffId/approve": { body?: { includeItemIds?: string[] }; response: Handoff };
  "POST /handoffs/:handoffId/load": { response: { handoff: Handoff; items: MemoryItem[] } };
  "GET /handoffs/:handoffId/receipt": { response: HandoffReceipt };
  "GET /handoffs/:handoffId/context": { response: { handoff: Handoff; items: MemoryItem[] } };
  "GET /projects/:projectId/handoffs": { response: Handoff[] };
  "GET /projects/:projectId/verification": { response: { checkedAt: string; evidence: Evidence[]; conflicts: string[] } };
}

