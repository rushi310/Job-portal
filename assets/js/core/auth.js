/**
 * auth.js — Login, registration, the current session and page guards (ARCHITECTURE.md §5).
 * Credentials are checked by the API, which answers with a short-lived signed token. The token is
 * kept in sessionStorage (fh_session), so closing the tab logs the user out (BR-04).
 *
 * The page guards here only decide what the browser shows. They are not a security boundary:
 * every API route checks the token, the role and the ownership of the data again on the server.
 */

import {
  STORAGE_KEYS, PAGE_PATHS, ROLES, ROLE_HOME_PATHS,
} from './config.js';
import {
  getSession as readSessionStorage,
  setSession as writeSessionStorage,
  removeSession as removeSessionStorage,
  setFlash,
} from './storage.js';
import { toRoot } from './utils.js';
import * as api from './api.js';

/** Error codes returned in `{ ok: false, code, error }` results. */
export const AUTH_ERRORS = Object.freeze({
  MISSING_FIELDS: 'MISSING_FIELDS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_ERROR: 'SESSION_ERROR',
  ROLE_NOT_ALLOWED: 'ROLE_NOT_ALLOWED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
});

/** The logged-in user is asked for once per page load and then remembered. */
let currentUserRequest = null;
let unreadCount = 0;

const isValidRole = (role) => Object.values(ROLES).includes(role);

function isWellFormedSession(session) {
  return Boolean(session)
    && typeof session.token === 'string' && session.token !== ''
    && typeof session.userId === 'string'
    && isValidRole(session.role);
}

function clearSession() {
  removeSessionStorage(STORAGE_KEYS.SESSION);
  currentUserRequest = null;
  unreadCount = 0;
}

/**
 * Log in with email and password.
 * @returns {Promise<{ ok: true, data: { user: object, isPendingApproval: boolean } }
 *   | { ok: false, code: string, error: string }>}
 */
export async function login(email, password) {
  if (!String(email ?? '').trim() || !password) {
    return { ok: false, code: AUTH_ERRORS.MISSING_FIELDS, error: 'Please enter your email and password.' };
  }
  clearSession(); // never send an older token with a login attempt
  const result = await api.post('/auth/login', { email, password });
  if (!result.ok) return result;

  const { token, user, isPendingApproval } = result.data;
  const saved = writeSessionStorage(STORAGE_KEYS.SESSION, {
    token, userId: user.id, role: user.role, name: user.name, loginAt: new Date().toISOString(),
  });
  if (!saved.ok) return { ok: false, code: AUTH_ERRORS.SESSION_ERROR, error: saved.error };
  return { ok: true, data: { user, isPendingApproval } };
}

/**
 * Register a new student or recruiter (PROJECT_SPEC.md §2, BR-01, BR-02, BR-06).
 * Does not log the user in; they log in afterwards from the login page.
 * @param {object} values form values including `role`
 * @returns {Promise<{ ok: true, data: { user: object, isPendingApproval: boolean } }
 *   | { ok: false, code: string, error: string, fieldErrors?: Object<string, string> }>}
 */
export function register(values = {}) {
  return api.post('/auth/register', values);
}

/**
 * End the session: the server stops accepting the token, and it is removed from this tab.
 * Safe to call when nobody is logged in.
 * @returns {Promise<{ ok: true }>}
 */
export async function logout() {
  if (getSession()) await api.post('/auth/logout', undefined, { redirectOnExpiry: false });
  clearSession();
  return { ok: true };
}

/**
 * The stored session, or null. Malformed sessions are discarded.
 * Says nothing about whether the server still accepts it — use getCurrentUser() for that.
 * @returns {object|null}
 */
export function getSession() {
  const session = readSessionStorage(STORAGE_KEYS.SESSION);
  if (session === null) return null;
  if (!isWellFormedSession(session)) {
    clearSession();
    return null;
  }
  return session;
}

async function fetchCurrentUser() {
  const result = await api.get('/auth/me', undefined, { redirectOnExpiry: false });
  if (result.ok) {
    unreadCount = result.data.unreadCount;
    return result.data.user;
  }
  if (result.code === api.API_ERRORS.UNAUTHENTICATED) {
    clearSession(); // expired, logged out elsewhere, blocked or deleted
    return null;
  }
  throw new Error(result.error); // server unreachable: not the same as "logged out"
}

/**
 * The logged-in user as the server knows them now, or null when nobody is logged in.
 * @returns {Promise<object|null>}
 * @throws {Error} with a user-friendly message when the server cannot be reached
 */
export function getCurrentUser() {
  if (!getSession()) return Promise.resolve(null);
  if (!currentUserRequest) {
    currentUserRequest = fetchCurrentUser().catch((error) => {
      currentUserRequest = null; // let the next call try again
      throw error;
    });
  }
  return currentUserRequest;
}

/** Unread notifications of the logged-in user, as loaded with getCurrentUser(). */
export function getUnreadCount() {
  return unreadCount;
}

/**
 * A `returnTo` value is only trusted if it is a project page (never an external URL) inside the
 * user's own role folder or the shared folder, e.g. "pages/student/jobs.html?x=1".
 */
const RETURN_PATH_PATTERN = /^pages\/(student|recruiter|admin|shared)\/[a-z-]+\.html(\?[\w=&%.-]*)?$/;

function isAllowedReturnPath(path, role) {
  const match = RETURN_PATH_PATTERN.exec(path ?? '');
  return Boolean(match) && (match[1] === 'shared' || match[1] === role);
}

/**
 * Where to send a user after logging in (project-root-relative path): the safe `returnTo`
 * page if one was given, otherwise the role's dashboard (ARCHITECTURE.md §5).
 * @param {string} role
 * @param {string|null} [returnTo]
 * @returns {string}
 */
export function getPostLoginPath(role, returnTo = null) {
  return isAllowedReturnPath(returnTo, role) ? returnTo : (ROLE_HOME_PATHS[role] ?? PAGE_PATHS.HOME);
}

/** Current page as a project-root-relative path with its query string, e.g. "pages/admin/users.html". */
function getCurrentProjectPath() {
  const { href, hash } = window.location;
  return href.slice(toRoot('').length, hash ? -hash.length : undefined);
}

/** `replace` keeps guarded pages out of the back-button history, so Back cannot loop. */
function redirectTo(path) {
  window.location.replace(toRoot(path));
}

/**
 * Page guard — call first in every protected page script.
 * - Not logged in → login page (with ?returnTo=<this page>).
 * - Logged in with another role → that user's own dashboard, with a warning toast.
 * @param {...string} roles roles allowed on this page
 * @returns {Promise<object|null>} the current user, or null when a redirect has started
 * @throws {Error} when the server cannot be reached
 */
export async function requireRole(...roles) {
  const user = await getCurrentUser();
  if (!user) {
    setFlash('Please log in to continue.', 'info');
    const returnTo = encodeURIComponent(getCurrentProjectPath());
    redirectTo(`${PAGE_PATHS.LOGIN}?returnTo=${returnTo}`);
    return null;
  }
  if (!roles.includes(user.role)) {
    setFlash('You do not have access to that page, so you were taken to your dashboard.', 'warning');
    redirectTo(ROLE_HOME_PATHS[user.role]);
    return null;
  }
  return user;
}

/**
 * For public pages (landing, login, register): send an already logged-in user to their dashboard.
 * A server that cannot be reached counts as "not logged in" here, so public pages still open.
 * @returns {Promise<boolean>} true when a redirect has started
 */
export async function redirectIfLoggedIn() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    return false;
  }
  if (!user) return false;
  redirectTo(ROLE_HOME_PATHS[user.role]);
  return true;
}
