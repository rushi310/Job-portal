/**
 * job-details.js — Job Details page (Phase 5; UI_SPEC.md §5 "Job Details").
 * Shows one approved job (?id=<jobId>), the student's eligibility per rule, and the apply flow
 * (modal with an optional cover note). All rules live in application-service.js and are checked
 * again when the application is saved; this page only reflects them.
 */

import {
  ROLES, PAGE_PATHS, ROLE_HOME_PATHS, COVER_NOTE_MAX_LENGTH,
} from '../../core/config.js';
import {
  toRoot, getLabel, getQueryParam, formatDate, formatSalary, formatRelativeTime, getInitials, daysUntil,
} from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { renderIconsBefore } from '../../components/icons.js';
import { createEmptyState } from '../../components/empty-state.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { setFieldError, setButtonLoading } from '../../components/form-field.js';
import { getVisibleJob, isJobExpired } from '../../services/job-service.js';
import { isJobSaved } from '../../services/saved-job-service.js';
import { createSaveButton, bindSaveButtons } from '../../components/save-button.js';
import {
  checkEligibility, getApplyStatus, validateApplicationForm, applyToJob, APPLY_ERRORS,
} from '../../services/application-service.js';

const containerEl = document.querySelector('[data-job-details]');

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createSection(title, id) {
  const sectionEl = createElement('section', 'card job-details__section');
  sectionEl.setAttribute('aria-labelledby', id);
  const headingEl = createElement('h2', 'card__title mb-4', title);
  headingEl.id = id;
  sectionEl.append(headingEl);
  return sectionEl;
}

/* ---------- Not found ---------- */

function renderNotFound() {
  document.title = 'Job not found · FreshHire';
  const headerEl = createElement('header', 'page-header');
  headerEl.append(createElement('h1', '', 'Job not found'));
  const emptyEl = createEmptyState({
    icon: 'briefcase',
    title: 'This job is not available',
    message: 'The link may be wrong, or the job is no longer open to applications.',
    action: { label: 'Back to jobs', href: toRoot(PAGE_PATHS.JOBS) },
  });
  containerEl.replaceChildren(headerEl, emptyEl);
}

/* ---------- Header & facts ---------- */

function describeDeadline(job, isExpired) {
  if (isExpired) return `Closed on ${formatDate(job.deadline)}`;
  const days = daysUntil(job.deadline);
  const suffix = days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} left`;
  return `${formatDate(job.deadline)} (${suffix})`;
}

function createHeader(job, { isExpired, application }) {
  const headerEl = createElement('header', 'card job-details__header');

  const titleRowEl = createElement('div', 'job-card__header');
  const logoEl = createElement('span', 'job-card__logo', getInitials(job.companyName));
  logoEl.setAttribute('aria-hidden', 'true');
  const headingEl = createElement('div', 'job-card__heading');
  headingEl.append(createElement('h1', 'job-details__title', job.title), createElement('p', 'job-card__company', job.companyName));
  titleRowEl.append(logoEl, headingEl);

  const badgesEl = createElement('div', 'flex flex-wrap gap-2 mt-4');
  badgesEl.setAttribute('data-job-badges', '');
  if (job.jobType) badgesEl.append(createElement('span', 'badge badge--primary', getLabel(job.jobType)));
  if (job.workMode) badgesEl.append(createElement('span', 'badge badge--info', getLabel(job.workMode)));
  if (isExpired) badgesEl.append(createElement('span', 'badge badge--status-expired', getLabel('expired')));
  if (application) badgesEl.append(createElement('span', 'badge badge--success', 'Applied'));

  const facts = [
    ['Location', job.location || 'Not specified'],
    ['Experience', job.experience || 'Fresher'],
    ['Salary / stipend', formatSalary(job)],
    ['Openings', Number.isFinite(job.openings) ? String(job.openings) : 'Not specified'],
    ['Posted', job.postedAt ? `${formatDate(job.postedAt)} (${formatRelativeTime(job.postedAt)})` : 'Not specified'],
    ['Apply by', describeDeadline(job, isExpired)],
  ];
  const factsEl = createElement('dl', 'job-facts');
  facts.forEach(([term, value]) => {
    const itemEl = createElement('div', 'job-facts__item');
    itemEl.append(createElement('dt', 'job-facts__term', term), createElement('dd', 'job-facts__value', value));
    factsEl.append(itemEl);
  });

  headerEl.append(titleRowEl, badgesEl, factsEl);
  return headerEl;
}

/* ---------- Content sections ---------- */

function createDescription(job) {
  const sectionEl = createSection('About the role', 'about-title');
  const paragraphs = String(job.description ?? '').split(/\n+/).map((text) => text.trim()).filter(Boolean);
  if (paragraphs.length === 0) paragraphs.push('No description provided.');
  paragraphs.forEach((text) => sectionEl.append(createElement('p', 'job-details__text', text)));
  return sectionEl;
}

function createResponsibilities(job) {
  const items = (Array.isArray(job.responsibilities) ? job.responsibilities : [])
    .filter((item) => typeof item === 'string' && item.trim());
  const sectionEl = createSection('Responsibilities', 'responsibilities-title');
  if (items.length === 0) {
    sectionEl.append(createElement('p', 'text-muted', 'No responsibilities listed.'));
    return sectionEl;
  }
  const listEl = createElement('ul', 'job-details__list');
  listEl.append(...items.map((item) => createElement('li', '', item)));
  sectionEl.append(listEl);
  return sectionEl;
}

function createSkills(job, student) {
  const sectionEl = createSection('Required skills', 'skills-title');
  const skills = (Array.isArray(job.skills) ? job.skills : []).filter((skill) => typeof skill === 'string');
  if (skills.length === 0) {
    sectionEl.append(createElement('p', 'text-muted', 'No specific skills listed.'));
    return sectionEl;
  }
  const studentSkills = new Set((student.profile?.skills ?? []).map((skill) => String(skill).toLowerCase()));
  const listEl = createElement('ul', 'chip-list');
  skills.forEach((skill) => {
    const hasSkill = studentSkills.has(skill.toLowerCase());
    const chipEl = createElement('li', `chip${hasSkill ? ' chip--match' : ''}`, hasSkill ? `✓ ${skill}` : skill);
    if (hasSkill) chipEl.append(createElement('span', 'visually-hidden', ' (on your profile)'));
    listEl.append(chipEl);
  });
  sectionEl.append(listEl);
  return sectionEl;
}

function createEligibility(job, student) {
  const { isEligible, rules } = checkEligibility(student, job);
  const sectionEl = createSection('Eligibility', 'eligibility-title');
  sectionEl.classList.add('eligibility');
  sectionEl.append(createElement('p', `eligibility__summary ${isEligible ? 'text-success' : 'text-danger'}`,
    isEligible ? '✓ You meet all the eligibility criteria.' : '✗ You do not meet all the eligibility criteria.'));

  const listEl = createElement('ul', 'eligibility__list');
  rules.forEach((rule) => {
    const itemEl = createElement('li', `eligibility__rule ${rule.met ? 'is-met' : 'is-unmet'}`);
    const markEl = createElement('span', 'eligibility__mark', rule.met ? '✓' : '✗');
    markEl.setAttribute('aria-hidden', 'true');
    const bodyEl = createElement('div');
    bodyEl.append(
      createElement('p', 'eligibility__label', `${rule.label}: ${rule.met ? 'Met' : 'Not met'}`),
      createElement('p', 'eligibility__detail', `Required: ${rule.requirement} · Yours: ${rule.yours}`),
    );
    itemEl.append(markEl, bodyEl);
    listEl.append(itemEl);
  });
  sectionEl.append(listEl);
  return sectionEl;
}

/* ---------- Apply panel ---------- */

function createTrackLink() {
  const linkEl = createElement('a', 'btn btn--outline btn--block', 'Track in My Applications');
  linkEl.href = toRoot(PAGE_PATHS.APPLICATIONS);
  return linkEl;
}

/** Link to the Resume tab of Profile & Resume (Phase 7). */
function createResumeLink(label) {
  const linkEl = createElement('a', '', label);
  linkEl.href = `${toRoot(PAGE_PATHS.PROFILE)}#resume`;
  return linkEl;
}

function createPanelLinks() {
  const linksEl = createElement('div', 'apply-panel__links');
  const jobsLinkEl = createElement('a', 'btn btn--ghost btn--sm', 'Back to jobs');
  jobsLinkEl.href = toRoot(PAGE_PATHS.JOBS);
  const dashboardLinkEl = createElement('a', 'btn btn--ghost btn--sm', 'Go to dashboard');
  dashboardLinkEl.href = toRoot(ROLE_HOME_PATHS[ROLES.STUDENT]);
  linksEl.append(jobsLinkEl, dashboardLinkEl);
  return linksEl;
}

function renderApplyPanel(panelEl, job, student) {
  const status = getApplyStatus(student, job);
  const headingEl = createElement('h2', 'card__title mb-4', 'Apply for this job');
  headingEl.id = 'apply-title';
  headingEl.tabIndex = -1; // receives focus after a successful application
  const children = [headingEl];

  if (status.canApply) {
    const resumeName = student.profile?.resume?.fileName;
    const resumeTextEl = createElement('p', 'apply-panel__text', resumeName
      ? `Your resume "${resumeName}" will be attached.`
      : 'You can apply without a resume. ');
    if (!resumeName) resumeTextEl.append(createResumeLink('Upload one on your profile'), '.');
    children.push(resumeTextEl);
    const applyEl = createElement('button', 'btn btn--primary btn--block btn--lg', 'Apply now');
    applyEl.type = 'button';
    applyEl.dataset.action = 'apply';
    children.push(applyEl);
  } else if (status.code === APPLY_ERRORS.ALREADY_APPLIED) {
    const { application } = status;
    const statusLabel = getLabel(application.status) || 'Unknown';
    const messageEl = createElement('div', 'alert alert--success');
    messageEl.setAttribute('role', 'status');
    messageEl.append(createElement('p', '', `Application submitted on ${formatDate(application.appliedAt)}.`));
    const statusEl = createElement('p', 'mt-2', 'Current status: ');
    statusEl.append(createElement('span', `badge badge--status-${application.status}`, statusLabel));
    messageEl.append(statusEl);
    children.push(messageEl, createTrackLink());
  } else {
    const reasonId = 'apply-blocked-reason';
    const reasonEl = createElement('p', 'alert alert--warning', status.message);
    reasonEl.id = reasonId;
    children.push(reasonEl);
    const applyEl = createElement('button', 'btn btn--primary btn--block btn--lg', 'Apply now');
    applyEl.type = 'button';
    applyEl.disabled = true;
    applyEl.setAttribute('aria-describedby', reasonId);
    children.push(applyEl);
  }

  children.push(createSaveButton(job, isJobSaved(student.id, job.id), { block: true }), createPanelLinks());
  panelEl.replaceChildren(...children);
}

/* ---------- Apply modal ---------- */

function createApplyForm(job, student) {
  const formEl = createElement('form', 'form');
  formEl.noValidate = true;
  formEl.dataset.applyForm = '';

  const introEl = createElement('p', '', 'Applying for ');
  introEl.append(createElement('strong', '', job.title), ` at ${job.companyName}.`);

  const resumeName = student.profile?.resume?.fileName;
  const resumeEl = createElement('p', 'alert alert--info', resumeName
    ? `Resume attached: ${resumeName}`
    : 'No resume on your profile. You can still apply (a resume is not required).');

  const groupEl = createElement('div', 'form-group');
  const labelEl = createElement('label', 'form-label', 'Cover note ');
  labelEl.htmlFor = 'apply-cover-note';
  labelEl.append(createElement('span', 'text-muted text-xs', '(optional)'));
  const textareaEl = createElement('textarea', 'form-control');
  textareaEl.id = 'apply-cover-note';
  textareaEl.name = 'coverNote';
  textareaEl.rows = 6;
  textareaEl.setAttribute('aria-describedby', 'apply-cover-note-hint apply-cover-note-error');
  const hintEl = createElement('p', 'form-hint', 'Tell the recruiter briefly why you are a good fit. ');
  hintEl.id = 'apply-cover-note-hint';
  const counterEl = createElement('span', '', `0 / ${COVER_NOTE_MAX_LENGTH}`);
  counterEl.dataset.charCount = '';
  hintEl.append(counterEl);
  const errorEl = createElement('p', 'form-error');
  errorEl.id = 'apply-cover-note-error';
  errorEl.hidden = true;
  groupEl.append(labelEl, textareaEl, hintEl, errorEl);

  const alertEl = createElement('div', 'alert alert--danger');
  alertEl.setAttribute('role', 'alert');
  alertEl.dataset.applyAlert = '';
  alertEl.tabIndex = -1;
  alertEl.hidden = true;

  formEl.append(introEl, resumeEl, groupEl, alertEl);
  return formEl;
}

function openApplyModal(job, student, onApplied) {
  const formEl = createApplyForm(job, student);
  const textareaEl = formEl.querySelector('textarea');
  const alertEl = formEl.querySelector('[data-apply-alert]');
  let isSubmitting = false;
  let modal;

  const showAlert = (message) => {
    alertEl.textContent = message;
    alertEl.hidden = false;
  };

  function handleSubmit() {
    if (isSubmitting) return; // blocks double clicks
    const submitEl = modal.element.querySelector('[data-action="submit-application"]');
    alertEl.hidden = true;

    const fieldErrors = validateApplicationForm({ coverNote: textareaEl.value });
    setFieldError(textareaEl, fieldErrors.coverNote ?? '');
    if (fieldErrors.coverNote) {
      textareaEl.focus();
      return;
    }

    isSubmitting = true;
    setButtonLoading(submitEl, true, { idleText: 'Submit application', loadingText: 'Submitting…' });
    const result = applyToJob(job.id, { coverNote: textareaEl.value });
    if (result.ok) {
      modal.close();
      onApplied(result.data);
      return;
    }

    // Failure: keep the modal and the typed text so the student can retry.
    isSubmitting = false;
    setButtonLoading(submitEl, false, { idleText: 'Submit application', loadingText: 'Submitting…' });
    if (result.fieldErrors?.coverNote) {
      setFieldError(textareaEl, result.fieldErrors.coverNote);
      textareaEl.focus();
    } else {
      showAlert(result.error);
      alertEl.focus();
    }
    if ([APPLY_ERRORS.ALREADY_APPLIED, APPLY_ERRORS.JOB_EXPIRED, APPLY_ERRORS.NOT_ELIGIBLE,
      APPLY_ERRORS.JOB_NOT_FOUND].includes(result.code)) {
      submitEl.disabled = true; // retrying cannot succeed; the page will refresh its state
      onApplied(null);
    }
  }

  textareaEl.addEventListener('input', () => {
    formEl.querySelector('[data-char-count]').textContent = `${textareaEl.value.trim().length} / ${COVER_NOTE_MAX_LENGTH}`;
    if (textareaEl.hasAttribute('aria-invalid')) {
      setFieldError(textareaEl, validateApplicationForm({ coverNote: textareaEl.value }).coverNote ?? '');
    }
  });
  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    handleSubmit();
  });

  modal = openModal({
    title: 'Apply for this job',
    content: formEl,
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      { label: 'Submit application', variant: 'primary', onClick: handleSubmit, closeOnClick: false },
    ],
  });
  modal.element.querySelector('.modal__footer .btn--primary').dataset.action = 'submit-application';
  textareaEl.focus();
}

/* ---------- Page ---------- */

function renderJob(job, student) {
  const application = getApplyStatus(student, job).application ?? null;
  const isExpired = isJobExpired(job);
  document.title = `${job.title} · FreshHire`;

  // Order: header → apply panel → content, so on phones "Apply" sits right under the job summary;
  // from 1024px the grid moves the panel into a side column (student.css).
  const layoutEl = createElement('div', 'job-details');
  const headerEl = createHeader(job, { isExpired, application });
  headerEl.classList.add('job-details__header-area');
  const mainEl = createElement('div', 'job-details__main');
  mainEl.append(
    createDescription(job),
    createResponsibilities(job),
    createSkills(job, student),
    createEligibility(job, student),
  );

  const asideEl = createElement('aside', 'job-details__aside');
  const panelEl = createElement('section', 'card apply-panel');
  panelEl.setAttribute('aria-labelledby', 'apply-title');
  panelEl.dataset.applyPanel = '';
  renderApplyPanel(panelEl, job, student);
  asideEl.append(panelEl);

  layoutEl.append(headerEl, asideEl, mainEl);
  containerEl.replaceChildren(layoutEl);

  bindSaveButtons(panelEl);
  panelEl.addEventListener('click', (event) => {
    const applyEl = event.target.closest('[data-action="apply"]');
    if (!applyEl) return;
    applyEl.focus(); // some browsers don't focus buttons on click; the modal returns focus here
    openApplyModal(job, student, (application) => {
      renderJob(job, student); // refresh badges + panel from storage
      const freshPanelEl = containerEl.querySelector('[data-apply-panel]');
      if (application) {
        showToast(`Application submitted for ${job.title}.`, { type: 'success' });
        freshPanelEl.querySelector('#apply-title').focus();
      }
    });
  });
}

async function init() {
  const student = await initProtectedPage(ROLES.STUDENT);
  if (!student) return;
  renderIconsBefore();

  try {
    const job = getVisibleJob(getQueryParam('id')); // the job comes from the URL; the student never does
    if (job) renderJob(job, student);
    else renderNotFound();
  } catch (error) {
    console.error('job-details: could not render the job', error);
    renderNotFound();
  }
}

init();
