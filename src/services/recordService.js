// src/services/recordService.js
// All financial-record business logic lives here.
// Soft delete is implemented by setting deleted_at; every query filters it out.

const { getDb }       = require("../config/database");
const { NotFoundError } = require("../utils/errors");

/**
 * List records with optional filters and pagination.
 *
 * Supported filters:
 *   type     – "income" | "expense"
 *   category – exact match (case-insensitive)
 *   dateFrom – ISO date string, inclusive lower bound
 *   dateTo   – ISO date string, inclusive upper bound
 *   search   – substring match against notes or category
 */
function listRecords({ type, category, dateFrom, dateTo, search, page = 1, limit = 20 } = {}) {
  const db      = getDb();
  const where   = ["r.deleted_at IS NULL"];
  const params  = [];

  if (type)     { where.push("r.type = ?");                   params.push(type); }
  if (category) { where.push("r.category = ? COLLATE NOCASE"); params.push(category); }
  if (dateFrom) { where.push("r.date >= ?");                  params.push(dateFrom); }
  if (dateTo)   { where.push("r.date <= ?");                  params.push(dateTo); }
  if (search) {
    where.push("(r.notes LIKE ? OR r.category LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;
  const offset      = (page - 1) * limit;

  const records = db.prepare(`
    SELECT r.*, u.name AS created_by_name
    FROM   records r
    JOIN   users   u ON u.id = r.created_by
    ${whereClause}
    ORDER BY r.date DESC, r.id DESC
    LIMIT ? OFFSET ?
  `).all([...params, limit, offset]);

  const { total } = db.prepare(`
    SELECT COUNT(*) AS total FROM records r ${whereClause}
  `).get(params);

  return { records, total, page, limit, pages: Math.ceil(total / limit) };
}

function getRecordById(id) {
  const record = getDb().prepare(`
    SELECT r.*, u.name AS created_by_name
    FROM   records r
    JOIN   users   u ON u.id = r.created_by
    WHERE  r.id = ? AND r.deleted_at IS NULL
  `).get(id);
  if (!record) throw new NotFoundError("Record");
  return record;
}

function createRecord({ amount, type, category, date, notes }, userId) {
  const db     = getDb();
  const result = db.prepare(`
    INSERT INTO records (amount, type, category, date, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(amount, type, category, date, notes ?? null, userId);

  return getRecordById(result.lastInsertRowid);
}

function updateRecord(id, { amount, type, category, date, notes }) {
  const db     = getDb();
  const record = db.prepare("SELECT id FROM records WHERE id = ? AND deleted_at IS NULL").get(id);
  if (!record) throw new NotFoundError("Record");

  db.prepare(`
    UPDATE records
    SET amount     = COALESCE(?, amount),
        type       = COALESCE(?, type),
        category   = COALESCE(?, category),
        date       = COALESCE(?, date),
        notes      = COALESCE(?, notes),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(amount ?? null, type ?? null, category ?? null, date ?? null, notes ?? null, id);

  return getRecordById(id);
}

/** Soft-delete: sets deleted_at, record remains in DB for auditing. */
function deleteRecord(id) {
  const db     = getDb();
  const record = db.prepare("SELECT id FROM records WHERE id = ? AND deleted_at IS NULL").get(id);
  if (!record) throw new NotFoundError("Record");
  db.prepare("UPDATE records SET deleted_at = datetime('now') WHERE id = ?").run(id);
}

module.exports = { listRecords, getRecordById, createRecord, updateRecord, deleteRecord };
