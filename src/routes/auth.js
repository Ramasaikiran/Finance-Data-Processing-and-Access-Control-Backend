// src/routes/auth.js

const { Router }    = require("express");
const { body, query } = require("express-validator");
const { validate }  = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { authorize }    = require("../middleware/rbac");
const authService   = require("../services/authService");
const { success, created } = require("../utils/response");

const router = Router();

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  (req, res, next) => {
    try {
      const result = authService.login(req.body);
      success(res, result, { message: "Login successful" });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/auth/register  (admin only) ─────────────────────────────────────
router.post(
  "/register",
  authenticate,
  authorize("admin"),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("role").optional().isIn(["viewer", "analyst", "admin"]).withMessage("Invalid role"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const user = await authService.register(req.body);
      created(res, user, "User registered. A verification email has been sent.");
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/auth/verify-email?token=<hex> ────────────────────────────────────
// The link in the verification email points here.
// On success we return JSON (API-first); a real frontend would redirect to a
// login page — adjust APP_URL in .env and handle that redirect client-side.
router.get(
  "/verify-email",
  [query("token").notEmpty().withMessage("token query parameter is required")],
  validate,
  (req, res, next) => {
    try {
      const user = authService.verifyEmail(req.query.token);
      success(res, { user }, { message: "Email verified successfully. You can now log in." });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/auth/resend-verification ────────────────────────────────────────
// Anyone can call this (unauthenticated) — user just needs to supply their email.
// Always returns 200 to avoid leaking whether the address exists.
router.post(
  "/resend-verification",
  [body("email").isEmail().withMessage("Valid email required")],
  validate,
  async (req, res, next) => {
    try {
      await authService.resendVerification(req.body.email);
      success(res, null, {
        message: "If that email is registered and unverified, a new verification link has been sent.",
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", authenticate, (req, res) => {
  success(res, req.user);
});

module.exports = router;
