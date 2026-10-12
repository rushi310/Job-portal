/**
 * rate-limiters.js — Request limits per IP address.
 * A strict limit protects login and registration from password guessing; a loose one protects
 * the rest of the API from accidental floods. Counters are kept in memory, which suits a single
 * free-tier instance (they reset when it restarts).
 */

const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const API_WINDOW_MS = 60 * 1000;

function createLimiter({ windowMs, max, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ ok: false, code: 'RATE_LIMITED', error: message });
    },
  });
}

/**
 * Login and registration attempts (AUTH_RATE_LIMIT_MAX per 15 minutes, per IP address).
 * For login only failed attempts are counted (`failedOnly`): that stops password guessing without
 * locking out a classroom that shares one network address. Registrations always count.
 */
const createAuthLimiter = (max = config.authRateLimitMax, { failedOnly = false } = {}) => createLimiter({
  windowMs: AUTH_WINDOW_MS,
  max,
  skipSuccessfulRequests: failedOnly,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

/** Every API request (API_RATE_LIMIT_MAX per minute). */
const createApiLimiter = (max = config.apiRateLimitMax) => createLimiter({
  windowMs: API_WINDOW_MS,
  max,
  message: 'Too many requests. Please slow down and try again.',
});

module.exports = { createAuthLimiter, createApiLimiter };
