/**
 * notification-service.js — In-app notifications (PROJECT_SPEC.md §5.5).
 * Phase 3: read-only queries for the student dashboard summary.
 * Creating notifications, mark-as-read and the notification centre are added in Phase 10.
 */

import { STORAGE_KEYS } from '../core/config.js';
import { getLocal } from '../core/storage.js';
import { parseDate } from '../core/utils.js';

/**
 * Notifications addressed to one user, newest first.
 * @param {string} userId
 * @returns {Array<object>}
 */
export function getNotificationsForUser(userId) {
  if (!userId) return [];
  const notifications = getLocal(STORAGE_KEYS.NOTIFICATIONS, []);
  if (!Array.isArray(notifications)) return [];
  return notifications
    .filter((notification) => notification?.userId === userId)
    .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
}

/** Number of unread notifications in a list. */
export function countUnread(notifications) {
  return notifications.filter((notification) => !notification.read).length;
}
