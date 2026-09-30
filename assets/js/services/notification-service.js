/**
 * notification-service.js — In-app notifications (PROJECT_SPEC.md §4.5, §5.5).
 * Phase 3: read-only queries for the student dashboard summary.
 * Phase 10: the logged-in user's own list, unread count, mark as read / mark all as read, safe links,
 * and creating notifications. Notifications are created only inside the state-changing operations of
 * §4.5 (application, status change, job approved / rejected, recruiter approved, announcement), never
 * while a page renders, so refreshing a page cannot create duplicates.
 */

import { STORAGE_KEYS, NOTIFICATION_TYPES } from '../core/config.js';
import { getLocal, setLocal } from '../core/storage.js';
import { parseDate, generateId } from '../core/utils.js';
import { getCurrentUser } from '../core/auth.js';

/** Error codes returned in `{ ok: false, code, error }` results. */
export const NOTIFICATION_ERRORS = Object.freeze({
  NOT_ALLOWED: 'NOT_ALLOWED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID: 'INVALID',
  STORAGE_ERROR: 'STORAGE_ERROR',
});

/** Human-readable type names shown on each notification (text, never colour only). */
export const NOTIFICATION_TYPE_LABELS = Object.freeze({
  [NOTIFICATION_TYPES.APPLICATION]: 'New applicant',
  [NOTIFICATION_TYPES.STATUS]: 'Application update',
  [NOTIFICATION_TYPES.JOB]: 'Job update',
  [NOTIFICATION_TYPES.ACCOUNT]: 'Account',
  [NOTIFICATION_TYPES.ANNOUNCEMENT]: 'Announcement',
});

function failure(code, error) {
  return { ok: false, code, error };
}

/** Every stored notification with the minimum fields needed to show it safely. */
function getAllNotifications() {
  const notifications = getLocal(STORAGE_KEYS.NOTIFICATIONS, []);
  if (!Array.isArray(notifications)) return [];
  return notifications.filter((item) => item && typeof item.id === 'string' && typeof item.userId === 'string');
}

const byNewest = (a, b) => parseDate(b.createdAt) - parseDate(a.createdAt);

/**
 * Notifications addressed to one user, newest first.
 * @param {string} userId
 * @returns {Array<object>}
 */
export function getNotificationsForUser(userId) {
  if (!userId) return [];
  return getAllNotifications().filter((notification) => notification.userId === userId).sort(byNewest);
}

/** Number of unread notifications in a list. */
export function countUnread(notifications) {
  return notifications.filter((notification) => !notification.read).length;
}

/* ==========================================================================
   The logged-in user's own notifications (Phase 10) — identity always from the session
   ========================================================================== */

/** @returns {Array<object>} the logged-in user's notifications, newest first ([] when logged out) */
export function getOwnNotifications() {
  const user = getCurrentUser();
  return user ? getNotificationsForUser(user.id) : [];
}

/** @returns {number} unread notifications of the logged-in user */
export function getUnreadCount() {
  return countUnread(getOwnNotifications());
}

function saveReadState(shouldMark) {
  const user = getCurrentUser();
  if (!user) return failure(NOTIFICATION_ERRORS.NOT_ALLOWED, 'Please log in to manage notifications.');
  const stored = getLocal(STORAGE_KEYS.NOTIFICATIONS, []);
  if (!Array.isArray(stored)) return failure(NOTIFICATION_ERRORS.NOT_FOUND, 'Notification not found.');
  let changed = 0;
  let found = 0;
  const next = stored.map((item) => {
    if (!item || item.userId !== user.id || !shouldMark(item)) return item;
    found += 1;
    if (item.read) return item;
    changed += 1;
    return { ...item, read: true };
  });
  if (changed === 0) return { ok: true, data: { changed, found } };
  const saved = setLocal(STORAGE_KEYS.NOTIFICATIONS, next);
  return saved.ok ? { ok: true, data: { changed, found } } : failure(NOTIFICATION_ERRORS.STORAGE_ERROR, saved.error);
}

/**
 * Mark one of the logged-in user's notifications as read. Another user's notification id is
 * treated exactly like an unknown id.
 * @returns {{ ok: true, data: { changed: number } } | { ok: false, code: string, error: string }}
 */
export function markAsRead(notificationId) {
  if (typeof notificationId !== 'string' || !notificationId) {
    return failure(NOTIFICATION_ERRORS.NOT_FOUND, 'Notification not found.');
  }
  const result = saveReadState((item) => item.id === notificationId);
  if (result.ok && result.data.found === 0) return failure(NOTIFICATION_ERRORS.NOT_FOUND, 'Notification not found.');
  return result;
}

/** Mark every notification of the logged-in user as read. */
export function markAllAsRead() {
  return saveReadState(() => true);
}

/**
 * The page a notification opens, if it is safe: a project page in the user's own role folder or
 * the shared folder (same rule as login's returnTo). Anything else is shown without a link.
 * The destination page still runs its own guards and ownership checks.
 * @param {object} notification
 * @param {string} role the logged-in user's role
 * @returns {string|null} project-root-relative path
 */
export function getSafeLink(notification, role) {
  const match = /^pages\/(student|recruiter|admin|shared)\/[a-z-]+\.html(\?[\w=&%.-]*)?$/.exec(notification?.link ?? '');
  return match && (match[1] === role || match[1] === 'shared') ? notification.link : null;
}

/* ==========================================================================
   Creating notifications (called by application-service and admin-service)
   ========================================================================== */

function buildNotification({ userId, type, title, message, link = '' }, createdAt) {
  return {
    id: generateId('ntf'),
    userId,
    type,
    title: String(title).trim(),
    message: String(message ?? '').trim(),
    link: String(link ?? ''),
    read: false,
    createdAt,
  };
}

const isValidInput = (input) => Boolean(input) && typeof input.userId === 'string' && input.userId !== ''
  && Object.values(NOTIFICATION_TYPES).includes(input.type) && String(input.title ?? '').trim() !== '';

/**
 * Store notifications for one event (one per recipient) with one shared timestamp.
 * Invalid entries are skipped. A failed write never undoes the action that triggered it.
 * @param {Array<{ userId: string, type: string, title: string, message: string, link?: string }>} inputs
 * @returns {{ ok: true, data: Array<object> } | { ok: false, code: string, error: string }}
 */
export function createNotifications(inputs) {
  const createdAt = new Date().toISOString();
  const created = (Array.isArray(inputs) ? inputs : []).filter(isValidInput)
    .map((input) => buildNotification(input, createdAt));
  if (created.length === 0) return failure(NOTIFICATION_ERRORS.INVALID, 'Nothing to send.');
  const stored = getLocal(STORAGE_KEYS.NOTIFICATIONS, []);
  const saved = setLocal(STORAGE_KEYS.NOTIFICATIONS, [...(Array.isArray(stored) ? stored : []), ...created]);
  return saved.ok ? { ok: true, data: created } : failure(NOTIFICATION_ERRORS.STORAGE_ERROR, saved.error);
}

/** One notification (see createNotifications). */
export function createNotification(input) {
  return createNotifications([input]);
}

/** Every announcement notification (for the admin's "sent announcements" list). */
export function getAnnouncementNotifications() {
  return getAllNotifications().filter((item) => item.type === NOTIFICATION_TYPES.ANNOUNCEMENT).sort(byNewest);
}
