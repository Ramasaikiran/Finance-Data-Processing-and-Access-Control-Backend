// src/services/authService.js

const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const crypto  = require("crypto");
const { getDb } = require("../config/database");
const { sendVerificationEmail } = require("./emailService");
const {
  UnauthorizedError,
  ConflictError,
  ValidationError,
  AppError,
} = require("../utils/errors");

const { JWT_SECRET = "dev_secret_change_me", JWT_EXPIRES_IN = "24h" } = process.env;

// ── Helpers ───────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/** Remove every field that must never leave the service layer. */
function safeUser(user) {
  const { password, verification_token, verification_token_expires_at, ...rest } = user;
  return rest;
}

/**
 * Generate a cryptographically random hex token and an expiry timestamp
 * 24 hours from now (stored as ISO string so SQLite can compare it easily).
 */
function makeVerificationToken() {
  const token     = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return { token, expiresAt };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register: create the user, generate a verification token, send the email.
 * The user cannot log in until they click the link in that email.
 */
async function register({ name, email, password, role = "viewer" }) {
  const db = getDb();

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) throw new ConflictError(`Email '${email}' is already in use`);

  const hash                 = bcrypt.hashSync(password, 10);
  const { token, expiresAt } = makeVerificationToken();

  const result = db.prepare(`
    INSERT INTO users
      (name, email, password, role, email_verified, verification_token, verification_token_expires_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(name, email, hash, role, token, expiresAt);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);

  // Fire-and-forget: send failure should not block the HTTP response
  sendVerificationEmail({ name, email, token }).catch((err) => {
    console.error(`[email] Failed to send verification email to ${email}:`, err.message);
  });

  return safeUser(user);
}

/**
 * Consume a verification token.
 * Marks the user verified and clears the token so it cannot be reused.
 */
function verifyEmail(token) {
  if (!token) throw new ValidationError("Verification token is required");

  const db   = getDb();
  const user = db.prepare(
    "SELECT * FROM users WHERE verification_token = ?"
  ).get(token);

  if (!user) {
    throw new AppError("Invalid or already-used verification link", 400, "INVALID_TOKEN");
  }

  if (new Date(user.verification_token_expires_at) < new Date()) {
    throw new AppError(
      "This verification link has expired. Please request a new one.",
      400,
      "TOKEN_EXPIRED"
    );
  }

  db.prepare(`
    UPDATE users
    SET email_verified = 1,
        verification_token = NULL,
        verification_token_expires_at = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(user.id);

  return safeUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id));
}

/**
 * Resend verification email with a fresh token.
 * Same response whether or not the email exists — no user enumeration.
 */
async function resendVerification(email) {
  const db   = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);

  if (!user) return; // silent — caller gets a success response either way

  if (user.email_verified) {
    throw new AppError("This email address is already verified", 400, "ALREADY_VERIFIED");
  }

  const { token, expiresAt } = makeVerificationToken();

  db.prepare(`
    UPDATE users
    SET verification_token = ?,
        verification_token_expires_at = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(token, expiresAt, user.id);

  await sendVerificationEmail({ name: user.name, email: user.email, token });
}

/**
 * Login: checks credentials → email verified → account active → issues JWT.
 */
function login({ email, password }) {
  const db   = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);

  // Vague message intentionally — prevents user enumeration
  if (!user || !bcrypt.compareSync(password, user.password)) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (!user.email_verified) {
    throw new UnauthorizedError(
      "Please verify your email address before logging in. Check your inbox for the verification link."
    );
  }

  if (user.status !== "active") {
    throw new UnauthorizedError("Your account has been deactivated. Contact an admin.");
  }

  return { token: signToken(user), user: safeUser(user) };
}

module.exports = { register, login, verifyEmail, resendVerification };
