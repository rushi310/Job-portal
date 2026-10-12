/**
 * app.js — Builds the Express application (no network or database side effects, so tests can
 * create it freely). Order matters: security headers → CORS → rate limit → body parsing →
 * routes → not-found → error handler.
 */

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { config } = require('./config/env');
const { createApiRouter } = require('./routes');
const { createApiLimiter } = require('./middleware/rate-limiters');
const { requestLogger } = require('./middleware/request-logger');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');

const JSON_BODY_LIMIT = '100kb';
const FRONTEND_ROOT = path.join(__dirname, '../..');

/**
 * Only the configured frontend origins may call the API from a browser. Requests without an
 * Origin header (health checks, server-to-server tools) are not cross-origin and pass through.
 * Login uses a token in the Authorization header, not cookies, so `credentials` stays off.
 */
function createCorsOptions() {
  return {
    origin: (origin, callback) => callback(null, !origin || config.corsOrigins.includes(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-File-Name'],
    maxAge: 600,
  };
}

/** Local development only (SERVE_FRONTEND=true): serve the static site from the same origin. */
function serveFrontend(app) {
  app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(FRONTEND_ROOT, 'index.html')));
  app.use('/assets', express.static(path.join(FRONTEND_ROOT, 'assets')));
  app.use('/pages', express.static(path.join(FRONTEND_ROOT, 'pages')));
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple'); // query values are plain strings, never nested objects
  if (config.isProduction) app.set('trust proxy', 1); // Render's proxy: the real client IP for rate limits

  app.use(helmet());
  app.use(cors(createCorsOptions()));
  if (!config.isTest) app.use(requestLogger);

  app.use('/api', createApiLimiter());
  app.use('/api', express.json({ limit: JSON_BODY_LIMIT }));
  app.use('/api', createApiRouter());
  app.use('/api', notFoundHandler);

  if (config.serveFrontend) serveFrontend(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
