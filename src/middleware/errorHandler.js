// src/middleware/errorHandler.js
// Single place that converts any thrown/next(err) error into a consistent
// JSON response.  Operational errors (AppError subclasses) expose their
// message; programmer errors get a generic 500 so we don't leak internals.

const { AppError } = require("../utils/errors");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      code:    err.code,
      message: err.message,
    });
  }

  // Unexpected / programmer error
  const isDev = process.env.NODE_ENV !== "production";
  console.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    code:    "INTERNAL_ERROR",
    message: isDev ? err.message : "An unexpected error occurred",
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
