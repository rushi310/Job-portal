/**
 * applications.js — My Applications page (Phase 6; UI_SPEC.md §5 "My Applications").
 * The logged-in student's applications only: status filter, status badges, expandable timeline,
 * and Withdraw where allowed (BR-15, with confirmation). Students never change any other status.
 * Order: most recent activity first (the documented default; no sort control is specified).
 */

import { ROLES, PAGE_PATHS, APPLICATION_STATUS } from '../../core/config.js';
import {
  toRoot, getLabel, formatDate, pluralize,
} from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { createEmptyState } from '../../components/empty-state.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import {
  getApplicationsByStudent, canWithdraw, withdrawApplication,
} from '../../services/application-service.js';
import { getJobById, getJobAvailability, JOB_AVAILABILITY } from '../../services/job-service.js';

const ALL = 'all';
const filterEl = document.querySelector('[data-status-filter]');
const listEl = document.querySelector('[data-application-list]');
const countEl = document.querySelector('[data-application-count]');

let student = null;
let activeFilter = ALL;

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const AVAILABILITY_TEXT = {
  [JOB_AVAILABILITY.EXPIRED]: 'Job expired',
  [JOB_AVAILABILITY.CLOSED]: 'Job closed by recruiter',
  [JOB_AVAILABILITY.UNAVAILABLE]: 'Job no longer available',
};

/* ---------- Filter ---------- */

function renderFilter(applications) {
  const options = [ALL, ...Object.values(APPLICATION_STATUS)];
  filterEl.replaceChildren(...options.map((value) => {
    const count = value === ALL ? applications.length : applications.filter((a) => a.status === value).length;
    const buttonEl = createElement('button', 'tabs__tab', `${value === ALL ? 'All' : getLabel(value)} (${count})`);
    buttonEl.type = 'button';
    buttonEl.dataset.status = value;
    buttonEl.setAttribute('aria-pressed', String(value === activeFilter));
    return buttonEl;
  }));
}

/* ---------- Cards ---------- */

function createTimeline(application) {
  const history = Array.isArray(application.statusHistory) ? application.statusHistory : [];
  const detailsEl = createElement('details', 'application-card__timeline');
  detailsEl.append(createElement('summary', '', `View timeline (${pluralize(history.length, 'update')})`));
  const listEl = createElement('ol', 'timeline mt-4');
  history.forEach((entry) => {
    const itemEl = createElement('li', 'timeline__item');
    itemEl.append(
      createElement('p', 'font-semibold', getLabel(entry.status) || 'Update'),
      createElement('p', 'timeline__time', formatDate(entry.at)),
    );
    if (entry.note) itemEl.append(createElement('p', 'text-sm', entry.note));
    listEl.append(itemEl);
  });
  detailsEl.append(listEl);
  if (application.coverNote) {
    detailsEl.append(createElement('p', 'application-card__note', `Your cover note: ${application.coverNote}`));
  }
  return detailsEl;
}

function createApplicationCard(application) {
  const job = getJobById(application.jobId);
  const availability = getJobAvailability(job);
  const canOpenJob = availability === JOB_AVAILABILITY.OPEN || availability === JOB_AVAILABILITY.EXPIRED;
  const title = job?.title ?? 'Job no longer available';

  const cardEl = createElement('li', 'card application-card');
  cardEl.dataset.applicationId = application.id;

  const headerEl = createElement('div', 'application-card__header');
  const headingEl = createElement('div', 'application-card__heading');
  const titleEl = createElement('h3', 'job-card__title');
  if (canOpenJob) {
    const linkEl = createElement('a', '', title);
    linkEl.href = toRoot(`${PAGE_PATHS.JOB_DETAILS}?id=${encodeURIComponent(job.id)}`);
    titleEl.append(linkEl);
  } else {
    titleEl.textContent = title;
  }
  headingEl.append(titleEl, createElement('p', 'job-card__company', job?.companyName ?? '—'));
  const statusLabel = getLabel(application.status) || 'Unknown';
  const badgeEl = createElement('span', `badge badge--status-${application.status}`, `Status: ${statusLabel}`);
  headerEl.append(headingEl, badgeEl);

  const metaEl = createElement('p', 'dashboard-list__meta',
    `Applied ${formatDate(application.appliedAt)} · Last updated ${formatDate(application.updatedAt ?? application.appliedAt)}`);

  cardEl.append(headerEl, metaEl);
  if (AVAILABILITY_TEXT[availability]) {
    cardEl.append(createElement('span', 'badge badge--status-closed', AVAILABILITY_TEXT[availability]));
  }
  cardEl.append(createTimeline(application));

  if (canWithdraw(application)) {
    const withdrawEl = createElement('button', 'btn btn--danger btn--sm application-card__withdraw', 'Withdraw');
    withdrawEl.type = 'button';
    withdrawEl.dataset.action = 'withdraw';
    withdrawEl.dataset.title = title;
    withdrawEl.setAttribute('aria-label', `Withdraw application: ${title}`);
    cardEl.append(withdrawEl);
  }
  return cardEl;
}

/* ---------- Render ---------- */

function render() {
  try {
    const applications = getApplicationsByStudent(student.id);
    renderFilter(applications);
    const visible = activeFilter === ALL ? applications : applications.filter((a) => a.status === activeFilter);

    if (applications.length === 0) {
      countEl.textContent = '';
      listEl.replaceChildren(createEmptyState({
        icon: 'fileText',
        title: 'No applications yet',
        message: 'Find a job you like and apply — you can follow its progress here.',
        action: { label: 'Browse jobs', href: toRoot(PAGE_PATHS.JOBS) },
      }));
      return;
    }

    countEl.textContent = activeFilter === ALL
      ? pluralize(applications.length, 'application')
      : `${pluralize(visible.length, 'application')} with status ${getLabel(activeFilter)}`;

    if (visible.length === 0) {
      const emptyEl = createEmptyState({
        icon: 'fileText',
        title: `No ${getLabel(activeFilter)} applications`,
        message: 'Choose another status to see more applications.',
      });
      const showAllEl = createElement('button', 'btn btn--primary', 'Show all applications');
      showAllEl.type = 'button';
      showAllEl.dataset.status = ALL;
      emptyEl.append(showAllEl);
      listEl.replaceChildren(emptyEl);
      return;
    }

    const cardsEl = createElement('ul', 'application-list');
    cardsEl.setAttribute('role', 'list');
    cardsEl.append(...visible.map(createApplicationCard));
    listEl.replaceChildren(cardsEl);
  } catch (error) {
    console.error('applications: could not render applications', error);
    countEl.textContent = '';
    listEl.replaceChildren(createEmptyState({
      icon: 'alert',
      title: 'Applications could not be loaded',
      message: 'Please reload the page.',
    }));
  }
}

/* ---------- Events ---------- */

async function handleWithdraw(buttonEl) {
  const cardEl = buttonEl.closest('[data-application-id]');
  const confirmed = await confirmDialog({
    title: 'Withdraw application?',
    message: `Withdraw your application for "${buttonEl.dataset.title}"? You will not be able to apply to this job again.`,
    confirmLabel: 'Withdraw',
  });
  if (!confirmed) return;

  const result = withdrawApplication(cardEl.dataset.applicationId);
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    render();
    return;
  }
  showToast('Application withdrawn.', { type: 'success' });
  render();
  countEl.tabIndex = -1;
  countEl.focus();
}

function setFilter(value) {
  activeFilter = value;
  render();
}

async function init() {
  student = await initProtectedPage(ROLES.STUDENT);
  if (!student) return;

  filterEl.addEventListener('click', (event) => {
    const buttonEl = event.target.closest('[data-status]');
    if (buttonEl) setFilter(buttonEl.dataset.status);
  });
  listEl.addEventListener('click', (event) => {
    const withdrawEl = event.target.closest('[data-action="withdraw"]');
    if (withdrawEl) {
      handleWithdraw(withdrawEl);
      return;
    }
    const showAllEl = event.target.closest('[data-status]');
    if (showAllEl) setFilter(showAllEl.dataset.status);
  });
  render();
}

init();
