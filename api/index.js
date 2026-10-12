/**
 * api/index.js — The whole FreshHire API as one Vercel Function.
 * vercel.json sends every /api/* request here; the Express app in server/src (unchanged, the same
 * one `npm run dev` starts locally) does the routing. This file only adds what a serverless
 * platform needs: no `listen()`, and a database connection that is opened on the first request
 * and reused by later requests handled by the same instance.
 */

let app = null;
let startUpError = null;
let databaseReady = null;

try {
  // Loading the configuration throws when a required environment variable is missing.
  const { createApp } = require('../server/src/app');
  app = createApp();
} catch (error) {
  startUpError = error;
  console.error(`FreshHire API could not start: ${error.message}`); // names the setting, never its value
}

/** Connect once per instance; a failed attempt is forgotten so the next request tries again. */
function connectOnce() {
  if (!databaseReady) {
    const { config } = require('../server/src/config/env');
    const { connectDatabase } = require('../server/src/config/database');
    databaseReady = connectDatabase(config.mongodbUri).catch((error) => {
      databaseReady = null;
      console.error(error.message);
    });
  }
  return databaseReady;
}

module.exports = async function handler(req, res) {
  if (startUpError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, code: 'SERVER_ERROR', error: 'The server is not configured correctly.' }));
    return;
  }
  // If the database cannot be reached the app still answers: /api/health and every route say 503.
  await connectOnce();
  app(req, res);
};
