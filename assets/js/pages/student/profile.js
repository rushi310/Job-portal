/**
 * profile.js — Student "Profile & Resume" page (Phase 7).
 * Tabs: Personal, Education, Skills, Projects & Links, Resume. Each tab saves its own section through
 * profile-service.js, which always edits the logged-in student from the session. Completeness uses the
 * same calculation as the dashboard (user-service.getProfileCompleteness).
 */

import {
  ROLES, DEGREE_OPTIONS, GRADUATION_YEAR_OPTIONS, PROFILE_LIMITS, PROFILE_LINK_FIELDS,
} from '../../core/config.js';
import { formatDate, getInitials } from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { setFieldError, setButtonLoading } from '../../components/form-field.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { initTabs } from '../../components/tabs.js';
import { updateNavbarUser } from '../../components/navbar.js';
import { createResumeSheet } from '../../components/resume-sheet.js';
import { getProfileCompleteness } from '../../services/user-service.js';
import {
  PROFILE_SECTIONS, PROFILE_ERRORS, validateProfileField, validateNewSkill, updateProfileSection,
  validateResumeFile, uploadResume, removeResume, getResumeInfo, getOwnResumeFile, formatFileSize,
} from '../../services/profile-service.js';

const $ = (selector, root = document) => root.querySelector(selector);

let currentUser = null;
let skills = [];
let tabs = null;
let entryCounter = 0; // keeps generated input ids unique

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const formOf = (section) => $(`[data-profile-form="${section}"]`);

/* ==========================================================================
   Summary & completeness
   ========================================================================== */

/** Which tab completes each missing completeness item (labels from user-service.js). */
const MISSING_ITEM_TABS = {
  'Full name': 'personal',
  Email: 'personal',
  Phone: 'personal',
  Location: 'personal',
  'About you': 'personal',
  College: 'education',
  Degree: 'education',
  Branch: 'education',
  'Graduation year': 'education',
  CGPA: 'education',
  Education: 'education',
  Skills: 'skills',
  Projects: 'projects',
  'Profile links': 'projects',
  Resume: 'resume',
};

function createDetail(term, value) {
  const itemEl = createElement('div', 'profile-summary__item');
  itemEl.append(createElement('dt', '', term), createElement('dd', '', value || 'Not added'));
  return itemEl;
}

function renderSummary() {
  const { profile = {} } = currentUser;
  const headEl = createElement('div', 'profile-summary__head');
  const avatarEl = createElement('span', 'avatar avatar--lg', getInitials(currentUser.name));
  avatarEl.setAttribute('aria-hidden', 'true');
  const textEl = createElement('div');
  textEl.append(
    createElement('p', 'profile-summary__name', currentUser.name),
    createElement('p', 'profile-summary__meta', [profile.degree, profile.branch].filter(Boolean).join(', ')),
  );
  headEl.append(avatarEl, textEl);

  const detailsEl = createElement('dl', 'profile-summary__details');
  detailsEl.append(
    createDetail('Email', currentUser.email),
    createDetail('Phone', currentUser.phone),
    createDetail('Location', profile.location),
    createDetail('College', profile.college),
  );
  $('[data-profile-summary]').replaceChildren(headEl, detailsEl);
}

function renderCompleteness() {
  const completeness = getProfileCompleteness(currentUser);
  $('[data-completeness-value]').textContent = `${completeness.percent}%`;

  const progressEl = createElement('div', 'progress');
  progressEl.setAttribute('role', 'progressbar');
  progressEl.setAttribute('aria-labelledby', 'completeness-title');
  progressEl.setAttribute('aria-valuemin', '0');
  progressEl.setAttribute('aria-valuemax', '100');
  progressEl.setAttribute('aria-valuenow', String(completeness.percent));
  const barEl = createElement('div', 'progress__bar');
  barEl.style.width = `${completeness.percent}%`; // dynamic value; CSS holds all static styling
  progressEl.append(barEl);

  if (completeness.missing.length === 0) {
    $('[data-completeness]').replaceChildren(progressEl,
      createElement('p', 'profile-meter__hint', 'Your profile is complete. Great work!'));
    return;
  }
  const hintEl = createElement('p', 'profile-meter__hint', 'Still to add:');
  const listEl = createElement('ul', 'chip-list');
  completeness.missing.forEach((label) => {
    const buttonEl = createElement('button', 'chip missing-item', label);
    buttonEl.type = 'button';
    buttonEl.dataset.missingTab = MISSING_ITEM_TABS[label] ?? 'personal';
    buttonEl.setAttribute('aria-label', `Add ${label.toLowerCase()}`);
    const itemEl = createElement('li');
    itemEl.append(buttonEl);
    listEl.append(itemEl);
  });
  $('[data-completeness]').replaceChildren(progressEl, hintEl, listEl);
}

/* ==========================================================================
   Field helpers
   ========================================================================== */

/** Validation rule for an input: repeated entries use "section.field" (data-rule), others their name. */
const ruleOf = (inputEl) => inputEl.dataset.rule ?? inputEl.name;

function validateInput(inputEl) {
  const message = validateProfileField(ruleOf(inputEl), inputEl.value);
  setFieldError(inputEl, message);
  return message;
}

/**
 * Build a labelled form group. `rule` is used for "section.field" entry inputs.
 * @returns {HTMLElement}
 */
function createField({
  id, name, rule, label, value = '', required = false, type = 'text', maxLength, placeholder, multiline = false,
  inputMode, wide = false,
}) {
  const groupEl = createElement('div', wide ? 'form-group profile-entry__wide' : 'form-group');
  const labelEl = createElement('label', 'form-label', label);
  labelEl.htmlFor = id;
  if (required) {
    const starEl = createElement('span', 'form-label__required', ' *');
    starEl.setAttribute('aria-hidden', 'true');
    labelEl.append(starEl);
  }
  const controlEl = createElement(multiline ? 'textarea' : 'input', 'form-control');
  controlEl.id = id;
  controlEl.name = name;
  if (!multiline) controlEl.type = type;
  if (multiline) controlEl.rows = 3;
  if (rule) controlEl.dataset.rule = rule;
  if (maxLength) controlEl.maxLength = maxLength;
  if (placeholder) controlEl.placeholder = placeholder;
  if (inputMode) controlEl.inputMode = inputMode;
  if (required) controlEl.required = true;
  controlEl.value = value ?? '';
  const errorEl = createElement('p', 'form-error');
  errorEl.id = `${id}-error`;
  errorEl.hidden = true;
  controlEl.setAttribute('aria-describedby', errorEl.id);
  groupEl.append(labelEl, controlEl, errorEl);
  return groupEl;
}

function showFormAlert(formEl, message) {
  const alertEl = $('[data-form-alert]', formEl);
  alertEl.textContent = message;
  alertEl.hidden = false;
}

function hideFormAlert(formEl) {
  const alertEl = $('[data-form-alert]', formEl);
  alertEl.hidden = true;
  alertEl.textContent = '';
}

function clearFieldErrors(formEl) {
  formEl.querySelectorAll('.form-control[aria-invalid]').forEach((inputEl) => setFieldError(inputEl, ''));
}

/** Show a field → message map; messages without a matching input go to the form alert. Focus the first problem. */
function showFieldErrors(formEl, fieldErrors) {
  clearFieldErrors(formEl);
  const unmatched = [];
  Object.entries(fieldErrors).forEach(([field, message]) => {
    const inputEl = formEl.querySelector(`[name="${CSS.escape(field)}"]`);
    if (inputEl) setFieldError(inputEl, message);
    else unmatched.push(message);
  });
  if (unmatched.length) showFormAlert(formEl, unmatched.join(' '));
  else showFormAlert(formEl, 'Please correct the highlighted fields.');

  const firstInvalid = formEl.querySelector('.form-control[aria-invalid="true"]');
  if (firstInvalid && !unmatched.length) firstInvalid.focus();
  else $('[data-form-alert]', formEl).focus();
}

/** Blur / input validation, delegated so it also covers entries added later. */
function bindFieldValidation(formEl) {
  const isChecked = (el) => el.classList?.contains('form-control') && !el.readOnly && el.name !== 'newSkill';
  formEl.addEventListener('focusout', (event) => {
    if (isChecked(event.target) && event.target.value) validateInput(event.target);
  });
  const recheck = (event) => {
    if (isChecked(event.target) && event.target.hasAttribute('aria-invalid')) validateInput(event.target);
  };
  formEl.addEventListener('input', recheck);
  formEl.addEventListener('change', recheck);
}

/* ==========================================================================
   Repeated entries (education, projects)
   ========================================================================== */

const ENTRY_TYPES = {
  education: {
    noun: 'Education',
    max: PROFILE_LIMITS.MAX_EDUCATION,
    fields: [
      { name: 'level', label: 'Level', required: true, maxLength: PROFILE_LIMITS.LEVEL, placeholder: 'e.g. HSC' },
      { name: 'institute', label: 'School / institute', required: true, maxLength: PROFILE_LIMITS.SHORT_TEXT },
      { name: 'year', label: 'Year of passing', required: true, inputMode: 'numeric', maxLength: 4 },
      { name: 'score', label: 'Score', maxLength: PROFILE_LIMITS.SCORE, placeholder: 'e.g. 86%' },
    ],
  },
  projects: {
    noun: 'Project',
    max: PROFILE_LIMITS.MAX_PROJECTS,
    fields: [
      { name: 'title', label: 'Project title', required: true, maxLength: PROFILE_LIMITS.SHORT_TEXT },
      { name: 'link', label: 'Project link', type: 'url', placeholder: 'https://', inputMode: 'url' },
      {
        name: 'description', label: 'Description', multiline: true, wide: true,
        maxLength: PROFILE_LIMITS.PROJECT_DESCRIPTION,
      },
    ],
  },
};

const entryListOf = (section) => $(`[data-entry-list="${section}"]`);
const entryEls = (section) => [...entryListOf(section).querySelectorAll('[data-entry]')];

function createEntry(section, entry = {}) {
  const type = ENTRY_TYPES[section];
  entryCounter += 1;
  const entryEl = createElement('fieldset', 'profile-entry');
  entryEl.dataset.entry = '';
  const legendEl = createElement('legend', 'profile-entry__legend');
  const gridEl = createElement('div', 'profile-entry__grid');
  type.fields.forEach((field) => {
    const groupEl = createField({
      ...field,
      id: `pf-${section}-${entryCounter}-${field.name}`,
      name: field.name, // renamed to "section.index.field" by renumberEntries()
      rule: `${section}.${field.name}`,
      value: entry[field.name] ?? '',
    });
    groupEl.querySelector('.form-control').dataset.field = field.name;
    gridEl.append(groupEl);
  });
  const removeEl = createElement('button', 'btn btn--ghost btn--sm profile-entry__remove', 'Remove');
  removeEl.type = 'button';
  removeEl.dataset.removeEntry = section;
  entryEl.append(legendEl, gridEl, removeEl);
  return entryEl;
}

/** Keep legends, input names ("education.0.level") and the Add button in step with the list. */
function renumberEntries(section) {
  const type = ENTRY_TYPES[section];
  const els = entryEls(section);
  els.forEach((entryEl, index) => {
    const title = `${type.noun} ${index + 1}`;
    $('.profile-entry__legend', entryEl).textContent = title;
    $('[data-remove-entry]', entryEl).setAttribute('aria-label', `Remove ${title.toLowerCase()}`);
    entryEl.querySelectorAll('[data-field]').forEach((inputEl) => {
      inputEl.name = `${section}.${index}.${inputEl.dataset.field}`;
    });
  });
  const addEl = $(`[data-add-entry="${section}"]`);
  addEl.disabled = els.length >= type.max;
  addEl.title = addEl.disabled ? `You can add up to ${type.max} entries.` : '';
}

function renderEntries(section, entries) {
  const list = Array.isArray(entries) ? entries : [];
  entryListOf(section).replaceChildren(...list.map((entry) => createEntry(section, entry)));
  renumberEntries(section);
}

function readEntries(section) {
  return entryEls(section).map((entryEl) => Object.fromEntries(
    [...entryEl.querySelectorAll('[data-field]')].map((inputEl) => [inputEl.dataset.field, inputEl.value]),
  ));
}

function addEntry(section) {
  if (entryEls(section).length >= ENTRY_TYPES[section].max) return;
  const entryEl = createEntry(section);
  entryListOf(section).append(entryEl);
  renumberEntries(section);
  $('.form-control', entryEl).focus();
}

function removeEntry(buttonEl) {
  const section = buttonEl.dataset.removeEntry;
  buttonEl.closest('[data-entry]').remove();
  renumberEntries(section);
  $(`[data-add-entry="${section}"]`).focus();
}

/* ==========================================================================
   Skills
   ========================================================================== */

function renderSkills() {
  const listEl = $('[data-skill-list]');
  if (skills.length === 0) {
    listEl.replaceChildren(createElement('li', 'skill-list__empty', 'No skills added yet.'));
    return;
  }
  listEl.replaceChildren(...skills.map((skill, index) => {
    const itemEl = createElement('li', 'chip skill-chip');
    const removeEl = createElement('button', 'skill-chip__remove', '×');
    removeEl.type = 'button';
    removeEl.dataset.removeSkill = String(index);
    removeEl.setAttribute('aria-label', `Remove ${skill}`);
    itemEl.append(createElement('span', '', skill), removeEl);
    return itemEl;
  }));
}

function announceSkills(message) {
  $('[data-skill-status]').textContent = message;
}

function addSkill() {
  const inputEl = formOf(PROFILE_SECTIONS.SKILLS).elements.newSkill;
  const message = validateNewSkill(inputEl.value, skills);
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
  announceSkills(`Added ${skill}. Select Save changes to keep your skills.`);
}

function removeSkill(index) {
  const [removed] = skills.splice(index, 1);
  renderSkills();
  const buttons = [...document.querySelectorAll('[data-remove-skill]')];
  const nextEl = buttons[Math.min(index, buttons.length - 1)] ?? formOf(PROFILE_SECTIONS.SKILLS).elements.newSkill;
  nextEl.focus();
  announceSkills(`Removed ${removed}. Select Save changes to keep your skills.`);
}

/* ==========================================================================
   Filling the forms from the saved profile
   ========================================================================== */

function fillSelect(selectEl, options, placeholder, value) {
  const placeholderEl = createElement('option', '', placeholder);
  placeholderEl.value = '';
  selectEl.replaceChildren(placeholderEl, ...options.map((option) => {
    const optionEl = createElement('option', '', String(option));
    optionEl.value = String(option);
    return optionEl;
  }));
  selectEl.value = options.map(String).includes(String(value)) ? String(value) : '';
}

const FILLERS = {
  [PROFILE_SECTIONS.PERSONAL]: (formEl, user) => {
    const { elements } = formEl;
    elements.name.value = user.name ?? '';
    elements.email.value = user.email ?? '';
    elements.phone.value = user.phone ?? '';
    elements.location.value = user.profile?.location ?? '';
    elements.about.value = user.profile?.about ?? '';
  },
  [PROFILE_SECTIONS.EDUCATION]: (formEl, user) => {
    const profile = user.profile ?? {};
    const { elements } = formEl;
    elements.college.value = profile.college ?? '';
    fillSelect(elements.degree, DEGREE_OPTIONS, 'Select degree', profile.degree);
    elements.branch.value = profile.branch ?? '';
    fillSelect(elements.graduationYear, GRADUATION_YEAR_OPTIONS, 'Select year', profile.graduationYear);
    elements.cgpa.value = Number.isFinite(profile.cgpa) ? String(profile.cgpa) : '';
    renderEntries('education', profile.education);
  },
  [PROFILE_SECTIONS.SKILLS]: (formEl, user) => {
    skills = Array.isArray(user.profile?.skills) ? user.profile.skills.map(String) : [];
    formEl.elements.newSkill.value = '';
    renderSkills();
  },
  [PROFILE_SECTIONS.PROJECTS]: (formEl, user) => {
    const profile = user.profile ?? {};
    renderEntries('projects', profile.projects);
    PROFILE_LINK_FIELDS.forEach(({ name }) => {
      formEl.elements[`links.${name}`].value = profile.links?.[name] ?? '';
    });
  },
};

function renderLinkFields() {
  $('[data-link-fields]').replaceChildren(...PROFILE_LINK_FIELDS.map(({ name, label }) => createField({
    id: `pf-link-${name}`, name: `links.${name}`, label, type: 'url', inputMode: 'url', placeholder: 'https://',
  })));
}

const VALUE_READERS = {
  [PROFILE_SECTIONS.PERSONAL]: ({ elements }) => ({
    name: elements.name.value,
    phone: elements.phone.value,
    location: elements.location.value,
    about: elements.about.value,
  }),
  [PROFILE_SECTIONS.EDUCATION]: ({ elements }) => ({
    college: elements.college.value,
    degree: elements.degree.value,
    branch: elements.branch.value,
    graduationYear: elements.graduationYear.value,
    cgpa: elements.cgpa.value,
    education: readEntries('education'),
  }),
  [PROFILE_SECTIONS.SKILLS]: () => ({ skills }),
  [PROFILE_SECTIONS.PROJECTS]: ({ elements }) => ({
    projects: readEntries('projects'),
    links: Object.fromEntries(PROFILE_LINK_FIELDS.map(({ name }) => [name, elements[`links.${name}`].value])),
  }),
};

/* ==========================================================================
   Saving
   ========================================================================== */

const SAVED_MESSAGES = {
  [PROFILE_SECTIONS.PERSONAL]: 'Personal details saved.',
  [PROFILE_SECTIONS.EDUCATION]: 'Education saved.',
  [PROFILE_SECTIONS.SKILLS]: 'Skills saved.',
  [PROFILE_SECTIONS.PROJECTS]: 'Projects and links saved.',
};

/** After any successful save: remember the new data and refresh everything built from it. */
function applyUpdatedUser(user) {
  const nameChanged = user.name !== currentUser.name;
  currentUser = user;
  renderSummary();
  renderCompleteness();
  renderResume();
  if (nameChanged) updateNavbarUser(user);
}

function handleSectionSubmit(event) {
  event.preventDefault();
  const formEl = event.currentTarget;
  const section = formEl.dataset.profileForm;
  const submitEl = $('button[type="submit"]', formEl);
  if (submitEl.disabled) return; // a save is already running

  hideFormAlert(formEl);
  setButtonLoading(submitEl, true, { idleText: 'Save changes', loadingText: 'Saving…' });
  const result = updateProfileSection(section, VALUE_READERS[section](formEl));
  setButtonLoading(submitEl, false, { idleText: 'Save changes', loadingText: 'Saving…' });

  if (!result.ok) {
    if (result.fieldErrors) {
      showFieldErrors(formEl, result.fieldErrors);
    } else {
      showFormAlert(formEl, result.error);
      $('[data-form-alert]', formEl).focus();
    }
    return;
  }
  clearFieldErrors(formEl);
  applyUpdatedUser(result.data);
  FILLERS[section](formEl, result.data); // show the saved (trimmed) values
  showToast(SAVED_MESSAGES[section], { type: 'success' });
}

/* ==========================================================================
   Resume
   ========================================================================== */

function createResumeActionButton(label, action, variant = 'btn--outline') {
  const buttonEl = createElement('button', `btn ${variant} btn--sm`, label);
  buttonEl.type = 'button';
  buttonEl.dataset.resumeAction = action;
  return buttonEl;
}

function renderResumeCurrent(info) {
  const currentEl = $('[data-resume-current]');
  if (!info) {
    currentEl.replaceChildren(createElement('p', 'profile-resume__empty',
      'No resume uploaded yet. You can still apply for jobs without one.'));
    return;
  }
  const actionsEl = createElement('div', 'profile-resume__actions');
  if (info.isCorrupted) {
    const alertEl = createElement('p', 'alert alert--warning',
      `Your saved resume "${info.fileName}" is damaged and cannot be opened. Upload it again or remove it.`);
    actionsEl.append(createResumeActionButton('Remove', 'remove', 'btn--danger'));
    currentEl.replaceChildren(alertEl, actionsEl);
    return;
  }
  const detailsEl = createElement('dl', 'resume-file');
  [
    ['File name', info.fileName],
    ['Type', info.fileType],
    ['Size', formatFileSize(info.sizeBytes)],
    ['Uploaded', info.uploadedAt ? formatDate(info.uploadedAt) : 'Unknown'],
  ].forEach(([term, value]) => {
    const itemEl = createElement('div', 'resume-file__item');
    itemEl.append(createElement('dt', '', term), createElement('dd', '', value));
    detailsEl.append(itemEl);
  });
  actionsEl.append(
    createResumeActionButton('View', 'view'),
    createResumeActionButton('Download', 'download'),
    createResumeActionButton('Remove', 'remove', 'btn--danger'),
  );
  currentEl.replaceChildren(detailsEl, actionsEl);
}

function renderResume() {
  const info = getResumeInfo(currentUser);
  renderResumeCurrent(info);
  $('[data-resume-file-label]').textContent = info ? 'Choose a new PDF to replace your resume' : 'Choose a PDF file';
  $('[data-resume-submit]').textContent = info ? 'Replace resume' : 'Upload resume';

  $('[data-resume-preview]').replaceChildren(createResumeSheet(currentUser, { headingLevel: 4 }));
  $('[data-resume-print]').replaceChildren(createResumeSheet(currentUser, { headingLevel: 1 }));
}

async function handleResumeSubmit(event) {
  event.preventDefault();
  const formEl = event.currentTarget;
  const inputEl = formEl.elements.resumeFile;
  const submitEl = $('[data-resume-submit]');
  if (submitEl.disabled) return;

  const file = inputEl.files[0] ?? null;
  const message = validateResumeFile(file);
  setFieldError(inputEl, message);
  if (message) {
    inputEl.focus();
    return;
  }

  const hadResume = Boolean(currentUser.profile?.resume);
  const idleText = submitEl.textContent;
  setButtonLoading(submitEl, true, { idleText, loadingText: 'Uploading…' });
  const result = await uploadResume(file);
  setButtonLoading(submitEl, false, { idleText, loadingText: 'Uploading…' });

  if (!result.ok) {
    // The previous resume is untouched; the student can fix the problem and try again.
    setFieldError(inputEl, result.error);
    inputEl.focus();
    if (result.code !== PROFILE_ERRORS.INVALID_FILE) showToast(result.error, { type: 'error' });
    return;
  }
  inputEl.value = '';
  applyUpdatedUser(result.data);
  showToast(hadResume ? 'Resume replaced.' : 'Resume uploaded.', { type: 'success' });
  $('#resume-upload-title').focus();
}

/** Open or download the student's own PDF from a temporary in-browser (blob:) URL. */
function openResumeFile({ download }) {
  const result = getOwnResumeFile();
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

async function handleRemoveResume() {
  const info = getResumeInfo(currentUser);
  const confirmed = await confirmDialog({
    title: 'Remove resume?',
    message: `"${info?.fileName ?? 'Your resume'}" will be deleted from this browser. Applications you already sent keep their record of it.`,
    confirmLabel: 'Remove resume',
  });
  if (!confirmed) return;

  const result = removeResume();
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    return;
  }
  applyUpdatedUser(result.data);
  showToast('Resume removed.', { type: 'success' });
  $('#pf-resume-file').focus();
}

/* ==========================================================================
   Events & start-up
   ========================================================================== */

function bindEvents() {
  document.querySelectorAll('[data-profile-form]').forEach((formEl) => {
    formEl.addEventListener('submit', handleSectionSubmit);
    bindFieldValidation(formEl);
  });

  document.querySelectorAll('[data-add-entry]').forEach((buttonEl) => {
    buttonEl.addEventListener('click', () => addEntry(buttonEl.dataset.addEntry));
  });
  $('.profile-tabs').addEventListener('click', (event) => {
    const removeEntryEl = event.target.closest('[data-remove-entry]');
    if (removeEntryEl) removeEntry(removeEntryEl);
    const removeSkillEl = event.target.closest('[data-remove-skill]');
    if (removeSkillEl) removeSkill(Number(removeSkillEl.dataset.removeSkill));
  });

  const skillsFormEl = formOf(PROFILE_SECTIONS.SKILLS);
  $('[data-add-skill]').addEventListener('click', addSkill);
  skillsFormEl.elements.newSkill.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Enter adds the skill instead of saving the form
      addSkill();
    }
  });
  skillsFormEl.elements.newSkill.addEventListener('input', (event) => setFieldError(event.target, ''));

  $('[data-resume-form]').addEventListener('submit', handleResumeSubmit);
  $('[data-resume-form]').elements.resumeFile.addEventListener('change', (event) => {
    // Check the chosen file straight away; nothing is saved until Upload / Replace is selected.
    const file = event.target.files[0];
    setFieldError(event.target, file ? validateResumeFile(file) : '');
  });
  $('[data-resume-current]').addEventListener('click', (event) => {
    const action = event.target.closest('[data-resume-action]')?.dataset.resumeAction;
    if (action === 'view') openResumeFile({ download: false });
    if (action === 'download') openResumeFile({ download: true });
    if (action === 'remove') handleRemoveResume();
  });
  $('[data-print-resume]').addEventListener('click', () => window.print());

  $('[data-completeness]').addEventListener('click', (event) => {
    const tabId = event.target.closest('[data-missing-tab]')?.dataset.missingTab;
    if (tabId) tabs.select(tabId, { focus: true });
  });
}

async function init() {
  const user = await initProtectedPage(ROLES.STUDENT);
  if (!user) return;
  currentUser = user;

  renderLinkFields();
  Object.entries(FILLERS).forEach(([section, fill]) => fill(formOf(section), currentUser));
  renderSummary();
  renderCompleteness();
  renderResume();
  bindEvents();
  tabs = initTabs($('[data-profile-tabs]'));
}

init();
