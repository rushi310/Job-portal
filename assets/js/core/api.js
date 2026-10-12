/**
 * api.js — The only module that talks to the FreshHire API (ARCHITECTURE.md §1).
 * Every request goes through `request()`: it adds the login token, sends and reads JSON, and
 * always resolves to the same result shape the services have always used —
 * `{ ok: true, data }` or `{ ok: false, code, error, fieldErrors? }` — so callers never need
 * try / catch for HTTP or network failures.
 *
 * An expired or ended session (HTTP 401 on a request that carried a token) clears the session and
 * sends the user to the login page. Tokens and request bodies are never logged.
 */

import { API_BASE_URL, IS_API_CONFIGURED } from './app-config.js';
import { STORAGE_KEYS, PAGE_PATHS } from './config.js';
import { getSession, removeSession, setFlash } from './storage.js';
import { toRoot } from './utils.js';

export const API_ERRORS = Object.freeze({
  NETWORK: 'NETWORK_ERROR',
  NOT_CONFIGURED: 'API_NOT_CONFIGURED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SERVER: 'SERVER_ERROR',
});

/** Fired on `window` when a request is slow (e.g. free hosting waking the server up). */
export const SLOW_REQUEST_EVENT = 'fh:slow-request';
const SLOW_REQUEST_MS = 4000;

const NETWORK_MESSAGE = 'Could not reach the FreshHire server. Check your connection and try again.';
const NOT_CONFIGURED_MESSAGE = 'The site is not connected to its server yet '
  + '(set PRODUCTION_API_BASE_URL in assets/js/core/app-config.js).';

function failure(code, error, extra = {}) {
  return { ok: false, code, error, ...extra };
}

function getToken() {
  const session = getSession(STORAGE_KEYS.SESSION);
  return typeof session?.token === 'string' ? session.token : null;
}

/** Empty values are left out; arrays are sent as "a,b,c". */
function buildUrl(path, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    const text = Array.isArray(value) ? value.join(',') : value;
    if (text !== '' && text !== null && text !== undefined && text !== false) params.set(key, String(text));
  });
  const queryString = params.toString();
  return `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ''}`;
}

/** Current page as a project-root-relative path with its query string, e.g. "pages/admin/users.html". */
function getCurrentProjectPath() {
  const { href, hash } = window.location;
  return href.slice(toRoot('').length, hash ? -hash.length : undefined);
}

/** The session is no longer valid: forget it and go to the login page (then back to this page). */
function redirectToLogin() {
  removeSession(STORAGE_KEYS.SESSION);
  setFlash('Your session has ended. Please log in again.', 'info');
  const returnTo = encodeURIComponent(getCurrentProjectPath());
  window.location.replace(toRoot(`${PAGE_PATHS.LOGIN}?returnTo=${returnTo}`));
}

async function readBody(response, responseType) {
  if (response.ok && responseType === 'blob') return { ok: true, data: await response.blob() };
  try {
    const body = await response.json();
    if (body && typeof body.ok === 'boolean') return body;
  } catch {
    // not JSON: fall through to the generic error
  }
  return failure(API_ERRORS.SERVER, 'The server sent an unexpected response. Please try again.');
}

/**
 * Send one API request.
 * @param {string} method GET, POST, PUT, PATCH or DELETE
 * @param {string} path path under the API base, e.g. "/jobs"
 * @param {object} [options]
 * @param {object} [options.query] query-string values
 * @param {object} [options.body] sent as JSON
 * @param {Blob} [options.file] sent as the raw request body (resume upload)
 * @param {Object<string, string>} [options.headers] extra headers
 * @param {'json'|'blob'} [options.responseType='json'] 'blob' for file downloads
 * @param {boolean} [options.redirectOnExpiry=true] false = return the 401 instead of going to login
 * @returns {Promise<{ ok: true, data: * } | { ok: false, code: string, error: string, fieldErrors?: object }>}
 */
export async function request(method, path, {
  query, body, file, headers = {}, responseType = 'json', redirectOnExpiry = true,
} = {}) {
  if (!IS_API_CONFIGURED) return failure(API_ERRORS.NOT_CONFIGURED, NOT_CONFIGURED_MESSAGE);

  const token = getToken();
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';

  const slowTimer = setTimeout(() => window.dispatchEvent(new CustomEvent(SLOW_REQUEST_EVENT)), SLOW_REQUEST_MS);
  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: requestHeaders,
      body: file ?? (body !== undefined ? JSON.stringify(body) : undefined),
      cache: 'no-store',
    });
  } catch {
    return failure(API_ERRORS.NETWORK, NETWORK_MESSAGE);
  } finally {
    clearTimeout(slowTimer);
  }

  const result = await readBody(response, responseType);
  if (response.status === 401 && token && result.code === API_ERRORS.UNAUTHENTICATED && redirectOnExpiry) {
    redirectToLogin();
    return new Promise(() => {}); // never settles: the page is being replaced, so nothing else should run
  }
  return result;
}

export const get = (path, query, options) => request('GET', path, { query, ...options });
export const post = (path, body, options) => request('POST', path, { body, ...options });
export const put = (path, body, options) => request('PUT', path, { body, ...options });
export const patch = (path, body, options) => request('PATCH', path, { body, ...options });
export const del = (path, options) => request('DELETE', path, options);

/** Download a file (PDF resume) that needs the login token. @returns {Promise<{ ok: true, data: Blob } | object>} */
export const download = (path) => request('GET', path, { responseType: 'blob' });
