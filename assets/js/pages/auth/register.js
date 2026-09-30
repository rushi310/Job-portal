/**
 * register.js — Registration page (pages/auth/register.html).
 * UI only: role switching, inline validation messages, and loading state.
 * The rules live in services/user-service.js; the account is created by core/auth.js register().
 */

import {
  ROLES, PAGE_PATHS, PUBLIC_REGISTRATION_ROLES, DEGREE_OPTIONS, GRADUATION_YEAR_OPTIONS, SIMULATED_DELAY_MS,
} from '../../core/config.js';
import { ensureSeeded } from '../../core/seed.js';
import { setFlash } from '../../core/storage.js';
import { register, redirectIfLoggedIn } from '../../core/auth.js';
import { validateRegistrationField, validateRegistration } from '../../services/user-service.js';
import { toRoot, getQueryParam } from '../../core/utils.js';
import { renderFooter } from '../../components/footer.js';
import { renderIconsBefore } from '../../components/icons.js';
import {
  setFieldError, initPasswordToggle, setButtonLoading, wait,
} from '../../components/form-field.js';

const formEl = document.querySelector('[data-register-form]');
const submitEl = formEl.querySelector('[data-submit]');
const formAlertEl = document.querySelector('[data-form-alert]');
const roleSectionEls = document.querySelectorAll('[data-role-section]');

let isSubmitting = false;

/* ---------- Form values & fields ---------- */

function getSelectedRole() {
  return formEl.elements.role.value;
}

/** Values of every enabled field (fields of the hidden role section are disabled and skipped). */
function getFormValues() {
  return { ...Object.fromEntries(new FormData(formEl)), role: getSelectedRole() };
}

/** Enabled text/select inputs in DOM order (radio buttons excluded). `:enabled` respects disabled fieldsets. */
function getActiveInputs() {
  return [...formEl.querySelectorAll('.form-control:enabled')];
}

function validateInput(inputEl) {
  const message = validateRegistrationField(inputEl.name, getFormValues());
  setFieldError(inputEl, message);
  return !message;
}

/** Show errors for the given field → message map and focus the first invalid field. */
function showFieldErrors(fieldErrors) {
  const inputs = getActiveInputs();
  inputs.forEach((inputEl) => setFieldError(inputEl, fieldErrors[inputEl.name] ?? ''));
  const firstInvalid = inputs.find((inputEl) => fieldErrors[inputEl.name]);
  if (firstInvalid) firstInvalid.focus();
}

/* ---------- Role switching ---------- */

function applyRole(role) {
  roleSectionEls.forEach((sectionEl) => {
    const isActive = sectionEl.dataset.roleSection === role;
    sectionEl.hidden = !isActive;
    sectionEl.disabled = !isActive; // excluded from FormData, validation, and tab order
    if (!isActive) {
      sectionEl.querySelectorAll('.form-control').forEach((inputEl) => setFieldError(inputEl, ''));
    }
  });
}

/* ---------- Feedback ---------- */

function showFormAlert(message) {
  formAlertEl.textContent = message;
  formAlertEl.hidden = false;
  formAlertEl.focus();
}

function hideFormAlert() {
  formAlertEl.hidden = true;
  formAlertEl.textContent = '';
}

function setLoading(isLoading) {
  isSubmitting = isLoading;
  setButtonLoading(submitEl, isLoading, { idleText: 'Create account', loadingText: 'Creating account…' });
}

/* ---------- Submit ---------- */

function handleRegisterSuccess({ user, isPendingApproval }) {
  if (isPendingApproval) {
    setFlash(
      `Recruiter account created for ${user.name}. An admin must approve your account before you can `
      + 'post jobs. You can log in now.',
      'warning',
    );
  } else {
    setFlash(`Account created for ${user.name}! Please log in to continue.`, 'success');
  }
  const loginUrl = `${PAGE_PATHS.LOGIN}?email=${encodeURIComponent(user.email)}`;
  window.location.assign(toRoot(loginUrl));
}

async function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return; // blocks double clicks and repeated Enter presses

  hideFormAlert();
  const fieldErrors = validateRegistration(getFormValues());
  if (Object.keys(fieldErrors).length > 0) {
    showFieldErrors(fieldErrors);
    return;
  }

  setLoading(true);
  await wait(SIMULATED_DELAY_MS);
  const result = register(getFormValues());

  if (result.ok) {
    handleRegisterSuccess(result.data); // page navigates away; keep the button disabled
    return;
  }
  setLoading(false);
  if (result.fieldErrors) {
    showFieldErrors(result.fieldErrors); // e.g. the email was taken in another tab meanwhile
  } else {
    showFormAlert(result.error);
  }
}

/* ---------- Setup ---------- */

function fillSelectOptions() {
  const optionSets = { degrees: DEGREE_OPTIONS, graduationYears: GRADUATION_YEAR_OPTIONS };
  formEl.querySelectorAll('select[data-options]').forEach((selectEl) => {
    optionSets[selectEl.dataset.options].forEach((value) => {
      selectEl.append(new Option(String(value), String(value)));
    });
  });
}

function bindFieldValidation() {
  formEl.querySelectorAll('.form-control').forEach((inputEl) => {
    // Validate on blur once something was entered, so tabbing through isn't noisy.
    inputEl.addEventListener('blur', () => {
      if (inputEl.value) validateInput(inputEl);
    });
    // Re-check a field as soon as it changes while it shows an error.
    const recheck = () => {
      if (inputEl.hasAttribute('aria-invalid')) validateInput(inputEl);
    };
    inputEl.addEventListener('input', recheck);
    inputEl.addEventListener('change', recheck);
  });

  // A new password can fix or break the confirmation.
  formEl.elements.password.addEventListener('input', () => {
    const confirmEl = formEl.elements.confirmPassword;
    if (confirmEl.value) validateInput(confirmEl);
  });
}

function bindEvents() {
  formEl.addEventListener('submit', handleSubmit);
  formEl.querySelectorAll('input[name="role"]').forEach((radioEl) => {
    radioEl.addEventListener('change', () => applyRole(getSelectedRole()));
  });
  formEl.querySelectorAll('[data-toggle-password]').forEach((toggleEl) => {
    initPasswordToggle(toggleEl, document.getElementById(toggleEl.dataset.togglePassword));
  });
  bindFieldValidation();
}

async function init() {
  renderFooter(document.querySelector('[data-mount="footer"]'));
  renderIconsBefore();
  fillSelectOptions();
  // ?role=recruiter (from the landing page "Register as recruiter" link) pre-selects the role.
  const requestedRole = getQueryParam('role');
  if (PUBLIC_REGISTRATION_ROLES.includes(requestedRole)) formEl.elements.role.value = requestedRole;
  applyRole(getSelectedRole() || ROLES.STUDENT);
  bindEvents();

  try {
    await ensureSeeded(); // needed for the email uniqueness check
    redirectIfLoggedIn(); // already logged in → own dashboard (ARCHITECTURE.md §5)
  } catch (error) {
    console.error('register: could not load demo data', error);
    showFormAlert(error.message);
    submitEl.disabled = true;
  }
}

init();
