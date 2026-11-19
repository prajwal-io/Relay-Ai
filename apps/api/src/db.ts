import { existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath = resolve(process.env.RELAY_DB_PATH ?? "./data/relay.sqlite");
export const dataDirectory = dirname(dbPath);
mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });

const existing = existsSync(dbPath);
export const db = new DatabaseSync(dbPath);
const version = Number(db.prepare("PRAGMA user_version").get()?.user_version);
if (version > 1) throw new Error("This database was created by a newer version of Relay.");
db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL");
if (version === 0 && existing && db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").get()) {
  db.prepare("VACUUM INTO ?").run(`${dbPath}.pre-v1-${randomUUID()}.sqlite`);
}
db.exec("BEGIN IMMEDIATE");
try {
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL UNIQUE,
    repository TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agent TEXT NOT NULL, label TEXT, started_at TEXT NOT NULL, ended_at TEXT
  );
  CREATE TABLE IF NOT EXISTS memory_items (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL, kind TEXT NOT NULL,
    content TEXT NOT NULL, status TEXT, source TEXT NOT NULL, confidence REAL,
    tags_json TEXT NOT NULL, evidence_json TEXT NOT NULL, normalized TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS memory_project_updated ON memory_items(project_id, updated_at DESC);
  CREATE TABLE IF NOT EXISTS handoffs (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source TEXT NOT NULL, destination TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL,
    memory_ids_json TEXT NOT NULL, evidence_json TEXT NOT NULL, verification TEXT NOT NULL,
    status TEXT NOT NULL, created_at TEXT NOT NULL, approved_at TEXT, loaded_at TEXT
  );
  CREATE TABLE IF NOT EXISTS handoff_receipts (
    id TEXT PRIMARY KEY, handoff_id TEXT NOT NULL REFERENCES handoffs(id) ON DELETE CASCADE,
    destination TEXT NOT NULL, approved_item_ids_json TEXT NOT NULL,
    approved_context_json TEXT NOT NULL DEFAULT '[]',
    repository_snapshot TEXT, evidence_json TEXT NOT NULL, retrieved_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS handoff_receipts_history ON handoff_receipts(handoff_id, retrieved_at DESC);
`);

// Local databases created before the context snapshot field can be upgraded
// in place without discarding existing retrieval receipts.
if (!db.prepare("PRAGMA table_info(handoffs)").all().some(column => column.name === "source_session_id")) {
  db.exec("ALTER TABLE handoffs ADD COLUMN source_session_id TEXT");
}
const receiptColumns = db.prepare("PRAGMA table_info(handoff_receipts)").all() as { name: string }[];
if (!receiptColumns.some((column) => column.name === "approved_context_json")) {
  db.exec("ALTER TABLE handoff_receipts ADD COLUMN approved_context_json TEXT NOT NULL DEFAULT '[]'");
}
db.exec("PRAGMA user_version = 1; COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
