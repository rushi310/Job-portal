/**
 * notifications.js — Notification centre for every role (Phase 10, UI_SPEC §5 "Notifications").
 * Shows only the logged-in user's notifications (from the session), grouped by date, newest first.
 * Unread items are marked in text ("Unread") as well as style. Opening a notification marks it read
 * and follows its link — only when the link is a page of the user's own role (or shared); the page
 * itself still runs its guards and ownership checks. "Mark as read" / "Mark all as read" update
 * the list and the navbar bell without reloading.
 */

import { ROLES } from '../../core/config.js';
import {
  toRoot, parseDate, formatDate, formatRelativeTime, pluralize,
} from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { createEmptyState } from '../../components/empty-state.js';
import { showToast } from '../../components/toast.js';
import { setNotificationBadge } from '../../components/navbar.js';
import {
  getOwnNotifications, countUnread, markAsRead, markAllAsRead, getSafeLink, NOTIFICATION_TYPE_LABELS,
} from '../../services/notification-service.js';

const $ = (selector) => document.querySelector(selector);
let user = null;

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** "Today", "Yesterday", "29 Sep 2026", or "Earlier" when the date is unreadable. */
function getGroupLabel(createdAt) {
  const date = parseDate(createdAt);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatDate(createdAt);
}

function createItem(notification) {
  const title = String(notification.title ?? '').trim() || 'Notification';
  const itemEl = createElement('li', `notification-item${notification.read ? '' : ' is-unread'}`);
  itemEl.dataset.notificationId = notification.id;
  itemEl.tabIndex = -1; // receives focus after "Mark as read"

  const metaEl = createElement('p', 'notification-item__meta');
  metaEl.append(createElement('span', 'chip', NOTIFICATION_TYPE_LABELS[notification.type] ?? 'Update'));
  if (!notification.read) metaEl.append(createElement('span', 'badge badge--primary', 'Unread'));

  const titleEl = createElement('h3', 'notification-item__title');
  const link = getSafeLink(notification, user.role);
  if (link) {
    const linkEl = createElement('a', '', title);
    linkEl.href = toRoot(link);
    linkEl.dataset.openNotification = notification.id;
    titleEl.append(linkEl);
  } else {
    titleEl.textContent = title;
  }

  const timeEl = createElement('time', 'notification-item__time');
  const date = parseDate(notification.createdAt);
  if (Number.isNaN(date.getTime())) {
    timeEl.textContent = 'Unknown date';
  } else {
    timeEl.dateTime = date.toISOString();
    timeEl.textContent = formatRelativeTime(notification.createdAt);
    timeEl.title = formatDate(notification.createdAt);
  }

  itemEl.append(metaEl, titleEl);
  if (notification.message) itemEl.append(createElement('p', 'notification-item__message', String(notification.message)));
  const footerEl = createElement('div', 'notification-item__footer');
  footerEl.append(timeEl);
  if (!notification.read) {
    const buttonEl = createElement('button', 'btn btn--ghost btn--sm', 'Mark as read');
    buttonEl.type = 'button';
    buttonEl.dataset.markRead = notification.id;
    buttonEl.setAttribute('aria-label', `Mark as read: ${title}`); // starts with the visible text (WCAG 2.5.3)
    footerEl.append(buttonEl);
  }
  itemEl.append(footerEl);
  return itemEl;
}

function render() {
  const notifications = getOwnNotifications();
  const unread = countUnread(notifications);
  setNotificationBadge(unread);
  $('[data-mark-all]').disabled = unread === 0;

  if (notifications.length === 0) {
    $('[data-notifications-count]').textContent = 'No notifications';
    $('[data-notifications-list]').replaceChildren(createEmptyState({
      title: 'No notifications yet',
      message: 'Updates about your account, jobs and applications will appear here.',
      icon: 'bell',
      headingLevel: 2, // directly under the page h1
    }));
    return;
  }
  $('[data-notifications-count]').textContent = unread === 0
    ? `You're all caught up · ${pluralize(notifications.length, 'notification')}`
    : `${unread} unread · ${pluralize(notifications.length, 'notification')}`;

  const groups = new Map();
  notifications.forEach((notification) => {
    const label = getGroupLabel(notification.createdAt);
    groups.set(label, [...(groups.get(label) ?? []), notification]);
  });
  $('[data-notifications-list]').replaceChildren(...[...groups.entries()].map(([label, items], index) => {
    const sectionEl = createElement('section', 'notification-group');
    const headingEl = createElement('h2', 'notification-group__title', label);
    headingEl.id = `notification-group-${index}`;
    sectionEl.setAttribute('aria-labelledby', headingEl.id);
    const listEl = createElement('ul', 'notification-list');
    listEl.setAttribute('role', 'list');
    listEl.append(...items.map(createItem));
    sectionEl.append(headingEl, listEl);
    return sectionEl;
  }));
}

function handleMarkOne(notificationId) {
  const result = markAsRead(notificationId);
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    render();
    return;
  }
  render();
  $(`[data-notification-id="${CSS.escape(notificationId)}"]`)?.focus();
}

function handleMarkAll() {
  const result = markAllAsRead();
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    return;
  }
  render();
  showToast(result.data.changed ? 'All notifications marked as read.' : 'Everything was already read.', { type: 'success' });
  $('[data-notifications-count]').focus();
}

async function init() {
  user = await initProtectedPage(ROLES.STUDENT, ROLES.RECRUITER, ROLES.ADMIN);
  if (!user) return;
  $('[data-mark-all]').addEventListener('click', handleMarkAll);
  $('[data-notifications-list]').addEventListener('click', (event) => {
    const markEl = event.target.closest('[data-mark-read]');
    if (markEl) {
      handleMarkOne(markEl.dataset.markRead);
      return;
    }
    // Opening a notification marks it read first; the browser then follows the link.
    const openEl = event.target.closest('[data-open-notification]');
    if (openEl) markAsRead(openEl.dataset.openNotification);
  });
  window.addEventListener('storage', render); // e.g. a new notification arrived in another tab
  render();
}

init();
