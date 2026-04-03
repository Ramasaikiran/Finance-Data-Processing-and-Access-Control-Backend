// src/utils/response.js
// Uniform JSON envelope so every response has the same shape:
//   { success, data, meta?, message? }

function success(res, data, { statusCode = 200, meta, message } = {}) {
  const body = { success: true };
  if (message)           body.message = message;
  if (data !== undefined) body.data   = data;
  if (meta)              body.meta    = meta;
  return res.status(statusCode).json(body);
}

function created(res, data, message) {
  return success(res, data, { statusCode: 201, message });
}

function noContent(res) {
  return res.status(204).send();
}

module.exports = { success, created, noContent };
