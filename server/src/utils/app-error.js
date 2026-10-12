/**
 * app-error.js — An error that is safe to show to the client.
 * Services throw it; the central error handler turns it into `{ ok: false, code, error }`.
 */

class AppError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code machine-readable code, e.g. 'NOT_FOUND'
   * @param {string} message text shown to the user
   * @param {{ fieldErrors?: Object<string, string> }} [extra]
   */
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fieldErrors = extra.fieldErrors;
  }
}

const badRequest = (code, message, extra) => new AppError(400, code, message, extra);
const unauthenticated = (message = 'Please log in to continue.') => new AppError(401, 'UNAUTHENTICATED', message);
const forbidden = (message = 'You are not allowed to do this.', code = 'NOT_ALLOWED') => new AppError(403, code, message);
const notFound = (message = 'Not found.', code = 'NOT_FOUND') => new AppError(404, code, message);
const conflict = (code, message, extra) => new AppError(409, code, message, extra);

/** Thrown when a form has invalid fields; `fieldErrors` maps field name → message. */
function validationFailed(fieldErrors, message = 'Please correct the highlighted fields.') {
  return new AppError(400, 'VALIDATION_FAILED', message, { fieldErrors });
}

/** Throws validationFailed when the map has any entry. */
function assertValid(fieldErrors, message) {
  if (Object.keys(fieldErrors).length > 0) throw validationFailed(fieldErrors, message);
}

module.exports = {
  AppError, badRequest, unauthenticated, forbidden, notFound, conflict, validationFailed, assertValid,
};
