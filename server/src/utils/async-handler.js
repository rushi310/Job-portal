/**
 * async-handler.js — Lets controllers be async functions: a rejected promise goes to the
 * central error handler instead of being lost (Express 4 does not do this itself).
 */

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

/** Send the standard success body `{ ok: true, data }`. */
function sendData(res, data, status = 200) {
  res.status(status).json({ ok: true, data });
}

module.exports = { asyncHandler, sendData };
