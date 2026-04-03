// src/config/database.js
// Sets up SQLite via better-sqlite3 and runs schema migrations on first boot.
// All table definitions live here so the schema is easy to find and reason about.

const Database = require("better-sqlite3");
const path = require("path");
const { DB_PATH = "./finance.db" } = process.env;

let db;

function getDb() {
  if (!db) {
    db = new Database(path.resolve(DB_PATH));
    db.pragma("journal_mode = WAL");   // safer concurrent reads
    db.pragma("foreign_keys = ON");    // enforce FK constraints
    migrate(db);
  }
  return db;
}

function migrate(db) {
  // ── Migration version table ───────────────────────────────────────────────
  // Each migration runs exactly once; the version number is stored so later
  // boots are no-ops.  Adding a new migration = append a new entry.
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare("SELECT version FROM _migrations").all().map((r) => r.version)
  );

  const run = (version, sql) => {
    if (applied.has(version)) return;
    db.exec(sql);
    db.prepare("INSERT INTO _migrations (version) VALUES (?)").run(version);
  };

  // ── v1: base schema ───────────────────────────────────────────────────────
  run(1, `
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'viewer'
                          CHECK(role IN ('viewer','analyst','admin')),
      status      TEXT    NOT NULL DEFAULT 'active'
                          CHECK(status IN ('active','inactive')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount      REAL    NOT NULL CHECK(amount > 0),
      type        TEXT    NOT NULL CHECK(type IN ('income','expense')),
      category    TEXT    NOT NULL,
      date        TEXT    NOT NULL,
      notes       TEXT,
      created_by  INTEGER NOT NULL REFERENCES users(id),
      deleted_at  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_type     ON records(type)     WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_records_category ON records(category) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_records_date     ON records(date)     WHERE deleted_at IS NULL;
  `);

  // ── v2: email verification columns ───────────────────────────────────────
  run(2, `
    ALTER TABLE users ADD COLUMN email_verified          INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN verification_token      TEXT;
    ALTER TABLE users ADD COLUMN verification_token_expires_at TEXT;
  `);
}

module.exports = { getDb };
