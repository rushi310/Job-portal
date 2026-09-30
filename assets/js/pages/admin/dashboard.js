/**
 * dashboard.js — Admin dashboard (Phase 9).
 * Platform totals (PROJECT_SPEC §3.4), jobs by status, quick lists of recruiters and jobs waiting for
 * approval (linking to Users / Jobs), and the "Reset demo data" danger zone (BR-20).
 * Everything is read through admin-service and re-rendered when data changes (also in other tabs).
 */

import { ROLES, JOB_STATUS, USER_STATUS, PAGE_PATHS } from '../../core/config.js';
import { toRoot, getLabel, formatRelativeTime } from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { createIcon } from '../../components/icons.js';
import { createEmptyState } from '../../components/empty-state.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import {
  getPlatformStats, listUsers, listJobs, resetDemoData,
} from '../../services/admin-service.js';

const QUICK_LIST_SIZE = 5;
const $ = (selector) => document.querySelector(selector);

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createStatCard({ label, value, icon, tone }) {
  const itemEl = createElement('li', 'card stat-card');
  const iconEl = createElement('span', `stat-card__icon${tone ? ` stat-card__icon--${tone}` : ''}`);
  iconEl.append(createIcon(icon));
  const bodyEl = createElement('div');
  bodyEl.append(createElement('p', 'stat-card__value', String(value)), createElement('p', 'stat-card__label', label));
  itemEl.append(iconEl, bodyEl);
  return itemEl;
}

function renderStats(stats) {
  $('[data-stats]').replaceChildren(...[
    { label: 'Students', value: stats.students, icon: 'graduation' },
    { label: 'Recruiters', value: stats.recruiters, icon: 'building', tone: 'info' },
    { label: 'Jobs', value: stats.jobs, icon: 'briefcase', tone: 'success' },
    { label: 'Applications', value: stats.applications, icon: 'send', tone: 'warning' },
  ].map(createStatCard));

  $('[data-jobs-by-status]').replaceChildren(...Object.values(JOB_STATUS).map((status) => {
    const itemEl = createElement('li');
    const linkEl = createElement('a', 'status-totals__item');
    linkEl.href = `${toRoot(PAGE_PATHS.ADMIN_JOBS)}?status=${status}`;
    // The link's name is its visible text plus a hidden " jobs" (e.g. "3 Pending jobs", WCAG 2.5.3).
    linkEl.append(
      createElement('span', 'status-totals__value', String(stats.jobsByStatus[status] ?? 0)),
      createElement('span', `badge badge--status-${status}`, getLabel(status)),
      createElement('span', 'visually-hidden', ' jobs'),
    );
    itemEl.append(linkEl);
    return itemEl;
  }));
}

function renderQuickList(containerEl, items, emptyTitle, createItem) {
  if (items.length === 0) {
    containerEl.replaceChildren(createEmptyState({ title: emptyTitle, icon: 'inbox' }));
    return;
  }
  const listEl = createElement('ul', 'dashboard-list');
  listEl.setAttribute('role', 'list');
  listEl.append(...items.slice(0, QUICK_LIST_SIZE).map(createItem));
  containerEl.replaceChildren(listEl);
}

function createRecruiterItem(user) {
  const itemEl = createElement('li', 'dashboard-list__item');
  const bodyEl = createElement('div', 'dashboard-list__body');
  bodyEl.append(
    createElement('p', 'dashboard-list__title', user.name),
    createElement('p', 'dashboard-list__text', [user.companyName, user.email].filter(Boolean).join(' · ')),
    createElement('p', 'dashboard-list__meta', `Registered ${formatRelativeTime(user.createdAt)}`),
  );
  itemEl.append(bodyEl, createElement('span', 'badge badge--status-pending', 'Pending'));
  return itemEl;
}

function createJobItem({ job, recruiterName }) {
  const itemEl = createElement('li', 'dashboard-list__item');
  const bodyEl = createElement('div', 'dashboard-list__body');
  bodyEl.append(
    createElement('p', 'dashboard-list__title', job.title),
    createElement('p', 'dashboard-list__text', `${job.companyName} · ${recruiterName}`),
    createElement('p', 'dashboard-list__meta', `Submitted ${formatRelativeTime(job.updatedAt ?? job.postedAt)}`),
  );
  itemEl.append(bodyEl);
  return itemEl;
}

function render() {
  const stats = getPlatformStats();
  if (!stats) return; // session ended (e.g. in another tab); the next page load redirects
  renderStats(stats);
  renderQuickList($('[data-pending-recruiters]'),
    listUsers({ role: ROLES.RECRUITER, status: USER_STATUS.PENDING }), 'No recruiters waiting', createRecruiterItem);
  renderQuickList($('[data-pending-jobs]'), listJobs({ status: JOB_STATUS.PENDING }), 'No jobs waiting', createJobItem);
}

async function handleReset(buttonEl) {
  const confirmed = await confirmDialog({
    title: 'Reset all demo data?',
    message: 'Every account, job, application, saved job and notification is replaced with the original demo data. '
      + 'Changes made in this browser cannot be recovered.',
    confirmLabel: 'Reset demo data',
  });
  if (!confirmed) return;
  buttonEl.disabled = true;
  const result = await resetDemoData();
  buttonEl.disabled = false;
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    return;
  }
  render();
  showToast('Demo data has been reset.', { type: 'success' });
}

async function init() {
  const user = await initProtectedPage(ROLES.ADMIN);
  if (!user) return;
  $('[data-user-name]').textContent = user.name;
  render();
  $('[data-reset-demo]').addEventListener('click', (event) => handleReset(event.currentTarget));
  // Another tab changed the data (e.g. a recruiter posted a job): refresh the numbers.
  window.addEventListener('storage', render);
}

init();
