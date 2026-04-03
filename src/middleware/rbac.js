// src/middleware/rbac.js
// Role hierarchy: admin > analyst > viewer
// `authorize(...roles)` returns a middleware that rejects anyone whose
// role isn't in the allowed list.  Routes compose this with `authenticate`.

const { ForbiddenError } = require("../utils/errors");

const ROLE_HIERARCHY = { viewer: 1, analyst: 2, admin: 3 };

/**
 * authorize("admin")          – only admins
 * authorize("analyst","admin") – analysts or admins
 * authorize("viewer","analyst","admin") – everyone (still must be logged in)
 */
function authorize(...allowedRoles) {
  return (req, _res, next) => {
    const { role } = req.user || {};
    if (!role || !allowedRoles.includes(role)) {
      return next(
        new ForbiddenError(
          `This action requires one of the following roles: ${allowedRoles.join(", ")}`
        )
      );
    }
    next();
  };
}

/**
 * requireMinRole("analyst")  – passes for analyst and admin but not viewer.
 * A convenience alternative to listing every allowed role explicitly.
 */
function requireMinRole(minRole) {
  return (req, _res, next) => {
    const userLevel = ROLE_HIERARCHY[req.user?.role] ?? 0;
    const minLevel  = ROLE_HIERARCHY[minRole] ?? 99;
    if (userLevel < minLevel) {
      return next(new ForbiddenError(`Minimum required role: ${minRole}`));
    }
    next();
  };
}

module.exports = { authorize, requireMinRole };
