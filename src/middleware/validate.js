// src/middleware/validate.js
// Thin wrapper around express-validator.  Routes declare their validation
// chains; this middleware collects the results and rejects bad requests
// before they reach the service layer.

const { validationResult } = require("express-validator");
const { ValidationError }  = require("../utils/errors");

function validate(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Collect all messages into one readable string
    const messages = errors.array().map((e) => `${e.path}: ${e.msg}`).join("; ");
    return next(new ValidationError(messages));
  }
  next();
}

module.exports = { validate };
