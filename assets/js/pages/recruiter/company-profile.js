/**
 * company-profile.js — Recruiter "Company Profile" page (Phase 8).
 * Edits the logged-in recruiter's contact and company details (PROJECT_SPEC §5.1 recruiter profile)
 * through profile-service.updateCompanyProfile, which takes the recruiter from the session.
 * Pending recruiters may edit this page too; it does not post anything (BR-07).
 */

import { ROLES, COMPANY_SIZE_OPTIONS } from '../../core/config.js';
import { getInitials } from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { setFieldError, setButtonLoading } from '../../components/form-field.js';
import { showToast } from '../../components/toast.js';
import { updateNavbarUser } from '../../components/navbar.js';
import { renderApprovalBanner } from '../../components/approval-banner.js';
import { isValidUrl } from '../../services/user-service.js';
import {
  COMPANY_PROFILE_FIELDS, validateCompanyField, updateCompanyProfile,
} from '../../services/profile-service.js';

const $ = (selector, root = document) => root.querySelector(selector);
let currentUser = null;
let formEl = null;

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createDetail(term, value) {
  const itemEl = createElement('div', 'detail-list__item');
  const valueEl = createElement('dd');
  if (value instanceof Node) valueEl.append(value);
  else valueEl.textContent = value || 'Not added';
  itemEl.append(createElement('dt', '', term), valueEl);
  return itemEl;
}

/** The website is shown as a link only when it is a valid http(s) URL (never javascript: etc.). */
function createWebsite(url) {
  if (!url) return '';
  if (!isValidUrl(url)) return url;
  const linkEl = createElement('a', '', url);
  linkEl.href = url;
  linkEl.target = '_blank';
  linkEl.rel = 'noopener noreferrer';
  linkEl.append(createElement('span', 'visually-hidden', ' (opens in a new tab)'));
  return linkEl;
}

function renderSummary() {
  const profile = currentUser.profile ?? {};
  const headEl = createElement('div', 'company-summary__head');
  const logoEl = createElement('span', 'avatar avatar--lg', getInitials(profile.companyName || currentUser.name));
  logoEl.setAttribute('aria-hidden', 'true');
  const textEl = createElement('div');
  textEl.append(
    createElement('p', 'company-summary__name', profile.companyName || 'Company name not added'),
    createElement('p', 'company-summary__meta', [profile.industry, profile.companySize && `${profile.companySize} employees`]
      .filter(Boolean).join(' · ')),
  );
  headEl.append(logoEl, textEl);

  const detailsEl = createElement('dl', 'detail-list');
  detailsEl.append(
    createDetail('Location', profile.companyLocation),
    createDetail('Website', createWebsite(profile.companyWebsite)),
    createDetail('Contact', [currentUser.name, profile.designation].filter(Boolean).join(', ')),
    createDetail('Email', currentUser.email),
    createDetail('Phone', currentUser.phone),
  );
  const aboutEl = createElement('p', 'company-summary__about', profile.about || 'No company description yet.');
  $('[data-company-summary]').replaceChildren(headEl, detailsEl, aboutEl);
}

function fillForm() {
  const profile = currentUser.profile ?? {};
  const { elements } = formEl;
  elements.name.value = currentUser.name ?? '';
  elements.email.value = currentUser.email ?? '';
  elements.phone.value = currentUser.phone ?? '';
  ['companyName', 'designation', 'companyWebsite', 'companyLocation', 'industry', 'about'].forEach((field) => {
    elements[field].value = profile[field] ?? '';
  });
  const placeholderEl = createElement('option', '', 'Select size');
  placeholderEl.value = '';
  elements.companySize.replaceChildren(placeholderEl, ...COMPANY_SIZE_OPTIONS.map((size) => {
    const optionEl = createElement('option', '', `${size} employees`);
    optionEl.value = size;
    return optionEl;
  }));
  elements.companySize.value = COMPANY_SIZE_OPTIONS.includes(profile.companySize) ? profile.companySize : '';
}

const readValues = () => Object.fromEntries(COMPANY_PROFILE_FIELDS.map((field) => [field, formEl.elements[field].value]));

function validateInput(inputEl) {
  const message = validateCompanyField(inputEl.name, inputEl.value);
  setFieldError(inputEl, message);
  return message;
}

function showAlert(message) {
  const alertEl = $('[data-form-alert]', formEl);
  alertEl.textContent = message;
  alertEl.hidden = !message;
}

function showFieldErrors(fieldErrors) {
  COMPANY_PROFILE_FIELDS.forEach((field) => setFieldError(formEl.elements[field], fieldErrors[field] ?? ''));
  showAlert('Please correct the highlighted fields.');
  const firstInvalid = COMPANY_PROFILE_FIELDS.find((field) => fieldErrors[field]);
  formEl.elements[firstInvalid].focus();
}

function handleSubmit(event) {
  event.preventDefault();
  const submitEl = $('button[type="submit"]', formEl);
  if (submitEl.disabled) return; // a save is already running
  showAlert('');
  setButtonLoading(submitEl, true, { idleText: 'Save changes', loadingText: 'Saving…' });
  const result = updateCompanyProfile(readValues());
  setButtonLoading(submitEl, false, { idleText: 'Save changes', loadingText: 'Saving…' });

  if (!result.ok) {
    if (result.fieldErrors) {
      showFieldErrors(result.fieldErrors);
    } else {
      showAlert(result.error);
      $('[data-form-alert]', formEl).focus();
    }
    return;
  }
  COMPANY_PROFILE_FIELDS.forEach((field) => setFieldError(formEl.elements[field], ''));
  const nameChanged = result.data.name !== currentUser.name;
  currentUser = result.data;
  fillForm(); // show the saved (trimmed) values
  renderSummary();
  if (nameChanged) updateNavbarUser(currentUser);
  showToast('Company profile saved.', { type: 'success' });
}

function bindEvents() {
  formEl.addEventListener('submit', handleSubmit);
  COMPANY_PROFILE_FIELDS.forEach((field) => {
    const inputEl = formEl.elements[field];
    // Validate on blur once something was entered; re-check while an error is shown.
    inputEl.addEventListener('blur', () => { if (inputEl.value) validateInput(inputEl); });
    const recheck = () => { if (inputEl.hasAttribute('aria-invalid')) validateInput(inputEl); };
    inputEl.addEventListener('input', recheck);
    inputEl.addEventListener('change', recheck);
  });
}

async function init() {
  const user = await initProtectedPage(ROLES.RECRUITER);
  if (!user) return;
  currentUser = user;
  formEl = $('[data-company-form]');
  renderApprovalBanner($('[data-approval-banner]'), user);
  fillForm();
  renderSummary();
  bindEvents();
}

init();
