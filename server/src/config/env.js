/**
 * env.js — The only place that reads process.env. Every other module imports `config`.
 * Secrets (database URI, token secret) come from the environment and are never logged.
 */

const path = require('path');
const crypto = require('crypto');

// "npm run start:prod" / "seed:prod" pass --production (works the same on Windows, macOS and Linux).
if (process.argv.includes('--production')) process.env.NODE_ENV = 'production';

/**
 * Settings files (both ignored by Git): server/.env for everyday local work, and
 * server/.env.production when running in production mode on this computer.
 * A hosting platform (Vercel) has neither file — it supplies the same variables from its dashboard,
 * and variables that are already set always win over a file.
 */
const ENV_FILE = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.join(__dirname, '../..', ENV_FILE) });

const MIN_SECRET_LENGTH = 32;
const LOCAL_ORIGINS = ['http://localhost:5500', 'http://127.0.0.1:5500'];

function toInteger(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}

/** "https://a.app, https://b.app/" → ['https://a.app', 'https://b.app'] */
function parseOrigins(value) {
  return String(value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Build and check the configuration. Throws a clear error (without secret values) when a
 * required production setting is missing, so a misconfigured deploy fails at start-up.
 */
function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';
  const problems = [];

  const corsOrigins = parseOrigins(env.FRONTEND_URL);
  if (corsOrigins.includes('*')) problems.push('FRONTEND_URL must list exact origins, not "*".');

  let jwtSecret = env.JWT_SECRET || '';
  if (isProduction) {
    if (!env.MONGODB_URI) problems.push('MONGODB_URI is required.');
    if (jwtSecret.length < MIN_SECRET_LENGTH) {
      problems.push(`JWT_SECRET is required and must be at least ${MIN_SECRET_LENGTH} characters.`);
    }
  } else if (!jwtSecret) {
    // Development convenience: a random secret per start, so no default secret lives in the code.
    jwtSecret = crypto.randomBytes(48).toString('hex');
    if (!isTest) console.warn('config: JWT_SECRET is not set; using a temporary one (logins end on restart).');
  }
  if (problems.length > 0) throw new Error(`Invalid configuration:\n- ${problems.join('\n- ')}`);

  return Object.freeze({
    nodeEnv,
    isProduction,
    isTest,
    port: toInteger(env.PORT, 5000),
    mongodbUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freshhire',
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '2h',
    // No FRONTEND_URL in production means the pages and the API share one origin (e.g. one Vercel
    // project): browsers need no CORS permission for that, so no other origin is allowed at all.
    corsOrigins: corsOrigins.length > 0 || isProduction ? corsOrigins : LOCAL_ORIGINS,
    bcryptRounds: toInteger(env.BCRYPT_ROUNDS, 10),
    authRateLimitMax: toInteger(env.AUTH_RATE_LIMIT_MAX, 20),
    apiRateLimitMax: toInteger(env.API_RATE_LIMIT_MAX, 300),
    timezoneOffsetMinutes: toInteger(env.APP_TIMEZONE_OFFSET_MINUTES, 330),
    serveFrontend: !isProduction && env.SERVE_FRONTEND === 'true',
    allowDemoReset: env.ALLOW_DEMO_RESET === 'true',
  });
}

module.exports = { config: loadConfig(), loadConfig };
