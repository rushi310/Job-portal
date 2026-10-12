/**
 * notification-service.js — In-app notifications (PROJECT_SPEC.md §4.5, §5.5).
 * Notifications are created only by the state-changing operations of §4.5 (apply, status change,
 * job decision, recruiter approval, announcement) — never by a read — so reloading a page cannot
 * create duplicates. Reads and "mark as read" are always limited to the logged-in user's own.
 */

const Notification = require('../models/notification');
const { NOTIFICATION_TYPES } = require('../config/constants');
const { notFound } = require('../utils/app-error');
const { toNotification } = require('../utils/serializers');
const { describePage, toPageInfo } = require('../utils/pagination');

/**
 * Store notifications for one event (one per recipient) with one shared timestamp.
 * A failure here is logged and swallowed: it must never undo the action that triggered it.
 * @param {Array<{ user: *, type: string, title: string, message?: string, link?: string }>} inputs
 * @returns {Promise<number>} how many were created
 */
async function createNotifications(inputs) {
  const createdAt = new Date();
  const documents = inputs
    .filter((input) => input?.user && Object.values(NOTIFICATION_TYPES).includes(input.type) && String(input.title ?? '').trim())
    .map((input) => ({
      user: input.user,
      type: input.type,
      title: String(input.title).trim(),
      message: String(input.message ?? '').trim(),
      link: String(input.link ?? ''),
      createdAt,
    }));
  if (documents.length === 0) return 0;
  try {
    await Notification.insertMany(documents);
    return documents.length;
  } catch (error) {
    console.error(`notifications: could not create ${documents.length} notification(s): ${error.name}`);
    return 0;
  }
}

const createNotification = (input) => createNotifications([input]);

/** The user's notifications, newest first, with the unread total. */
async function listForUser(userId, paging) {
  const [total, unread] = await Promise.all([
    Notification.countDocuments({ user: userId }),
    Notification.countDocuments({ user: userId, read: false }),
  ]);
  const page = describePage(total, paging);
  const items = await Notification.find({ user: userId })
    .sort({ createdAt: -1, _id: -1 })
    .skip(page.skip)
    .limit(page.limit);
  return { items: items.map(toNotification), unread, ...toPageInfo(page, items.length) };
}

const countUnread = (userId) => Notification.countDocuments({ user: userId, read: false });

/**
 * Mark one of the user's own notifications as read. Another user's notification id is treated
 * exactly like an unknown id.
 */
async function markAsRead(userId, notificationId) {
  const notification = await Notification.findOne({ _id: notificationId, user: userId });
  if (!notification) throw notFound('Notification not found.');
  const changed = notification.read ? 0 : 1;
  if (changed) {
    notification.read = true;
    await notification.save();
  }
  return { changed, unread: await countUnread(userId) };
}

async function markAllAsRead(userId) {
  const result = await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
  return { changed: result.modifiedCount, unread: 0 };
}

module.exports = {
  createNotifications, createNotification, listForUser, countUnread, markAsRead, markAllAsRead,
};
