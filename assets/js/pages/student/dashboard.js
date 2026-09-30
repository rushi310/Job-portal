/**
 * dashboard.js — Student dashboard (Phase 3; UI_SPEC.md §5 "Student Dashboard").
 * Read-only overview built from the logged-in student's own data: stat cards, profile completeness,
 * recent applications, recent updates, recommended jobs, and quick actions.
 * All data comes from services; all text is inserted with textContent (no HTML from data).
 */

import { ROLES, APPLICATION_STATUS } from '../../core/config.js';
import {
  toRoot, getLabel, formatDate, formatRelativeTime,
} from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { NAV_ITEMS } from '../../components/sidebar.js';
import { createIcon } from '../../components/icons.js';
import { createJobCard } from '../../components/job-card.js';
import { createEmptyState } from '../../components/empty-state.js';
import { getProfileCompleteness } from '../../services/user-service.js';
import { getApplicationsByStudent, countApplicationsByStatus } from '../../services/application-service.js';
import { getSavedJobsByStudent } from '../../services/saved-job-service.js';
import { getNotificationsForUser, countUnread } from '../../services/notification-service.js';
import { getJobById, getRecommendedJobs, isJobExpired } from '../../services/job-service.js';

const RECENT_APPLICATIONS_LIMIT = 5;
const RECENT_UPDATES_LIMIT = 3;
const RECOMMENDED_JOBS_LIMIT = 3;

/** Quick actions reuse the sidebar's paths and availability, so they switch on with the pages. */
const QUICK_ACTION_PATHS = [
  'pages/student/jobs.html',
  'pages/student/applications.html',
  'pages/student/saved-jobs.html',
  'pages/student/profile.html',
];

const $ = (selector) => document.querySelector(selector);

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function findNavItem(path) {
  return NAV_ITEMS[ROLES.STUDENT].find((item) => item.path === path);
}

/** A link when the page exists, otherwise a non-focusable "Soon" label (never a broken link). */
function createNavAction(item, { className, label = item.label, withIcon = false }) {
  const isAvailable = item.isAvailable;
  const el = createElement(isAvailable ? 'a' : 'span', `${className}${isAvailable ? '' : ' is-disabled'}`);
  if (isAvailable) {
    el.href = toRoot(item.path);
  } else {
    el.setAttribute('aria-disabled', 'true');
    el.title = 'Coming soon';
  }
  if (withIcon) el.append(createIcon(item.icon));
  el.append(label);
  if (!isAvailable) el.append(' ', createElement('span', 'tag-soon', 'Soon'));
  return el;
}

/** Render one section; a failure shows a message in that section only (the rest still works). */
function renderSection(containerEl, render) {
  try {
    render(containerEl);
  } catch (error) {
    console.error('student dashboard: section failed to render', error);
    const alertEl = createElement('p', 'alert alert--warning', 'This section could not be loaded right now.');
    alertEl.setAttribute('role', 'status');
    containerEl.replaceChildren(alertEl);
  }
}

/* ---------- Sections ---------- */

function renderGreeting(user) {
  const name = typeof user.name === 'string' ? user.name.trim() : '';
  $('[data-greeting]').textContent = name ? `Welcome back, ${name}!` : 'Welcome back!';
}

function createStatCard({ label, value, icon, tone }) {
  const itemEl = createElement('li', 'card stat-card');
  const iconEl = createElement('span', `stat-card__icon${tone ? ` stat-card__icon--${tone}` : ''}`);
  iconEl.append(createIcon(icon));
  const bodyEl = createElement('div');
  bodyEl.append(createElement('p', 'stat-card__value', value), createElement('p', 'stat-card__label', label));
  itemEl.append(iconEl, bodyEl);
  return itemEl;
}

function renderStats(listEl, { applications, savedCount, completeness }) {
  const stats = [
    { label: 'Applications', value: String(applications.length), icon: 'send' },
    {
      label: 'Shortlisted',
      value: String(countApplicationsByStatus(applications, APPLICATION_STATUS.SHORTLISTED)),
      icon: 'userPlus',
      tone: 'success',
    },
    { label: 'Saved jobs', value: String(savedCount), icon: 'bookmark', tone: 'info' },
    { label: 'Profile complete', value: `${completeness.percent}%`, icon: 'user', tone: 'warning' },
  ];
  listEl.replaceChildren(...stats.map(createStatCard));
}

function renderProfile(containerEl, completeness) {
  $('[data-profile-value]').textContent = `${completeness.percent}%`;

  const progressEl = createElement('div', 'progress');
  progressEl.setAttribute('role', 'progressbar');
  progressEl.setAttribute('aria-labelledby', 'profile-title');
  progressEl.setAttribute('aria-valuemin', '0');
  progressEl.setAttribute('aria-valuemax', '100');
  progressEl.setAttribute('aria-valuenow', String(completeness.percent));
  const barEl = createElement('div', 'progress__bar');
  barEl.style.width = `${completeness.percent}%`; // dynamic value; CSS holds all static styling
  progressEl.append(barEl);

  const hint = completeness.missing.length === 0
    ? 'Your profile is complete. Great work!'
    : `Still to add: ${completeness.missing.join(', ')}.`;
  const hintEl = createElement('p', 'profile-meter__hint', hint);

  const actionEl = createNavAction(findNavItem('pages/student/profile.html'), {
    className: 'quick-action',
    label: 'Complete your profile',
    withIcon: true,
  });
  containerEl.replaceChildren(progressEl, hintEl, actionEl);
}

function createApplicationItem(application) {
  const job = getJobById(application.jobId);
  const itemEl = createElement('li', 'dashboard-list__item');
  const bodyEl = createElement('div', 'dashboard-list__body');
  bodyEl.append(
    createElement('p', 'dashboard-list__title', job ? job.title : 'Job no longer available'),
    createElement('p', 'dashboard-list__text', job ? job.companyName : '—'),
    createElement('p', 'dashboard-list__meta', `Applied ${formatDate(application.appliedAt)}`
      + ` · Updated ${formatRelativeTime(application.updatedAt ?? application.appliedAt)}`),
  );
  const status = String(application.status ?? '');
  const badgeEl = createElement('span', `badge badge--status-${status}`, getLabel(status) || 'Unknown');
  badgeEl.setAttribute('aria-label', `Status: ${getLabel(status) || 'Unknown'}`);
  itemEl.append(bodyEl, badgeEl);
  return itemEl;
}

function renderApplications(containerEl, applications) {
  if (applications.length === 0) {
    containerEl.replaceChildren(createEmptyState({
      icon: 'fileText',
      title: 'No applications yet',
      message: 'Explore the recommended jobs below to find your first opportunity.',
    }));
    return;
  }
  const listEl = createElement('ul', 'dashboard-list');
  listEl.setAttribute('role', 'list');
  listEl.append(...applications.slice(0, RECENT_APPLICATIONS_LIMIT).map(createApplicationItem));
  containerEl.replaceChildren(listEl);
}

function createNotificationItem(notification) {
  const itemEl = createElement('li', `dashboard-list__item${notification.read ? '' : ' is-unread'}`);
  const bodyEl = createElement('div', 'dashboard-list__body');
  const titleEl = createElement('p', 'dashboard-list__title', notification.title ?? 'Update');
  if (!notification.read) {
    titleEl.append(' ', createElement('span', 'badge badge--primary', 'New'));
  }
  bodyEl.append(
    titleEl,
    createElement('p', 'dashboard-list__text', notification.message ?? ''),
    createElement('p', 'dashboard-list__meta', formatRelativeTime(notification.createdAt)),
  );
  itemEl.append(bodyEl);
  return itemEl;
}

function renderNotifications(containerEl, notifications) {
  if (notifications.length === 0) {
    containerEl.replaceChildren(createEmptyState({
      icon: 'bell',
      title: 'No updates yet',
      message: 'Application updates and announcements will appear here.',
    }));
    return;
  }
  const unread = countUnread(notifications);
  const summaryEl = createElement('p', 'text-sm text-muted mb-4',
    unread === 0 ? 'You are all caught up.' : `You have ${unread} unread update${unread === 1 ? '' : 's'}.`);
  const listEl = createElement('ul', 'dashboard-list');
  listEl.setAttribute('role', 'list');
  listEl.append(...notifications.slice(0, RECENT_UPDATES_LIMIT).map(createNotificationItem));
  containerEl.replaceChildren(summaryEl, listEl);
}

function renderRecommended(containerEl, user, applications) {
  const { items, isSkillBased } = getRecommendedJobs({
    skills: Array.isArray(user.profile?.skills) ? user.profile.skills : [],
    excludeJobIds: applications.map((application) => application.jobId),
    limit: RECOMMENDED_JOBS_LIMIT,
  });

  $('[data-recommended-subtitle]').textContent = isSkillBased
    ? 'Open jobs that match the skills on your profile.'
    : 'Latest open jobs. Add skills to your profile to get personalised recommendations.';

  if (items.length === 0) {
    containerEl.replaceChildren(createEmptyState({
      icon: 'briefcase',
      title: 'No open jobs right now',
      message: 'New openings for freshers are added regularly. Please check back soon.',
    }));
    return;
  }
  containerEl.replaceChildren(...items.map(({ job, matchedSkills }) => createJobCard(job, {
    isExpired: isJobExpired(job),
    note: matchedSkills.length > 0 ? `Matches your skills: ${matchedSkills.join(', ')}` : '',
  })));
}

function renderQuickActions(listEl) {
  listEl.replaceChildren(...QUICK_ACTION_PATHS.map((path) => {
    const itemEl = createElement('li');
    itemEl.append(createNavAction(findNavItem(path), { className: 'quick-action', withIcon: true }));
    return itemEl;
  }));
}

function renderViewAllLinks() {
  document.querySelectorAll('[data-view-all]').forEach((placeholderEl) => {
    const item = findNavItem(placeholderEl.dataset.viewAll);
    const actionEl = createNavAction(item, { className: 'btn btn--ghost btn--sm', label: 'View all' });
    placeholderEl.replaceWith(actionEl);
  });
}

/* ---------- Start ---------- */

async function init() {
  const user = await initProtectedPage(ROLES.STUDENT);
  if (!user) return;

  // Every query is scoped to the session user's id — never to a URL parameter.
  const applications = getApplicationsByStudent(user.id);
  const savedCount = getSavedJobsByStudent(user.id).length;
  const notifications = getNotificationsForUser(user.id);
  const completeness = getProfileCompleteness(user);

  renderGreeting(user);
  renderSection($('[data-stats]'), (el) => renderStats(el, { applications, savedCount, completeness }));
  renderSection($('[data-profile]'), (el) => renderProfile(el, completeness));
  renderSection($('[data-applications]'), (el) => renderApplications(el, applications));
  renderSection($('[data-notifications]'), (el) => renderNotifications(el, notifications));
  renderSection($('[data-recommended]'), (el) => renderRecommended(el, user, applications));
  renderSection($('[data-quick-actions]'), renderQuickActions);
  renderViewAllLinks();
}

init();
