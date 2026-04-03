// src/services/userService.js

const bcrypt = require("bcryptjs");
const { getDb }  = require("../config/database");
const { NotFoundError, ConflictError } = require("../utils/errors");

function safeUser({ password, ...rest }) { return rest; }

function listUsers({ page = 1, limit = 20 } = {}) {
  const db     = getDb();
  const offset = (page - 1) * limit;
  const users  = db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?")
                   .all(limit, offset)
                   .map(safeUser);
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM users").get();
  return { users, total, page, limit, pages: Math.ceil(total / limit) };
}

function getUserById(id) {
  const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) throw new NotFoundError("User");
  return safeUser(user);
}

function createUser({ name, email, password, role = "viewer" }) {
  const db      = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) throw new ConflictError(`Email '${email}' is already in use`);

  const hash   = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password, role)
    VALUES (?, ?, ?, ?)
  `).run(name, email, hash, role);

  return safeUser(db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid));
}

function updateUser(id, { name, email, role, status }) {
  const db   = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) throw new NotFoundError("User");

  // Check email conflict only when it changes
  if (email && email.toLowerCase() !== user.email.toLowerCase()) {
    const taken = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, id);
    if (taken) throw new ConflictError(`Email '${email}' is already in use`);
  }

  db.prepare(`
    UPDATE users
    SET name       = COALESCE(?, name),
        email      = COALESCE(?, email),
        role       = COALESCE(?, role),
        status     = COALESCE(?, status),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(name ?? null, email ?? null, role ?? null, status ?? null, id);

  return safeUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function setStatus(id, status) {
  const db   = getDb();
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) throw new NotFoundError("User");
  db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  return safeUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function deleteUser(id) {
  const db   = getDb();
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) throw new NotFoundError("User");
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

module.exports = { listUsers, getUserById, createUser, updateUser, setStatus, deleteUser };
