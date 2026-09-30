/**
 * login.js — Login page (pages/auth/login.html).
 * UI only: validation, feedback, and loading state. Authentication itself is done by core/auth.js.
 */

import { ROLES, SIMULATED_DELAY_MS } from '../../core/config.js';
import { ensureSeeded } from '../../core/seed.js';
import { setFlash, consumeFlash } from '../../core/storage.js';
import {
  login, getPostLoginPath, redirectIfLoggedIn, AUTH_ERRORS,
} from '../../core/auth.js';
import {
  toRoot, getLabel, isValidEmail, getQueryParam,
} from '../../core/utils.js';
import { renderFooter } from '../../components/footer.js';
import { renderIconsBefore } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
import {
  setFieldError, initPasswordToggle, setButtonLoading, wait,
} from '../../components/form-field.js';

/** Demo accounts documented in PROJECT_SPEC.md §6 (simulation only). */
const DEMO_ACCOUNTS = [
  { role: ROLES.STUDENT, email: 'student@freshhire.com', password: 'Student@123' },
  { role: ROLES.RECRUITER, email: 'recruiter@freshhire.com', password: 'Recruiter@123' },
  { role: ROLES.ADMIN, email: 'admin@freshhire.com', password: 'Admin@123' },
];

const formEl = document.querySelector('[data-login-form]');
const emailEl = formEl.elements.email;
const passwordEl = formEl.elements.password;
const submitEl = formEl.querySelector('[data-submit]');
const toggleEl = formEl.querySelector('[data-action="toggle-password"]');
const formAlertEl = document.querySelector('[data-form-alert]');

let isSubmitting = false;

/* ---------- Field validation ---------- */

const VALIDATORS = {
  email: (value) => {
    if (!value.trim()) return 'Please enter your email address.';
    if (!isValidEmail(value)) return 'Please enter a valid email address, e.g. name@example.com.';
    return '';
  },
  password: (value) => (value ? '' : 'Please enter your password.'),
};

/** @returns {boolean} true if the field is valid */
function validateField(inputEl) {
  const message = VALIDATORS[inputEl.name](inputEl.value);
  setFieldError(inputEl, message);
  return !message;
}

/** Validate all fields; focus the first invalid one (UI_SPEC.md §6). */
function validateForm() {
  const invalidFields = [emailEl, passwordEl].filter((inputEl) => !validateField(inputEl));
  if (invalidFields.length > 0) invalidFields[0].focus();
  return invalidFields.length === 0;
}

/* ---------- Feedback helpers ---------- */

function showFormAlert(message) {
  formAlertEl.textContent = message;
  formAlertEl.hidden = false;
}

function hideFormAlert() {
  formAlertEl.hidden = true;
  formAlertEl.textContent = '';
}

function setLoading(isLoading) {
  isSubmitting = isLoading;
  setButtonLoading(submitEl, isLoading, { idleText: 'Log in', loadingText: 'Logging in…' });
}

/* ---------- Login flow ---------- */

function handleLoginFailure(result) {
  showFormAlert(result.error);
  if (result.code === AUTH_ERRORS.INVALID_CREDENTIALS) {
    passwordEl.value = '';
    passwordEl.focus();
  } else {
    formAlertEl.focus();
  }
}

function handleLoginSuccess({ user, isPendingApproval }) {
  const roleLabel = getLabel(user.role);
  if (isPendingApproval) {
    setFlash(`Logged in as ${user.name} (${roleLabel}). Your account is awaiting admin approval.`, 'warning');
  } else {
    setFlash(`Welcome back, ${user.name}! You are logged in as ${roleLabel}.`, 'success');
  }
  window.location.assign(toRoot(getPostLoginPath(user.role, getQueryParam('returnTo'))));
}

async function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return; // blocks double clicks and repeated Enter presses

  hideFormAlert();
  if (!validateForm()) return;

  setLoading(true);
  await wait(SIMULATED_DELAY_MS);
  const result = login(emailEl.value, passwordEl.value);

  if (result.ok) {
    handleLoginSuccess(result.data); // page navigates away; keep the button disabled
    return;
  }
  setLoading(false);
  handleLoginFailure(result);
}

/* ---------- Other interactions ---------- */

function renderDemoAccounts() {
  const listEl = document.querySelector('[data-demo-accounts]');
  const items = DEMO_ACCOUNTS.map(({ role, email }) => {
    const itemEl = document.createElement('li');
    itemEl.className = 'demo-accounts__item';

    const textEl = document.createElement('span');
    textEl.className = 'demo-accounts__label';
    const roleEl = document.createElement('strong');
    roleEl.textContent = getLabel(role);
    const emailTextEl = document.createElement('span');
    emailTextEl.className = 'demo-accounts__email';
    emailTextEl.textContent = email;
    textEl.append(roleEl, emailTextEl);

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'btn btn--outline btn--sm';
    buttonEl.dataset.demoRole = role;
    buttonEl.textContent = 'Use';
    buttonEl.setAttribute('aria-label', `Use ${getLabel(role)} demo account`);

    itemEl.append(textEl, buttonEl);
    return itemEl;
  });
  listEl.replaceChildren(...items);
}

function fillDemoAccount(role) {
  const account = DEMO_ACCOUNTS.find((demo) => demo.role === role);
  emailEl.value = account.email;
  passwordEl.value = account.password;
  [emailEl, passwordEl].forEach((inputEl) => setFieldError(inputEl, ''));
  hideFormAlert();
  submitEl.focus();
}

/**
 * Handle arrival hand-offs: ?email= after registration, and the one-time message
 * (e.g. "Account created…" or "Please log in to continue." from a page guard).
 */
function applyRegistrationHandoff() {
  const email = getQueryParam('email');
  if (email) {
    emailEl.value = email;
    passwordEl.focus();
  }
  const flash = consumeFlash();
  if (flash) showToast(flash.message, { type: flash.type, duration: 8000 });
}

function bindEvents() {
  formEl.addEventListener('submit', handleSubmit);
  initPasswordToggle(toggleEl, passwordEl);

  [emailEl, passwordEl].forEach((inputEl) => {
    // Validate on blur only once the user has typed something, so tabbing through isn't noisy.
    inputEl.addEventListener('blur', () => {
      if (inputEl.value) validateField(inputEl);
    });
    // Clear a field's error as soon as it is corrected.
    inputEl.addEventListener('input', () => {
      if (inputEl.hasAttribute('aria-invalid')) validateField(inputEl);
    });
  });

  document.querySelector('[data-demo-accounts]').addEventListener('click', (event) => {
    const buttonEl = event.target.closest('[data-demo-role]');
    if (buttonEl) fillDemoAccount(buttonEl.dataset.demoRole);
  });
}

async function init() {
  renderFooter(document.querySelector('[data-mount="footer"]'));
  renderIconsBefore();
  renderDemoAccounts();
  bindEvents();

  try {
    await ensureSeeded();
    if (redirectIfLoggedIn()) return; // already logged in → own dashboard (ARCHITECTURE.md §5)
    applyRegistrationHandoff();
  } catch (error) {
    console.error('login: could not load demo data', error);
    showFormAlert(error.message);
    submitEl.disabled = true;
  }
}

init();
