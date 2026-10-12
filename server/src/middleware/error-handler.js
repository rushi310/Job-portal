/**
 * error-handler.js — Not-found and central error handling.
 * Every error leaves the API as `{ ok: false, code, error, fieldErrors? }`. Unexpected errors are
 * logged on the server (name and message only) and shown to the client as a generic message, so
 * stack traces, queries and connection details are never exposed.
 */

const { AppError } = require('../utils/app-error');
const { config } = require('../config/env');

function notFoundHandler(req, res) {
  res.status(404).json({ ok: false, code: 'NOT_FOUND', error: 'This API route does not exist.' });
}

/** Translate errors raised by Express, body parsing and MongoDB into AppErrors. */
function toAppError(error) {
  if (error instanceof AppError) return error;
  if (error.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.');
  }
  if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return new AppError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
  if (error.name === 'CastError' || error.name === 'ValidationError') {
    return new AppError(400, 'INVALID_INPUT', 'The request contains invalid values.');
  }
  if (error.name === 'MongooseError' || error.name === 'MongoNotConnectedError'
    || error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError') {
    return new AppError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable. Please try again shortly.');
  }
  return null;
}

// Express recognises an error handler by its four parameters.
function errorHandler(error, req, res, next) {
  const appError = toAppError(error);
  if (!appError || appError.status >= 500) {
    if (!config.isTest) console.error(`error: ${req.method} ${req.path} → ${error.name}: ${error.message}`);
  }
  if (!appError) {
    res.status(500).json({ ok: false, code: 'SERVER_ERROR', error: 'Something went wrong. Please try again.' });
    return;
  }
  const body = { ok: false, code: appError.code, error: appError.message };
  if (appError.fieldErrors) body.fieldErrors = appError.fieldErrors;
  res.status(appError.status).json(body);
}

module.exports = { notFoundHandler, errorHandler };
