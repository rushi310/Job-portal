/**
 * applicants.js — Recruiter "Applicants" page for one job (?jobId=<id>, Phase 8).
 * Only the logged-in recruiter's own job is shown; any other id shows "Job not found".
 * Each applicant row has a status select limited to the allowed next steps (BR-15) and a
 * "View profile" dialog with the application, its timeline, the student's profile and resume.
 * Every rule is checked again in application-service (ownership via job.recruiterId).
 */

import { ROLES, PAGE_PATHS, APPLICATION_STATUS, JOB_STATUS } from '../../core/config.js';
import {
  toRoot, getLabel, getQueryParam, formatDate, formatRelativeTime, pluralize,
} from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { createEmptyState } from '../../components/empty-state.js';
import { renderApprovalBanner } from '../../components/approval-banner.js';
import { createResumeSheet } from '../../components/resume-sheet.js';
import { renderIconsBefore } from '../../components/icons.js';
import { watchScrollRegion } from '../../components/scroll-region.js';
import { getOwnJob, isJobExpired, isActiveRecruiter } from '../../services/job-service.js';
import {
  getApplicantsForJob, getApplicantDetails, getApplicantResumeFile, getNextStatuses, updateApplicationStatus,
} from '../../services/application-service.js';

const FINAL_STATUSES = [APPLICATION_STATUS.SELECTED, APPLICATION_STATUS.REJECTED];
const $ = (selector, root = document) => root.querySelector(selector);

let job = null;

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createStatusBadge(status) {
  const label = getLabel(status) || 'Unknown';
  const badgeEl = createElement('span', `badge badge--status-${status}`, label);
  badgeEl.setAttribute('aria-label', `Status: ${label}`);
  return badgeEl;
}

function addDetail(listEl, term, value) {
  const itemEl = createElement('div', 'detail-list__item');
  const valueEl = createElement('dd');
  valueEl.append(value);
  itemEl.append(createElement('dt', '', term), valueEl);
  listEl.append(itemEl);
}

/* ---------- Job summary ---------- */

function renderJobSummary(applicants) {
  $('[data-job-title]').textContent = job.title;
  $('[data-job-subtitle]').textContent = `${job.companyName} · ${job.location}`;
  const detailsEl = createElement('dl', 'detail-list detail-list--4');
  const statusEl = createElement('span');
  statusEl.append(createStatusBadge(job.status));
  if (job.status === JOB_STATUS.APPROVED && isJobExpired(job)) {
    statusEl.append(' ', createElement('span', 'badge badge--status-expired', 'Expired'));
  }
  addDetail(detailsEl, 'Job status', statusEl);
  addDetail(detailsEl, 'Apply by', formatDate(job.deadline));
  addDetail(detailsEl, 'Applicants', String(applicants.length));
  const active = applicants.filter(({ application }) => getNextStatuses(application.status).length > 0).length;
  addDetail(detailsEl, 'In progress', String(active));
  $('[data-job-summary]').replaceChildren(detailsEl);
}

/* ---------- Applicant table ---------- */

function createStatusControl(application, candidateName) {
  const next = getNextStatuses(application.status);
  if (next.length === 0) {
    return createElement('span', 'status-control__final',
      application.status === APPLICATION_STATUS.WITHDRAWN ? 'Withdrawn by student' : 'Final decision');
  }
  const formEl = createElement('form', 'status-control');
  formEl.dataset.statusForm = application.id;
  formEl.noValidate = true;
  const selectId = `status-${application.id}`;
  const labelEl = createElement('label', 'visually-hidden', `New status for ${candidateName}`);
  labelEl.htmlFor = selectId;
  const selectEl = createElement('select', 'form-control form-control--sm');
  selectEl.id = selectId;
  selectEl.name = 'status';
  const placeholderEl = createElement('option', '', 'Move to…');
  placeholderEl.value = '';
  selectEl.append(placeholderEl, ...next.map((status) => {
    const optionEl = createElement('option', '', getLabel(status));
    optionEl.value = status;
    return optionEl;
  }));
  const buttonEl = createElement('button', 'btn btn--secondary btn--sm', 'Update');
  buttonEl.type = 'submit';
  buttonEl.setAttribute('aria-label', `Update status for ${candidateName}`);
  formEl.append(labelEl, selectEl, buttonEl);
  return formEl;
}

function createCell(label, content) {
  const cellEl = createElement('td');
  cellEl.dataset.label = label;
  cellEl.append(content);
  return cellEl;
}

function createRow({ application, candidateName }) {
  const rowEl = createElement('tr');
  rowEl.dataset.applicationId = application.id;
  const nameEl = createElement('th');
  nameEl.scope = 'row';
  nameEl.textContent = candidateName;
  const statusCellEl = createCell('Status', createStatusBadge(application.status));
  const viewEl = createElement('button', 'btn btn--outline btn--sm', 'View profile');
  viewEl.type = 'button';
  viewEl.dataset.viewApplication = application.id;
  viewEl.setAttribute('aria-label', `View profile and application of ${candidateName}`);
  rowEl.append(
    nameEl,
    createCell('Applied', formatDate(application.appliedAt)),
    statusCellEl,
    createCell('Change status', createStatusControl(application, candidateName)),
    createCell('Profile', viewEl),
  );
  return rowEl;
}

function render() {
  const applicants = getApplicantsForJob(job.id);
  renderJobSummary(applicants);
  $('[data-applicants-count]').textContent = pluralize(applicants.length, 'applicant');

  if (applicants.length === 0) {
    $('[data-applicants-list]').replaceChildren(createEmptyState({
      title: 'No applicants yet',
      message: job.status === JOB_STATUS.APPROVED
        ? 'Students who apply to this job will appear here.'
        : 'Students can apply once this job is approved and open.',
      icon: 'users',
    }));
    return;
  }
  const wrapperEl = createElement('div', 'table-wrapper table-wrapper--stack');
  const tableEl = createElement('table', 'table applicants-table');
  tableEl.append(createElement('caption', 'visually-hidden', `Applicants for ${job.title}`));
  const headRowEl = createElement('tr');
  ['Candidate', 'Applied', 'Status', 'Change status', 'Profile'].forEach((label) => {
    const cellEl = createElement('th', '', label);
    cellEl.scope = 'col';
    headRowEl.append(cellEl);
  });
  const headEl = createElement('thead');
  headEl.append(headRowEl);
  const bodyEl = createElement('tbody');
  bodyEl.append(...applicants.map(createRow));
  tableEl.append(headEl, bodyEl);
  wrapperEl.append(tableEl);
  watchScrollRegion(wrapperEl, 'Applicants');
  $('[data-applicants-list]').replaceChildren(wrapperEl);
}

/* ---------- Status change ---------- */

async function handleStatusSubmit(event) {
  event.preventDefault();
  const formEl = event.target;
  const applicationId = formEl.dataset.statusForm;
  const newStatus = formEl.elements.status.value;
  if (!newStatus) {
    showToast('Choose a new status first.', { type: 'info' });
    formEl.elements.status.focus();
    return;
  }
  const buttonEl = formEl.querySelector('button');
  if (buttonEl.disabled) return;

  if (FINAL_STATUSES.includes(newStatus)) {
    const confirmed = await confirmDialog({
      title: `Mark as ${getLabel(newStatus)}?`,
      message: `${getLabel(newStatus)} is a final decision and cannot be changed later. The student will see it in My Applications.`,
      confirmLabel: `Mark as ${getLabel(newStatus)}`,
      variant: newStatus === APPLICATION_STATUS.REJECTED ? 'danger' : 'primary',
    });
    if (!confirmed) return;
  }

  buttonEl.disabled = true;
  const result = updateApplicationStatus(applicationId, newStatus);
  buttonEl.disabled = false;
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    render();
    return;
  }
  showToast(`Status updated to ${getLabel(newStatus)}.`, { type: 'success' });
  render();
  $(`tr[data-application-id="${CSS.escape(applicationId)}"] [data-view-application]`)?.focus();
}

/* ---------- View profile dialog ---------- */

function openResumeFile(applicationId, { download }) {
  const result = getApplicantResumeFile(applicationId);
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    return;
  }
  const url = URL.createObjectURL(result.data.blob);
  const linkEl = createElement('a');
  linkEl.href = url;
  if (download) linkEl.download = result.data.fileName;
  else linkEl.target = '_blank';
  linkEl.rel = 'noopener';
  document.body.append(linkEl);
  linkEl.click();
  linkEl.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000); // time for the new tab to load it
}

function createTimeline(application) {
  const listEl = createElement('ol', 'timeline');
  const history = Array.isArray(application.statusHistory) ? application.statusHistory : [];
  listEl.append(...history.map((entry) => {
    const itemEl = createElement('li', 'timeline__item');
    itemEl.append(
      createElement('p', 'font-semibold', getLabel(entry.status) || 'Update'),
      createElement('p', 'timeline__time', `${formatDate(entry.at)} (${formatRelativeTime(entry.at)})`),
    );
    if (entry.note) itemEl.append(createElement('p', 'text-sm', entry.note));
    return itemEl;
  }));
  return listEl;
}

function createResumeBlock(application, candidate) {
  const blockEl = createElement('div', 'candidate__resume');
  const current = candidate?.profile?.resume;
  blockEl.append(createElement('p', '', application.resumeFileName
    ? `Resume sent with the application: ${application.resumeFileName}`
    : 'No resume was attached when applying.'));
  if (!current) {
    blockEl.append(createElement('p', 'text-muted text-sm', 'The student has no resume on their profile now.'));
    return blockEl;
  }
  if (current.fileName !== application.resumeFileName) {
    blockEl.append(createElement('p', 'text-muted text-sm', `Current resume on the profile: ${current.fileName}`));
  }
  const actionsEl = createElement('div', 'candidate__actions');
  const viewEl = createElement('button', 'btn btn--outline btn--sm', 'View resume');
  viewEl.type = 'button';
  viewEl.addEventListener('click', () => openResumeFile(application.id, { download: false }));
  const downloadEl = createElement('button', 'btn btn--outline btn--sm', 'Download resume');
  downloadEl.type = 'button';
  downloadEl.addEventListener('click', () => openResumeFile(application.id, { download: true }));
  actionsEl.append(viewEl, downloadEl);
  blockEl.append(actionsEl);
  return blockEl;
}

function openCandidate(applicationId) {
  const result = getApplicantDetails(applicationId);
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    return;
  }
  const { application, candidate } = result.data;
  const contentEl = createElement('div', 'candidate');

  const applicationEl = createElement('section', 'candidate__section');
  applicationEl.append(createElement('h3', 'candidate__heading', 'Application'));
  const detailsEl = createElement('dl', 'detail-list');
  addDetail(detailsEl, 'Status', createStatusBadge(application.status));
  addDetail(detailsEl, 'Applied', formatDate(application.appliedAt));
  addDetail(detailsEl, 'Email', candidate?.email ?? '—');
  addDetail(detailsEl, 'Phone', candidate?.phone ?? '—');
  applicationEl.append(detailsEl, createResumeBlock(application, candidate));
  applicationEl.append(createElement('h4', 'candidate__subheading', 'Cover note'),
    createElement('p', 'candidate__note', application.coverNote || 'No cover note.'));
  applicationEl.append(createElement('h4', 'candidate__subheading', 'Status history'), createTimeline(application));

  const profileEl = createElement('section', 'candidate__section');
  profileEl.append(createElement('h3', 'candidate__heading', 'Profile'));
  profileEl.append(candidate
    ? createResumeSheet(candidate, { headingLevel: 4 })
    : createElement('p', '', 'This student account no longer exists.'));

  contentEl.append(applicationEl, profileEl);
  openModal({ title: candidate?.name ?? 'Applicant', content: contentEl, actions: [{ label: 'Close', variant: 'primary' }] });
}

/* ---------- Start-up ---------- */

function showMessage(title, message) {
  $('[data-page-message]').replaceChildren(createEmptyState({
    title, message, icon: 'users', action: { label: 'Back to My Jobs', href: toRoot(PAGE_PATHS.MY_JOBS) },
  }));
}

async function init() {
  const user = await initProtectedPage(ROLES.RECRUITER);
  if (!user) return;
  renderIconsBefore();
  if (renderApprovalBanner($('[data-approval-banner]'), user) || !isActiveRecruiter(user)) {
    showMessage('Applicants are not available yet', 'You can review applicants once your account is approved.');
    return;
  }
  job = getOwnJob(getQueryParam('jobId')); // another recruiter's job looks exactly like a missing one
  if (!job) {
    showMessage('Job not found', 'This job does not exist or is not one of yours.');
    return;
  }
  document.title = `Applicants: ${job.title} · FreshHire`;
  $('[data-applicants-content]').hidden = false;
  $('[data-applicants-list]').addEventListener('submit', handleStatusSubmit);
  $('[data-applicants-list]').addEventListener('click', (event) => {
    const viewEl = event.target.closest('[data-view-application]');
    if (viewEl) openCandidate(viewEl.dataset.viewApplication);
  });
  render();
}

init();
