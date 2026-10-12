/**
 * app-config.js — Deployment settings for the static frontend.
 * This is the only frontend file to edit when deploying: set PRODUCTION_API_BASE_URL to the
 * address of the deployed API (see DEPLOYMENT.md). It holds public addresses only — never put a
 * database connection string, token secret or password in any frontend file.
 */

/**
 * The deployed API, ending in "/api", e.g. "https://your-service-name.onrender.com/api".
 * The placeholder below cannot be reached on purpose, so an unconfigured site fails clearly
 * instead of sending logins to somebody else's server.
 */
export const PRODUCTION_API_BASE_URL = 'https://replace-with-your-api.invalid/api';

/** Port of the API during local development (server/.env → PORT). */
const LOCAL_API_PORT = '5000';
const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];

/** True when the site is opened from this computer (Live Server or the API's own static server). */
export const IS_LOCAL = LOCAL_HOSTNAMES.includes(window.location.hostname);

function resolveApiBaseUrl() {
  if (!IS_LOCAL) return PRODUCTION_API_BASE_URL;
  const { protocol, hostname, port } = window.location;
  // Served by the API itself (SERVE_FRONTEND=true): same origin. Otherwise the API's own port.
  return port === LOCAL_API_PORT ? '/api' : `${protocol}//${hostname}:${LOCAL_API_PORT}/api`;
}

/** Base address of every API request. */
export const API_BASE_URL = resolveApiBaseUrl();

/** False until PRODUCTION_API_BASE_URL has been replaced with a real address. */
export const IS_API_CONFIGURED = !API_BASE_URL.includes('.invalid');
