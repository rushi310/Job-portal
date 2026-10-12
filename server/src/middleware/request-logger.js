/**
 * request-logger.js — One line per request: method, path, status and time taken.
 * Query strings, headers and bodies are never logged, so passwords, tokens and personal data
 * cannot end up in the hosting provider's logs.
 */

function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.info(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
}

module.exports = { requestLogger };
