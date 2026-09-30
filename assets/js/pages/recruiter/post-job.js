/**
 * post-job.js — Recruiter "Post a Job" / "Edit Job" page (Phase 8).
 * Create: only `active` recruiters (BR-07); the job is saved as `pending` (BR-08).
 * Edit (?id=<jobId>): only the recruiter's own pending or approved job; changing core fields of an
 * approved job sends it back to `pending` (BR-11). Owner, company and status always come from
 * job-service, never from the form or URL. A preview is shown before anything is saved (UI_SPEC §5).
 */

import {
  ROLES, PAGE_PATHS, JOB_TYPES, WORK_MODES, SALARY_PERIODS, DEGREE_OPTIONS, GRADUATION_YEAR_OPTIONS,
  JOB_STATUS,
} from '../../core/config.js';
import {
  toRoot, getLabel, getQueryParam, formatDate, formatSalary,
} from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { setFieldError, setButtonLoading } from '../../components/form-field.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { createEmptyState } from '../../components/empty-state.js';
import { renderApprovalBanner } from '../../components/approval-banner.js';
import { setFlash } from '../../core/storage.js';
import {
  JOB_FORM_FIELDS, validateJobField, validateJobForm, validateJobSkill, createJob, updateJob,
  getOwnJob, canEditJob, isActiveRecruiter,
} from '../../services/job-service.js';

const $ = (selector, root = document) => root.querySelector(selector);

let formEl = null;
let editingJob = null;
let skills = [];

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Today as YYYY-MM-DD in local time (min value for the deadline picker). */
function todayIso() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/* ---------- Building the form ---------- */

function fillSelect(selectEl, values, placeholder) {
  const placeholderEl = createElement('option', '', placeholder);
  placeholderEl.value = '';
  selectEl.replaceChildren(placeholderEl, ...values.map((value) => {
    const optionEl = createElement('option', '', value === SALARY_PERIODS.MONTH ? 'Per month'
      : value === SALARY_PERIODS.YEAR ? 'Per year' : getLabel(value));
    optionEl.value = value;
    return optionEl;
  }));
}

function createCheckboxes(containerEl, name, values, errorId) {
  containerEl.replaceChildren(...values.map((value) => {
    const labelEl = createElement('label', 'choice');
    const inputEl = createElement('input');
    inputEl.type = 'checkbox';
    inputEl.name = name;
    inputEl.value = String(value);
    inputEl.setAttribute('aria-describedby', errorId);
    labelEl.append(inputEl, createElement('span', '', String(value)));
    return labelEl;
  }));
}

function buildForm(job) {
  const { elements } = formEl;
  fillSelect(elements.jobType, Object.values(JOB_TYPES), 'Select type');
  fillSelect(elements.workMode, Object.values(WORK_MODES), 'Select mode');
  fillSelect(elements.salaryPeriod, Object.values(SALARY_PERIODS), 'Select');
  elements.deadline.min = todayIso();
  createCheckboxes($('[data-degree-options]'), 'degrees', DEGREE_OPTIONS, 'pj-degrees-error');
  // Offer the usual years plus any year already on the job being edited.
  const years = [...new Set([...GRADUATION_YEAR_OPTIONS, ...(job?.eligibility?.graduationYears ?? [])])]
    .map(Number).sort((a, b) => a - b);
  createCheckboxes($('[data-year-options]'), 'graduationYears', years, 'pj-graduation-years-error');
}

function fillForm(job, recruiter) {
  const { elements } = formEl;
  elements.company.value = job?.companyName ?? recruiter.profile?.companyName ?? '';
  if (!job) {
    elements.salaryPeriod.value = SALARY_PERIODS.YEAR;
    return;
  }
  ['title', 'location', 'jobType', 'workMode', 'salaryPeriod', 'experience', 'description', 'deadline'].forEach((field) => {
    elements[field].value = job[field] ?? '';
  });
  elements.openings.value = String(job.openings ?? '');
  elements.salaryMin.value = job.salaryMin ? String(job.salaryMin) : '';
  elements.salaryMax.value = job.salaryMax ? String(job.salaryMax) : '';
  elements.responsibilities.value = (job.responsibilities ?? []).join('\n');
  const eligibility = job.eligibility ?? {};
  formEl.querySelectorAll('input[name="degrees"]').forEach((box) => {
    box.checked = (eligibility.degrees ?? []).includes(box.value);
  });
  formEl.querySelectorAll('input[name="graduationYears"]').forEach((box) => {
    box.checked = (eligibility.graduationYears ?? []).map(String).includes(box.value);
  });
  elements.minCgpa.value = Number.isFinite(eligibility.minCgpa) ? String(eligibility.minCgpa) : '';
  skills = Array.isArray(job.skills) ? job.skills.map(String) : [];
}

/* ---------- Values & errors ---------- */

const checkedValues = (name) => [...formEl.querySelectorAll(`input[name="${name}"]:checked`)].map((box) => box.value);

function readValues() {
  const { elements } = formEl;
  return {
    title: elements.title.value,
    location: elements.location.value,
    jobType: elements.jobType.value,
    workMode: elements.workMode.value,
    experience: elements.experience.value,
    openings: elements.openings.value,
    deadline: elements.deadline.value,
    salaryPeriod: elements.salaryPeriod.value,
    salaryMin: elements.salaryMin.value,
    salaryMax: elements.salaryMax.value,
    description: elements.description.value,
    responsibilities: elements.responsibilities.value.split('\n'),
    skills: [...skills],
    degrees: checkedValues('degrees'),
    graduationYears: checkedValues('graduationYears').map(Number),
    minCgpa: elements.minCgpa.value,
  };
}

/** The element that shows each field's error (checkbox groups use their first box, skills its input). */
function inputFor(field) {
  if (field === 'skills') return formEl.elements.newSkill;
  if (field === 'degrees' || field === 'graduationYears') return formEl.querySelector(`input[name="${field}"]`);
  return formEl.elements[field];
}

function validateInput(field) {
  const inputEl = inputFor(field);
  const message = validateJobField(field, readValues());
  if (inputEl) setFieldError(inputEl, message);
  return message;
}

function showAlert(message) {
  const alertEl = $('[data-form-alert]', formEl);
  alertEl.textContent = message;
  alertEl.hidden = !message;
}

function showFieldErrors(fieldErrors) {
  JOB_FORM_FIELDS.forEach((field) => {
    const inputEl = inputFor(field);
    if (inputEl) setFieldError(inputEl, fieldErrors[field] ?? '');
  });
  showAlert('Please correct the highlighted fields.');
  const firstField = JOB_FORM_FIELDS.find((field) => fieldErrors[field]);
  inputFor(firstField)?.focus();
}

/* ---------- Skills chip input ---------- */

function renderSkills() {
  const listEl = $('[data-skill-list]');
  if (skills.length === 0) {
    listEl.replaceChildren(createElement('li', 'chip-list__empty', 'No skills added yet.'));
    return;
  }
  listEl.replaceChildren(...skills.map((skill, index) => {
    const itemEl = createElement('li', 'chip chip--removable');
    const removeEl = createElement('button', 'chip__remove', '×');
    removeEl.type = 'button';
    removeEl.dataset.removeSkill = String(index);
    removeEl.setAttribute('aria-label', `Remove ${skill}`);
    itemEl.append(createElement('span', '', skill), removeEl);
    return itemEl;
  }));
}

function addSkill() {
  const inputEl = formEl.elements.newSkill;
  const message = validateJobSkill(inputEl.value, skills);
  setFieldError(inputEl, message);
  if (message) {
    inputEl.focus();
    return;
  }
  const skill = inputEl.value.trim();
  skills = [...skills, skill];
  renderSkills();
  inputEl.value = '';
  inputEl.focus();
  $('[data-skill-status]').textContent = `Added ${skill}.`;
}

function removeSkill(index) {
  const [removed] = skills.splice(index, 1);
  renderSkills();
  const buttons = [...formEl.querySelectorAll('[data-remove-skill]')];
  (buttons[Math.min(index, buttons.length - 1)] ?? formEl.elements.newSkill).focus();
  $('[data-skill-status]').textContent = `Removed ${removed}.`;
}

/* ---------- Preview & save ---------- */

function addDetail(listEl, term, value) {
  const itemEl = createElement('div', 'detail-list__item');
  itemEl.append(createElement('dt', '', term), createElement('dd', '', value));
  listEl.append(itemEl);
}

/** A read-only preview of what students will see (all text via textContent). */
function createPreview(values) {
  const previewEl = createElement('div', 'job-preview');
  const salaryMin = Number(values.salaryMin) || 0;
  const pay = formatSalary({
    salaryMin, salaryMax: Number(values.salaryMax) || salaryMin, salaryPeriod: values.salaryPeriod,
  });
  previewEl.append(
    createElement('p', 'job-preview__title', values.title.trim()),
    createElement('p', 'job-preview__meta', `${formEl.elements.company.value} · ${values.location.trim()}`),
  );
  const detailsEl = createElement('dl', 'detail-list');
  addDetail(detailsEl, 'Type', `${getLabel(values.jobType)} · ${getLabel(values.workMode)}`);
  addDetail(detailsEl, 'Pay', pay);
  addDetail(detailsEl, 'Experience', values.experience.trim());
  addDetail(detailsEl, 'Openings', String(Number(values.openings)));
  addDetail(detailsEl, 'Apply by', formatDate(values.deadline));
  addDetail(detailsEl, 'Degrees', values.degrees.length ? values.degrees.join(', ') : 'Any');
  addDetail(detailsEl, 'Graduation years', values.graduationYears.length ? values.graduationYears.join(', ') : 'Any');
  addDetail(detailsEl, 'Minimum CGPA', values.minCgpa.trim() ? values.minCgpa.trim() : 'None');
  previewEl.append(detailsEl);

  const chipsEl = createElement('ul', 'chip-list');
  chipsEl.setAttribute('aria-label', 'Skills');
  chipsEl.append(...values.skills.map((skill) => createElement('li', 'chip', skill)));
  previewEl.append(chipsEl, createElement('p', 'job-preview__text', values.description.trim()));
  const responsibilities = values.responsibilities.map((line) => line.trim()).filter(Boolean);
  if (responsibilities.length) {
    const listEl = createElement('ul', 'job-preview__list');
    listEl.append(...responsibilities.map((line) => createElement('li', '', line)));
    previewEl.append(listEl);
  }
  return previewEl;
}

function save(values) {
  const submitEl = $('[data-submit]');
  if (submitEl.disabled) return; // already saving
  setButtonLoading(submitEl, true, { idleText: 'Preview job', loadingText: 'Saving…' });
  const result = editingJob ? updateJob(editingJob.id, values) : createJob(values);
  setButtonLoading(submitEl, false, { idleText: 'Preview job', loadingText: 'Saving…' });

  if (!result.ok) {
    if (result.fieldErrors) showFieldErrors(result.fieldErrors);
    else {
      showAlert(result.error);
      $('[data-form-alert]', formEl).focus();
    }
    return;
  }
  let message = 'Job submitted. It will be visible to students once an admin approves it.';
  if (editingJob) {
    message = result.returnedToPending
      ? 'Changes saved. The job was sent back for admin approval because core details changed.'
      : 'Changes saved.';
  }
  setFlash(message, 'success');
  window.location.assign(toRoot(PAGE_PATHS.MY_JOBS));
}

function handleSubmit(event) {
  event.preventDefault();
  showAlert('');
  const values = readValues();
  const fieldErrors = validateJobForm(values);
  if (Object.keys(fieldErrors).length > 0) {
    showFieldErrors(fieldErrors);
    return;
  }
  JOB_FORM_FIELDS.forEach((field) => { const el = inputFor(field); if (el) setFieldError(el, ''); });
  openModal({
    title: editingJob ? 'Check your changes' : 'Preview your job',
    content: createPreview(values),
    actions: [
      { label: 'Back to editing', variant: 'ghost' },
      { label: editingJob ? 'Save changes' : 'Submit for approval', variant: 'primary', onClick: () => save(values) },
    ],
  });
}

/* ---------- Page states ---------- */

function showMessage({ title, message, action }) {
  $('[data-page-message]').replaceChildren(createEmptyState({
    title, message, icon: 'briefcase', action, headingLevel: 2, // shown instead of the form, under the h1
  }));
}

function bindEvents() {
  formEl.addEventListener('submit', handleSubmit);
  JOB_FORM_FIELDS.forEach((field) => {
    const inputEl = formEl.elements[field];
    if (!(inputEl instanceof HTMLElement) || field === 'skills') return;
    inputEl.addEventListener('blur', () => { if (inputEl.value) validateInput(field); });
    const recheck = () => { if (inputEl.hasAttribute('aria-invalid')) validateInput(field); };
    inputEl.addEventListener('input', recheck);
    inputEl.addEventListener('change', recheck);
  });
  // Pay rules depend on each other and on the job type.
  ['jobType', 'salaryMin', 'salaryMax', 'salaryPeriod'].forEach((field) => {
    formEl.elements[field].addEventListener('change', () => {
      ['salaryPeriod', 'salaryMin', 'salaryMax'].forEach((payField) => {
        if (formEl.elements[payField].hasAttribute('aria-invalid')) validateInput(payField);
      });
    });
  });
  formEl.addEventListener('change', (event) => {
    if (event.target.type === 'checkbox') validateInput(event.target.name);
  });
  $('[data-add-skill]').addEventListener('click', addSkill);
  formEl.elements.newSkill.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Enter adds the skill instead of submitting
      addSkill();
    }
  });
  $('[data-skill-list]').addEventListener('click', (event) => {
    const removeEl = event.target.closest('[data-remove-skill]');
    if (removeEl) removeSkill(Number(removeEl.dataset.removeSkill));
  });
}

async function init() {
  const user = await initProtectedPage(ROLES.RECRUITER);
  if (!user) return;
  formEl = $('[data-job-form]');

  if (renderApprovalBanner($('[data-approval-banner]'), user) || !isActiveRecruiter(user)) {
    showMessage({
      title: 'Job posting is not available yet',
      message: 'You can post jobs once an admin approves your recruiter account.',
      action: { label: 'Complete company profile', href: toRoot(PAGE_PATHS.COMPANY_PROFILE) },
    });
    return;
  }

  const jobId = getQueryParam('id');
  if (jobId !== null) {
    editingJob = getOwnJob(jobId); // another recruiter's job looks exactly like a missing one
    const title = editingJob ? `Edit: ${editingJob.title}` : 'Edit job';
    $('[data-page-title]').textContent = 'Edit Job';
    document.title = 'Edit Job · FreshHire';
    if (!editingJob) {
      showMessage({
        title: 'Job not found',
        message: 'This job does not exist or is not one of yours.',
        action: { label: 'Back to My Jobs', href: toRoot(PAGE_PATHS.MY_JOBS) },
      });
      return;
    }
    if (!canEditJob(editingJob)) {
      showMessage({
        title: 'This job cannot be edited',
        message: `${getLabel(editingJob.status)} jobs are final. You can still review their applicants.`,
        action: { label: 'Back to My Jobs', href: toRoot(PAGE_PATHS.MY_JOBS) },
      });
      return;
    }
    $('[data-page-subtitle]').textContent = title;
    if (editingJob.status === JOB_STATUS.APPROVED) {
      const noteEl = $('[data-edit-note]');
      noteEl.textContent = 'This job is live. Changing the title, description, eligibility or pay sends it back '
        + 'for admin approval, and it is hidden from students until approved again.';
      noteEl.hidden = false;
    }
  }

  buildForm(editingJob);
  fillForm(editingJob, user);
  renderSkills();
  bindEvents();
  formEl.hidden = false;
}

init();
