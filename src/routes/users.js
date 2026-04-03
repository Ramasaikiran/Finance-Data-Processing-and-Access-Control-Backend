// src/routes/users.js
// All routes require authentication + admin role.

const { Router }       = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/auth");
const { authorize }    = require("../middleware/rbac");
const { validate }     = require("../middleware/validate");
const userService      = require("../services/userService");
const { success, created, noContent } = require("../utils/response");

const router = Router();

// All routes in this file require admin
router.use(authenticate, authorize("admin"));

// ── GET /api/users ─────────────────────────────────────────────────────────────
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be 1-100"),
  ],
  validate,
  (req, res, next) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = userService.listUsers({ page: +page, limit: +limit });
      success(res, result.users, {
        meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/users/:id ─────────────────────────────────────────────────────────
router.get(
  "/:id",
  param("id").isInt({ min: 1 }).withMessage("id must be a positive integer"),
  validate,
  (req, res, next) => {
    try {
      success(res, userService.getUserById(+req.params.id));
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/users ────────────────────────────────────────────────────────────
router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("role").optional().isIn(["viewer", "analyst", "admin"]).withMessage("Invalid role"),
  ],
  validate,
  (req, res, next) => {
    try {
      created(res, userService.createUser(req.body), "User created");
    } catch (err) {
      next(err);
    }
  }
);

// ── PUT /api/users/:id ─────────────────────────────────────────────────────────
router.put(
  "/:id",
  [
    param("id").isInt({ min: 1 }),
    body("email").optional().isEmail().withMessage("Valid email required"),
    body("role").optional().isIn(["viewer", "analyst", "admin"]).withMessage("Invalid role"),
    body("status").optional().isIn(["active", "inactive"]).withMessage("Invalid status"),
  ],
  validate,
  (req, res, next) => {
    try {
      success(res, userService.updateUser(+req.params.id, req.body), { message: "User updated" });
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/users/:id/status ────────────────────────────────────────────────
router.patch(
  "/:id/status",
  [
    param("id").isInt({ min: 1 }),
    body("status").isIn(["active", "inactive"]).withMessage("status must be 'active' or 'inactive'"),
  ],
  validate,
  (req, res, next) => {
    try {
      success(res, userService.setStatus(+req.params.id, req.body.status), { message: "Status updated" });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/users/:id ──────────────────────────────────────────────────────
router.delete(
  "/:id",
  param("id").isInt({ min: 1 }).withMessage("id must be a positive integer"),
  validate,
  (req, res, next) => {
    try {
      // Prevent admin from deleting their own account
      if (+req.params.id === req.user.id) {
        return next({ isOperational: true, statusCode: 400, code: "BAD_REQUEST", message: "You cannot delete your own account" });
      }
      userService.deleteUser(+req.params.id);
      noContent(res);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
