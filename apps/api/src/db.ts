import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath = resolve(process.env.RELAY_DB_PATH ?? "./data/relay.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
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
    repository_snapshot TEXT, evidence_json TEXT NOT NULL, retrieved_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS handoff_receipts_history ON handoff_receipts(handoff_id, retrieved_at DESC);
`);
