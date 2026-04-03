// src/app.js
// Wires together Express middleware and all route modules.
// Kept separate from server.js so the app can be imported in tests
// without binding to a port.

require("dotenv").config();
const express        = require("express");
const helmet         = require("helmet");
const cors           = require("cors");
const morgan         = require("morgan");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes      = require("./routes/auth");
const userRoutes      = require("./routes/users");
const recordRoutes    = require("./routes/records");
const dashboardRoutes = require("./routes/dashboard");

const app = express();

// ── Security & utility middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ── Health check (unauthenticated) ────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);
app.use("/api/users",     userRoutes);
app.use("/api/records",   recordRoutes);
app.use("/api/dashboard", dashboardRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

module.exports = app;
