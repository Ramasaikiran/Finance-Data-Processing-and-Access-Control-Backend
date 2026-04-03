// src/routes/dashboard.js
// Summary endpoints available to all authenticated roles.
// Category/trend breakdowns are restricted to analyst and admin.

const { Router } = require("express");
const { query }  = require("express-validator");
const { authenticate }    = require("../middleware/auth");
const { authorize }       = require("../middleware/rbac");
const { validate }        = require("../middleware/validate");
const dashboardService    = require("../services/dashboardService");
const { success }         = require("../utils/response");

const router = Router();
router.use(authenticate);

// ── GET /api/dashboard/summary ─────────────────────────────────────────────────
// All roles: basic totals
router.get(
  "/summary",
  authorize("viewer", "analyst", "admin"),
  (req, res, next) => {
    try {
      success(res, dashboardService.getSummary());
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/dashboard/recent ──────────────────────────────────────────────────
// All roles: recent transactions
router.get(
  "/recent",
  authorize("viewer", "analyst", "admin"),
  [query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be 1-50")],
  validate,
  (req, res, next) => {
    try {
      success(res, dashboardService.getRecentActivity({ limit: +(req.query.limit ?? 10) }));
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/dashboard/category-totals ────────────────────────────────────────
// Analyst + admin: richer breakdown
router.get(
  "/category-totals",
  authorize("analyst", "admin"),
  [query("type").optional().isIn(["income", "expense"]).withMessage("type must be income or expense")],
  validate,
  (req, res, next) => {
    try {
      success(res, dashboardService.getCategoryTotals({ type: req.query.type }));
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/dashboard/trends/monthly ──────────────────────────────────────────
router.get(
  "/trends/monthly",
  authorize("analyst", "admin"),
  [query("months").optional().isInt({ min: 1, max: 24 }).withMessage("months must be 1-24")],
  validate,
  (req, res, next) => {
    try {
      success(res, dashboardService.getMonthlyTrends({ months: +(req.query.months ?? 6) }));
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/dashboard/trends/weekly ───────────────────────────────────────────
router.get(
  "/trends/weekly",
  authorize("analyst", "admin"),
  [query("weeks").optional().isInt({ min: 1, max: 52 }).withMessage("weeks must be 1-52")],
  validate,
  (req, res, next) => {
    try {
      success(res, dashboardService.getWeeklyTrends({ weeks: +(req.query.weeks ?? 8) }));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
