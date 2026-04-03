// src/middleware/auth.js
// Verifies the Bearer token on every protected route.
// On success, attaches the decoded payload as req.user so downstream
// handlers can read role/id without hitting the DB again.

const jwt = require("jsonwebtoken");
const { UnauthorizedError } = require("../utils/errors");

const { JWT_SECRET = "dev_secret_change_me" } = process.env;

function authenticate(req, _res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return next(new UnauthorizedError("No token provided"));

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new UnauthorizedError("Token has expired"));
    }
    return next(new UnauthorizedError("Invalid token"));
  }
}

module.exports = { authenticate };
