/**
 * my-jobs.js — Recruiter "My Jobs" page (Phase 8).
 * Lists only the logged-in recruiter's own jobs with a status filter, applicant counts and the
 * actions the rules allow: Edit (pending / approved), Close (approved, BR-10), View applicants.
 * There is no delete: removing jobs is an admin action (Phase 9).
 */

import { ROLES, JOB_STATUS, PAGE_PATHS } from '../../core/config.js';
import { toRoot, getLabel, formatDate, pluralize } from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { createEmptyState } from '../../components/empty-state.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { renderApprovalBanner } from '../../components/approval-banner.js';
import { watchScrollRegion } from '../../components/scroll-region.js';
import {
  getOwnJobs, getOwnJob, isJobExpired, canEditJob, canCloseJob, closeJob, isActiveRecruiter,
} from '../../services/job-service.js';
import { getApplicationsForRecruiter } from '../../services/application-service.js';

const ALL = 'all';
const FILTERS = [ALL, JOB_STATUS.PENDING, JOB_STATUS.APPROVED, JOB_STATUS.REJECTED, JOB_STATUS.CLOSED];
const $ = (selector) => document.querySelector(selector);

let currentUser = null;
let activeFilter = ALL;

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createLink(label, path, className = 'btn btn--outline btn--sm') {
  const linkEl = createElement('a', className, label);
  linkEl.href = toRoot(path);
  return linkEl;
}

function createStatusCell(job) {
  const cellEl = createElement('td');
  cellEl.dataset.label = 'Status';
  const label = getLabel(job.status) || 'Unknown';
  const badgeEl = createElement('span', `badge badge--status-${job.status}`, label);
  badgeEl.setAttribute('aria-label', `Status: ${label}`);
  cellEl.append(badgeEl);
  if (job.status === JOB_STATUS.APPROVED && isJobExpired(job)) {
    cellEl.append(' ', createElement('span', 'badge badge--status-expired', 'Expired'));
  }
  if (job.status === JOB_STATUS.PENDING) {
    cellEl.append(createElement('p', 'jobs-table__note', 'Waiting for admin approval'));
  }
  if (job.status === JOB_STATUS.REJECTED && job.rejectionReason) {
    cellEl.append(createElement('p', 'jobs-table__note', `Reason: ${job.rejectionReason}`));
  }
  return cellEl;
}

function createCell(label, content) {
  const cellEl = createElement('td');
  cellEl.dataset.label = label;
  cellEl.append(content);
  return cellEl;
}

function createActions(job, canManage) {
  const actionsEl = createElement('div', 'table-actions');
  if (canManage && canEditJob(job)) {
    const editEl = createLink('Edit', `${PAGE_PATHS.POST_JOB}?id=${encodeURIComponent(job.id)}`);
    editEl.setAttribute('aria-label', `Edit ${job.title}`);
    actionsEl.append(editEl);
  }
  if (canManage && canCloseJob(job)) {
    const closeEl = createElement('button', 'btn btn--ghost btn--sm table-actions__danger', 'Close');
    closeEl.type = 'button';
    closeEl.dataset.closeJob = job.id;
    closeEl.setAttribute('aria-label', `Close ${job.title}`);
    actionsEl.append(closeEl);
  }
  const applicantsEl = createLink('Applicants', `${PAGE_PATHS.APPLICANTS}?jobId=${encodeURIComponent(job.id)}`,
    'btn btn--ghost btn--sm');
  applicantsEl.setAttribute('aria-label', `View applicants for ${job.title}`);
  actionsEl.append(applicantsEl);
  return actionsEl;
}

function createRow(job, applicantCount, canManage) {
  const rowEl = createElement('tr');
  rowEl.dataset.jobId = job.id;
  const titleEl = createElement('th');
  titleEl.scope = 'row';
  titleEl.append(
    createElement('span', 'jobs-table__title', job.title),
    createElement('span', 'jobs-table__meta', `${job.location} · ${getLabel(job.jobType)} · ${getLabel(job.workMode)}`),
  );
  rowEl.append(
    titleEl,
    createStatusCell(job),
    createCell('Posted', formatDate(job.postedAt)),
    createCell('Deadline', formatDate(job.deadline)),
    createCell('Applicants', String(applicantCount)),
    createCell('Actions', createActions(job, canManage)),
  );
  return rowEl;
}

function createTable(jobs, countsByJob, canManage) {
  const wrapperEl = createElement('div', 'table-wrapper table-wrapper--stack');
  const tableEl = createElement('table', 'table jobs-table');
  const captionEl = createElement('caption', 'visually-hidden', 'Your jobs');
  const headEl = createElement('thead');
  const headRowEl = createElement('tr');
  ['Job', 'Status', 'Posted', 'Deadline', 'Applicants', 'Actions'].forEach((label) => {
    const cellEl = createElement('th', '', label);
    cellEl.scope = 'col';
    headRowEl.append(cellEl);
  });
  headEl.append(headRowEl);
  const bodyEl = createElement('tbody');
  bodyEl.append(...jobs.map((job) => createRow(job, countsByJob.get(job.id) ?? 0, canManage)));
  tableEl.append(captionEl, headEl, bodyEl);
  wrapperEl.append(tableEl);
  watchScrollRegion(wrapperEl, 'Your jobs');
  return wrapperEl;
}

function renderFilter(jobs) {
  $('[data-status-filter]').replaceChildren(...FILTERS.map((value) => {
    const count = value === ALL ? jobs.length : jobs.filter((job) => job.status === value).length;
    const buttonEl = createElement('button', 'tabs__tab', `${value === ALL ? 'All' : getLabel(value)} (${count})`);
    buttonEl.type = 'button';
    buttonEl.dataset.status = value;
    buttonEl.setAttribute('aria-pressed', String(value === activeFilter));
    return buttonEl;
  }));
}

function render() {
  const jobs = getOwnJobs();
  const canManage = isActiveRecruiter(currentUser);
  const countsByJob = new Map();
  getApplicationsForRecruiter().forEach((application) => {
    countsByJob.set(application.jobId, (countsByJob.get(application.jobId) ?? 0) + 1);
  });
  renderFilter(jobs);

  const shown = activeFilter === ALL ? jobs : jobs.filter((job) => job.status === activeFilter);
  $('[data-jobs-count]').textContent = activeFilter === ALL
    ? `${pluralize(jobs.length, 'job')} posted`
    : `${pluralize(shown.length, 'job')} ${getLabel(activeFilter).toLowerCase()}`;

  if (jobs.length === 0) {
    $('[data-jobs-list]').replaceChildren(createEmptyState({
      title: 'No jobs yet',
      message: canManage ? 'Post your first job. It goes live once an admin approves it.'
        : 'You can post jobs once your account is approved.',
      icon: 'briefcase',
      action: canManage ? { label: 'Post a Job', href: toRoot(PAGE_PATHS.POST_JOB) } : undefined,
    }));
    return;
  }
  if (shown.length === 0) {
    $('[data-jobs-list]').replaceChildren(createEmptyState({
      title: `No ${getLabel(activeFilter).toLowerCase()} jobs`,
      message: 'Choose another status to see more jobs.',
      icon: 'briefcase',
    }));
    return;
  }
  $('[data-jobs-list]').replaceChildren(createTable(shown, countsByJob, canManage));
}

async function handleClose(jobId) {
  const job = getOwnJob(jobId);
  if (!job) return;
  const confirmed = await confirmDialog({
    title: 'Close this job?',
    message: `"${job.title}" will no longer appear in job search and no one can apply. `
      + 'Existing applications are kept and you can still review them. This cannot be undone.',
    confirmLabel: 'Close job',
  });
  if (!confirmed) return;
  const result = closeJob(jobId);
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    return;
  }
  showToast('Job closed.', { type: 'success' });
  render();
  $('[data-jobs-count]').focus();
}

function bindEvents() {
  $('[data-status-filter]').addEventListener('click', (event) => {
    const buttonEl = event.target.closest('[data-status]');
    if (!buttonEl) return;
    activeFilter = buttonEl.dataset.status;
    render();
  });
  $('[data-jobs-list]').addEventListener('click', (event) => {
    const closeEl = event.target.closest('[data-close-job]');
    if (closeEl) handleClose(closeEl.dataset.closeJob);
  });
}

async function init() {
  const user = await initProtectedPage(ROLES.RECRUITER);
  if (!user) return;
  currentUser = user;
  renderApprovalBanner($('[data-approval-banner]'), user);
  if (isActiveRecruiter(user)) $('[data-header-action]').append(createLink('Post a Job', PAGE_PATHS.POST_JOB, 'btn btn--primary'));
  bindEvents();
  render();
}

init();
