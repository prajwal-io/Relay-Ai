import { backup, DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

async function run() {
  const [source, destination, operation] = process.argv.slice(2);
  if (!source || !destination || resolve(source) === resolve(destination) ||
      (operation !== "--restore" && existsSync(destination))) {
    throw new Error("Choose an existing Relay database and a new destination file.");
  }
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('projects','memory_items','handoffs','handoff_receipts')").all();
    const version = Number(db.prepare("PRAGMA user_version").get()?.user_version);
    if (tables.length !== 4 || version > 1 || db.prepare("PRAGMA quick_check").get()?.quick_check !== "ok" ||
        db.prepare("PRAGMA foreign_key_check").get()) {
      throw new Error("This file is not a compatible, intact Relay database.");
    }
    await backup(db, destination);
  } finally {
    db.close();
  }
}

void run().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
