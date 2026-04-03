// src/routes/records.js
// Viewers and analysts: read-only.
// Admins: full CRUD.

const { Router }              = require("express");
const { body, param, query }  = require("express-validator");
const { authenticate }        = require("../middleware/auth");
const { authorize }           = require("../middleware/rbac");
const { validate }            = require("../middleware/validate");
const recordService           = require("../services/recordService");
const { success, created, noContent } = require("../utils/response");

const router = Router();

// All record routes require authentication
router.use(authenticate);

// ── GET /api/records ───────────────────────────────────────────────────────────
// All roles can read records.
router.get(
  "/",
  authorize("viewer", "analyst", "admin"),
  [
    query("type").optional().isIn(["income", "expense"]).withMessage("type must be income or expense"),
    query("dateFrom").optional().isISO8601().withMessage("dateFrom must be a valid ISO date"),
    query("dateTo").optional().isISO8601().withMessage("dateTo must be a valid ISO date"),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  (req, res, next) => {
    try {
      const { type, category, dateFrom, dateTo, search, page = 1, limit = 20 } = req.query;
      const result = recordService.listRecords({
        type, category, dateFrom, dateTo, search,
        page: +page, limit: +limit,
      });
      success(res, result.records, {
        meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/records/:id ───────────────────────────────────────────────────────
router.get(
  "/:id",
  authorize("viewer", "analyst", "admin"),
  param("id").isInt({ min: 1 }),
  validate,
  (req, res, next) => {
    try {
      success(res, recordService.getRecordById(+req.params.id));
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/records ──────────────────────────────────────────────────────────
// Admin only
router.post(
  "/",
  authorize("admin"),
  [
    body("amount").isFloat({ gt: 0 }).withMessage("amount must be a positive number"),
    body("type").isIn(["income", "expense"]).withMessage("type must be 'income' or 'expense'"),
    body("category").notEmpty().withMessage("category is required"),
    body("date").isISO8601().withMessage("date must be a valid ISO 8601 date (YYYY-MM-DD)"),
    body("notes").optional().isString(),
  ],
  validate,
  (req, res, next) => {
    try {
      const record = recordService.createRecord(req.body, req.user.id);
      created(res, record, "Record created");
    } catch (err) {
      next(err);
    }
  }
);

// ── PUT /api/records/:id ───────────────────────────────────────────────────────
router.put(
  "/:id",
  authorize("admin"),
  [
    param("id").isInt({ min: 1 }),
    body("amount").optional().isFloat({ gt: 0 }).withMessage("amount must be a positive number"),
    body("type").optional().isIn(["income", "expense"]).withMessage("type must be 'income' or 'expense'"),
    body("date").optional().isISO8601().withMessage("date must be a valid ISO 8601 date"),
    body("notes").optional().isString(),
  ],
  validate,
  (req, res, next) => {
    try {
      success(res, recordService.updateRecord(+req.params.id, req.body), { message: "Record updated" });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/records/:id ────────────────────────────────────────────────────
// Soft-delete; the record is kept with a deleted_at timestamp.
router.delete(
  "/:id",
  authorize("admin"),
  param("id").isInt({ min: 1 }),
  validate,
  (req, res, next) => {
    try {
      recordService.deleteRecord(+req.params.id);
      noContent(res);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
