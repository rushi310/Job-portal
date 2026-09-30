/**
 * jobs.js — Admin "Moderate Jobs" page (Phase 9, PROJECT_SPEC §3.4, BR-08, BR-09).
 * Status filter + table of every job. Pending jobs can be approved or rejected with a reason
 * (reason dialog); any job can be deleted (confirmation). "View" shows the full job first.
 * ?status= in the URL only preselects the filter.
 */

import {
  ROLES, JOB_STATUS, REJECTION_REASON_MAX_LENGTH,
} from '../../core/config.js';
import {
  getLabel, formatDate, formatSalary, pluralize, getQueryParam,
} from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { createEmptyState } from '../../components/empty-state.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { setFieldError } from '../../components/form-field.js';
import { watchScrollRegion } from '../../components/scroll-region.js';
import { isJobExpired } from '../../services/job-service.js';
import {
  listJobs, canModerateJob, approveJob, rejectJob, deleteJob, validateRejectionReason,
} from '../../services/admin-service.js';

const ALL = 'all';
const FILTERS = [ALL, ...Object.values(JOB_STATUS)];
const $ = (selector) => document.querySelector(selector);
let activeFilter = ALL;

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const findEntry = (jobId) => listJobs().find(({ job }) => job.id === jobId);

/* ---------- Table ---------- */

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
  if (job.status === JOB_STATUS.REJECTED && job.rejectionReason) {
    cellEl.append(createElement('span', 'jobs-table__note', `Reason: ${job.rejectionReason}`));
  }
  return cellEl;
}

function createCell(label, content) {
  const cellEl = createElement('td');
  cellEl.dataset.label = label;
  cellEl.append(content);
  return cellEl;
}

function createActionButton(label, action, job, className = 'btn btn--outline btn--sm') {
  const buttonEl = createElement('button', className, label);
  buttonEl.type = 'button';
  buttonEl.dataset.jobAction = action;
  buttonEl.dataset.jobId = job.id;
  buttonEl.setAttribute('aria-label', `${label} ${job.title}`);
  return buttonEl;
}

function createRow({ job, recruiterName, applicantCount }) {
  const rowEl = createElement('tr');
  rowEl.dataset.jobId = job.id;
  const titleEl = createElement('th');
  titleEl.scope = 'row';
  titleEl.append(
    createElement('span', 'jobs-table__title', job.title),
    createElement('span', 'jobs-table__meta', `${job.companyName} · ${job.location}`),
  );
  const actionsEl = createElement('div', 'table-actions');
  actionsEl.append(createActionButton('View', 'view', job, 'btn btn--ghost btn--sm'));
  if (canModerateJob(job)) {
    actionsEl.append(
      createActionButton('Approve', 'approve', job, 'btn btn--primary btn--sm'),
      createActionButton('Reject', 'reject', job),
    );
  }
  actionsEl.append(createActionButton('Delete', 'delete', job, 'btn btn--ghost btn--sm table-actions__danger'));
  rowEl.append(
    titleEl,
    createCell('Recruiter', recruiterName),
    createStatusCell(job),
    createCell('Posted', formatDate(job.postedAt)),
    createCell('Applicants', String(applicantCount)),
    createCell('Actions', actionsEl),
  );
  return rowEl;
}

function renderFilter(entries) {
  $('[data-status-filter]').replaceChildren(...FILTERS.map((value) => {
    const count = value === ALL ? entries.length : entries.filter(({ job }) => job.status === value).length;
    const buttonEl = createElement('button', 'tabs__tab', `${value === ALL ? 'All' : getLabel(value)} (${count})`);
    buttonEl.type = 'button';
    buttonEl.dataset.status = value;
    buttonEl.setAttribute('aria-pressed', String(value === activeFilter));
    return buttonEl;
  }));
}

function render() {
  const entries = listJobs();
  renderFilter(entries);
  const shown = activeFilter === ALL ? entries : entries.filter(({ job }) => job.status === activeFilter);
  $('[data-jobs-count]').textContent = activeFilter === ALL
    ? `${pluralize(shown.length, 'job')} in total`
    : `${pluralize(shown.length, 'job')} ${getLabel(activeFilter).toLowerCase()}`;

  if (shown.length === 0) {
    $('[data-jobs-list]').replaceChildren(createEmptyState({
      title: activeFilter === ALL ? 'No jobs yet' : `No ${getLabel(activeFilter).toLowerCase()} jobs`,
      message: activeFilter === JOB_STATUS.PENDING ? 'Nothing is waiting for approval.' : 'Choose another status to see more jobs.',
      icon: 'briefcase',
    }));
    return;
  }
  const wrapperEl = createElement('div', 'table-wrapper table-wrapper--stack');
  const tableEl = createElement('table', 'table admin-table');
  tableEl.append(createElement('caption', 'visually-hidden', 'Jobs'));
  const headRowEl = createElement('tr');
  ['Job', 'Recruiter', 'Status', 'Posted', 'Applicants', 'Actions'].forEach((label) => {
    const cellEl = createElement('th', '', label);
    cellEl.scope = 'col';
    headRowEl.append(cellEl);
  });
  const headEl = createElement('thead');
  headEl.append(headRowEl);
  const bodyEl = createElement('tbody');
  bodyEl.append(...shown.map(createRow));
  tableEl.append(headEl, bodyEl);
  wrapperEl.append(tableEl);
  watchScrollRegion(wrapperEl, 'Jobs');
  $('[data-jobs-list]').replaceChildren(wrapperEl);
}

function afterChange(message) {
  showToast(message, { type: 'success' });
  render();
  $('[data-jobs-count]').focus();
}

/* ---------- View details ---------- */

function addDetail(listEl, term, value) {
  const itemEl = createElement('div', 'detail-list__item');
  itemEl.append(createElement('dt', '', term), createElement('dd', '', value));
  listEl.append(itemEl);
}

function openDetails({ job, recruiterName, applicantCount }) {
  const contentEl = createElement('div', 'job-review');
  const eligibility = job.eligibility ?? {};
  const detailsEl = createElement('dl', 'detail-list');
  addDetail(detailsEl, 'Company', job.companyName);
  addDetail(detailsEl, 'Recruiter', recruiterName);
  addDetail(detailsEl, 'Status', getLabel(job.status) || 'Unknown');
  addDetail(detailsEl, 'Location', `${job.location} · ${getLabel(job.jobType)} · ${getLabel(job.workMode)}`);
  addDetail(detailsEl, 'Pay', formatSalary(job));
  addDetail(detailsEl, 'Experience', String(job.experience ?? ''));
  addDetail(detailsEl, 'Openings', String(job.openings ?? ''));
  addDetail(detailsEl, 'Apply by', formatDate(job.deadline));
  addDetail(detailsEl, 'Degrees', eligibility.degrees?.length ? eligibility.degrees.join(', ') : 'Any');
  addDetail(detailsEl, 'Graduation years', eligibility.graduationYears?.length ? eligibility.graduationYears.join(', ') : 'Any');
  addDetail(detailsEl, 'Minimum CGPA', Number.isFinite(eligibility.minCgpa) ? String(eligibility.minCgpa) : 'None');
  addDetail(detailsEl, 'Applicants', String(applicantCount));
  contentEl.append(detailsEl);
  if (job.rejectionReason) contentEl.append(createElement('p', 'alert alert--warning', `Rejection reason: ${job.rejectionReason}`));

  const skillsEl = createElement('ul', 'chip-list');
  skillsEl.setAttribute('aria-label', 'Skills');
  skillsEl.append(...(job.skills ?? []).map((skill) => createElement('li', 'chip', String(skill))));
  contentEl.append(skillsEl, createElement('p', 'job-review__text', String(job.description ?? '')));
  const responsibilities = Array.isArray(job.responsibilities) ? job.responsibilities.filter(Boolean) : [];
  if (responsibilities.length) {
    const listEl = createElement('ul', 'job-review__list');
    listEl.append(...responsibilities.map((line) => createElement('li', '', String(line))));
    contentEl.append(listEl);
  }
  openModal({ title: job.title, content: contentEl, actions: [{ label: 'Close', variant: 'primary' }] });
}

/* ---------- Approve / reject / delete ---------- */

function openRejectDialog(job) {
  const formEl = createElement('form', 'form');
  formEl.noValidate = true;
  const groupEl = createElement('div', 'form-group');
  const labelEl = createElement('label', 'form-label', 'Reason for rejection ');
  labelEl.htmlFor = 'reject-reason';
  const starEl = createElement('span', 'form-label__required', '*');
  starEl.setAttribute('aria-hidden', 'true');
  labelEl.append(starEl);
  const textareaEl = createElement('textarea', 'form-control');
  textareaEl.id = 'reject-reason';
  textareaEl.name = 'reason';
  textareaEl.rows = 4;
  textareaEl.maxLength = REJECTION_REASON_MAX_LENGTH;
  textareaEl.required = true;
  textareaEl.setAttribute('aria-describedby', 'reject-reason-hint reject-reason-error');
  const hintEl = createElement('p', 'form-hint', `The recruiter sees this reason on My Jobs. Up to ${REJECTION_REASON_MAX_LENGTH} characters.`);
  hintEl.id = 'reject-reason-hint';
  const errorEl = createElement('p', 'form-error');
  errorEl.id = 'reject-reason-error';
  errorEl.hidden = true;
  groupEl.append(labelEl, textareaEl, hintEl, errorEl);
  formEl.append(createElement('p', '', `Reject "${job.title}" from ${job.companyName}?`), groupEl);

  let modal = null;
  const submit = () => {
    const message = validateRejectionReason(textareaEl.value);
    setFieldError(textareaEl, message);
    if (message) {
      textareaEl.focus();
      return;
    }
    const result = rejectJob(job.id, textareaEl.value);
    if (!result.ok) {
      setFieldError(textareaEl, result.error);
      return;
    }
    modal.close();
    afterChange(`"${job.title}" was rejected.`);
  };
  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });
  modal = openModal({
    title: 'Reject job',
    content: formEl,
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      { label: 'Reject job', variant: 'danger', onClick: submit, closeOnClick: false },
    ],
  });
  textareaEl.focus();
}

async function handleAction(buttonEl) {
  const { jobAction: action, jobId } = buttonEl.dataset;
  const entry = findEntry(jobId);
  if (!entry) return;
  const { job } = entry;

  if (action === 'view') {
    openDetails(entry);
    return;
  }
  if (action === 'reject') {
    openRejectDialog(job);
    return;
  }
  if (action === 'delete') {
    const confirmed = await confirmDialog({
      title: 'Delete this job?',
      message: `"${job.title}" is removed permanently. Its applications stay in students' history as "Job no longer available". This cannot be undone.`,
      confirmLabel: 'Delete job',
    });
    if (!confirmed) return;
  }
  const result = action === 'approve' ? approveJob(jobId) : deleteJob(jobId);
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    render();
    return;
  }
  afterChange(action === 'approve'
    ? `"${job.title}" is approved and visible to students.` : `"${job.title}" was deleted.`);
}

async function init() {
  const user = await initProtectedPage(ROLES.ADMIN);
  if (!user) return;
  const preset = getQueryParam('status');
  if (FILTERS.includes(preset)) activeFilter = preset;

  $('[data-status-filter]').addEventListener('click', (event) => {
    const buttonEl = event.target.closest('[data-status]');
    if (!buttonEl) return;
    activeFilter = buttonEl.dataset.status;
    render();
  });
  $('[data-jobs-list]').addEventListener('click', (event) => {
    const buttonEl = event.target.closest('[data-job-action]');
    if (buttonEl) handleAction(buttonEl);
  });
  window.addEventListener('storage', render); // data changed in another tab
  render();
}

init();
