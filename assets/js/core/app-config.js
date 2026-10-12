/**
 * app-config.js — Where the frontend finds the API.
 * Deployed (Vercel): the pages and the API share one domain, so requests go to the relative
 * address "/api" and nothing needs editing. On this computer the API runs on port 5000.
 * This file holds public addresses only — never put a database connection string, token secret
 * or password in any frontend file.
 */

/**
 * Only for split hosting, where the API is on a different domain than the pages (for example
 * pages on Netlify, API on Render): its full address ending in "/api", e.g.
 * "https://your-service-name.onrender.com/api". Leave empty for Vercel.
 */
const REMOTE_API_BASE_URL = '';

/** Port of the API during local development (server/.env → PORT). */
const LOCAL_API_PORT = '5000';
const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];

/** True when the site is opened from this computer (Live Server or the API's own static server). */
export const IS_LOCAL = LOCAL_HOSTNAMES.includes(window.location.hostname);

function resolveApiBaseUrl() {
  const { protocol, hostname, port } = window.location;
  // Pages opened from Live Server (another port): call the local API on its own port.
  if (IS_LOCAL && port !== LOCAL_API_PORT) return `${protocol}//${hostname}:${LOCAL_API_PORT}/api`;
  // Same origin: the deployed site, or the local API serving the pages itself (SERVE_FRONTEND=true).
  return REMOTE_API_BASE_URL || '/api';
}

/** Base address of every API request. */
export const API_BASE_URL = resolveApiBaseUrl();
