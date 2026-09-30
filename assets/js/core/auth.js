/**
 * auth.js — Simulated, frontend-only authentication (ARCHITECTURE.md §5).
 * Credentials are checked against the demo users in localStorage and the session lives in
 * sessionStorage (fh_session), so closing the tab logs the user out (BR-04).
 * There is no server, token, cookie, or password hashing — this is a demonstration only.
 *
 * P2-T01: login, logout, session and role helpers. P2-T03: register().
 * P2-T05: page guards (requireRole, redirectIfLoggedIn) and role-based post-login paths.
 */

import {
  STORAGE_KEYS, PAGE_PATHS, ROLE_HOME_PATHS, PUBLIC_REGISTRATION_ROLES,
} from './config.js';
import {
  getSession as readSessionStorage,
  setSession as writeSessionStorage,
  removeSession as removeSessionStorage,
  setFlash,
} from './storage.js';
import { toRoot } from './utils.js';
import {
  findUserByEmail,
  findUserById,
  isPasswordMatch,
  isValidRole,
  checkLoginEligibility,
  isPendingRecruiter,
  toPublicUser,
  validateRegistration,
  createUser,
} from '../services/user-service.js';

/** Error codes returned in `{ ok: false, code, error }` results (account codes come from user-service). */
export const AUTH_ERRORS = Object.freeze({
  MISSING_FIELDS: 'MISSING_FIELDS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_ERROR: 'SESSION_ERROR',
  ROLE_NOT_ALLOWED: 'ROLE_NOT_ALLOWED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
});

/** One message for unknown email AND wrong password, so the form never reveals which emails exist. */
const INVALID_CREDENTIALS_MESSAGE = 'Incorrect email or password.';

function failure(code, error) {
  return { ok: false, code, error };
}

/** Minimum data the frontend needs (PROJECT_SPEC.md §5.6). */
function buildSession(user) {
  return {
    userId: user.id,
    role: user.role,
    name: user.name,
    loginAt: new Date().toISOString(),
  };
}

function isWellFormedSession(session) {
  return Boolean(session)
    && typeof session.userId === 'string'
    && typeof session.name === 'string'
    && isValidRole(session.role);
}

/**
 * Log in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {{ ok: true, data: { user: object, session: object, isPendingApproval: boolean } }
 *   | { ok: false, code: string, error: string }}
 */
export function login(email, password) {
  if (!String(email ?? '').trim() || !password) {
    return failure(AUTH_ERRORS.MISSING_FIELDS, 'Please enter your email and password.');
  }

  const user = findUserByEmail(email);
  if (!user || !isPasswordMatch(user, password)) {
    return failure(AUTH_ERRORS.INVALID_CREDENTIALS, INVALID_CREDENTIALS_MESSAGE);
  }

  const eligibility = checkLoginEligibility(user);
  if (!eligibility.ok) return eligibility;

  const session = buildSession(user);
  const saved = writeSessionStorage(STORAGE_KEYS.SESSION, session);
  if (!saved.ok) return failure(AUTH_ERRORS.SESSION_ERROR, saved.error);

  return {
    ok: true,
    data: { user: toPublicUser(user), session, isPendingApproval: eligibility.isPendingApproval },
  };
}

/**
 * Register a new student or recruiter (PROJECT_SPEC.md §2, BR-01, BR-02, BR-06).
 * Does not log the user in; they log in afterwards from the login page.
 * @param {object} values form values including `role`
 * @returns {{ ok: true, data: { user: object, isPendingApproval: boolean } }
 *   | { ok: false, code: string, error: string, fieldErrors?: Object<string, string> }}
 */
export function register(values = {}) {
  if (!PUBLIC_REGISTRATION_ROLES.includes(values.role)) {
    return failure(AUTH_ERRORS.ROLE_NOT_ALLOWED, 'Please choose to register as a Student or a Recruiter.');
  }

  const fieldErrors = validateRegistration(values);
  if (Object.keys(fieldErrors).length > 0) {
    return { ...failure(AUTH_ERRORS.VALIDATION_FAILED, 'Please correct the highlighted fields.'), fieldErrors };
  }

  const created = createUser(values);
  if (!created.ok) return failure(AUTH_ERRORS.STORAGE_ERROR, created.error);

  return {
    ok: true,
    data: { user: toPublicUser(created.data), isPendingApproval: isPendingRecruiter(created.data) },
  };
}

/**
 * End the current session. Safe to call when nobody is logged in.
 * @returns {{ ok: true }}
 */
export function logout() {
  removeSessionStorage(STORAGE_KEYS.SESSION);
  return { ok: true };
}

/**
 * The stored session, or null. Malformed sessions are discarded.
 * Does not check the user record — use getCurrentUser() for that.
 * @returns {object|null}
 */
export function getSession() {
  const session = readSessionStorage(STORAGE_KEYS.SESSION);
  if (session === null) return null;
  if (!isWellFormedSession(session)) {
    logout();
    return null;
  }
  return session;
}

/**
 * The logged-in user (without password), or null.
 * Ends the session if the user was deleted, blocked, or had their role changed since logging in.
 * @returns {object|null}
 */
export function getCurrentUser() {
  const session = getSession();
  if (!session) return null;

  const user = findUserById(session.userId);
  const isStillValid = user && user.role === session.role && checkLoginEligibility(user).ok;
  if (!isStillValid) {
    logout();
    return null;
  }
  return toPublicUser(user);
}

/** @returns {boolean} true if a valid user is logged in */
export function isLoggedIn() {
  return getCurrentUser() !== null;
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
 * Page guard — call first in every protected page script (after ensureSeeded).
 * - Not logged in → login page (with ?returnTo=<this page>).
 * - Logged in with another role → that user's own dashboard, with a warning toast.
 * @param {...string} roles roles allowed on this page
 * @returns {object|null} the current user, or null when a redirect has started
 */
export function requireRole(...roles) {
  const user = getCurrentUser();
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
 * @returns {boolean} true when a redirect has started
 */
export function redirectIfLoggedIn() {
  const user = getCurrentUser();
  if (!user) return false;
  redirectTo(ROLE_HOME_PATHS[user.role]);
  return true;
}

/**
 * Does the logged-in user have one of the given roles?
 * @param {...string} roles e.g. hasRole(ROLES.STUDENT) or hasRole(ROLES.RECRUITER, ROLES.ADMIN)
 * @returns {boolean}
 */
export function hasRole(...roles) {
  const user = getCurrentUser();
  return user !== null && roles.includes(user.role);
}
