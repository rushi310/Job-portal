/**
 * env.js — The only place that reads process.env. Every other module imports `config`.
 * Secrets (database URI, token secret) come from the environment and are never logged.
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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
    if (corsOrigins.length === 0) problems.push('FRONTEND_URL is required (the deployed frontend origin).');
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
    corsOrigins: corsOrigins.length > 0 ? corsOrigins : LOCAL_ORIGINS,
    bcryptRounds: toInteger(env.BCRYPT_ROUNDS, 10),
    authRateLimitMax: toInteger(env.AUTH_RATE_LIMIT_MAX, 20),
    apiRateLimitMax: toInteger(env.API_RATE_LIMIT_MAX, 300),
    timezoneOffsetMinutes: toInteger(env.APP_TIMEZONE_OFFSET_MINUTES, 330),
    serveFrontend: !isProduction && env.SERVE_FRONTEND === 'true',
    allowDemoReset: env.ALLOW_DEMO_RESET === 'true',
  });
}

module.exports = { config: loadConfig(), loadConfig };
