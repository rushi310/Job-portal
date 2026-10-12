/**
 * notification-service.js — In-app notifications (PROJECT_SPEC.md §4.5, §5.5).
 * The server creates notifications when something happens (application, status change, job
 * decision, recruiter approval, announcement) and only ever returns the logged-in user's own.
 */

import { NOTIFICATION_TYPES } from '../core/config.js';
import * as api from '../core/api.js';

/** Human-readable type names shown on each notification (text, never colour only). */
export const NOTIFICATION_TYPE_LABELS = Object.freeze({
  [NOTIFICATION_TYPES.APPLICATION]: 'New applicant',
  [NOTIFICATION_TYPES.STATUS]: 'Application update',
  [NOTIFICATION_TYPES.JOB]: 'Job update',
  [NOTIFICATION_TYPES.ACCOUNT]: 'Account',
  [NOTIFICATION_TYPES.ANNOUNCEMENT]: 'Announcement',
});

/** The most notifications one request returns (newest first). */
export const NOTIFICATIONS_PAGE_SIZE = 100;

/**
 * The logged-in user's notifications, newest first, with the unread total.
 * @returns {Promise<{ ok: true, data: { items: Array<object>, unread: number, total: number } } | object>}
 */
export function getOwnNotifications() {
  return api.get('/notifications', { limit: NOTIFICATIONS_PAGE_SIZE });
}

/**
 * Mark one of the logged-in user's notifications as read. Another user's notification id is
 * treated exactly like an unknown id.
 * @returns {Promise<{ ok: true, data: { changed: number, unread: number } } | object>}
 */
export function markAsRead(notificationId) {
  return api.post(`/notifications/${encodeURIComponent(notificationId)}/read`);
}

/** Mark every notification of the logged-in user as read. */
export function markAllAsRead() {
  return api.post('/notifications/read-all');
}

/**
 * The page a notification opens, if it is safe: a project page in the user's own role folder or
 * the shared folder (same rule as login's returnTo). Anything else is shown without a link.
 * The destination page and the API still check access to whatever it shows.
 * @param {object} notification
 * @param {string} role the logged-in user's role
 * @returns {string|null} project-root-relative path
 */
export function getSafeLink(notification, role) {
  const match = /^pages\/(student|recruiter|admin|shared)\/[a-z-]+\.html(\?[\w=&%.-]*)?$/.exec(notification?.link ?? '');
  return match && (match[1] === role || match[1] === 'shared') ? notification.link : null;
}
