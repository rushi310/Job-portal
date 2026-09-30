/**
 * form-field.js — Shared form UI helpers (inline errors, password toggle, loading button).
 * Markup contract: each input sits in a `.form-group` that contains a `.form-error` element
 * linked to the input with aria-describedby (UI_SPEC.md §4 "Form field").
 */

import { createIcon } from './icons.js';

/**
 * Show or clear an inline error for a field.
 * @param {HTMLInputElement|HTMLSelectElement} inputEl
 * @param {string} message '' clears the error
 */
export function setFieldError(inputEl, message) {
  const groupEl = inputEl.closest('.form-group');
  const errorEl = groupEl.querySelector('.form-error');
  errorEl.textContent = message;
  errorEl.hidden = !message;
  groupEl.classList.toggle('has-error', Boolean(message));
  if (message) {
    inputEl.setAttribute('aria-invalid', 'true');
  } else {
    inputEl.removeAttribute('aria-invalid');
  }
}

/**
 * Wire a show/hide button to a password input.
 * @param {HTMLButtonElement} toggleEl
 * @param {HTMLInputElement} passwordEl
 */
export function initPasswordToggle(toggleEl, passwordEl) {
  const setVisible = (isVisible) => {
    passwordEl.type = isVisible ? 'text' : 'password';
    toggleEl.setAttribute('aria-pressed', String(isVisible));
    toggleEl.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
    toggleEl.replaceChildren(createIcon(isVisible ? 'eyeOff' : 'eye'));
  };
  setVisible(false);
  toggleEl.addEventListener('click', () => setVisible(passwordEl.type === 'password'));
}

/**
 * Put a submit button (and its form) into or out of the loading state.
 * @param {HTMLButtonElement} buttonEl
 * @param {boolean} isLoading
 * @param {{ idleText: string, loadingText: string }} labels
 */
export function setButtonLoading(buttonEl, isLoading, { idleText, loadingText }) {
  buttonEl.disabled = isLoading;
  buttonEl.classList.toggle('is-loading', isLoading);
  buttonEl.textContent = isLoading ? loadingText : idleText;
  buttonEl.form?.setAttribute('aria-busy', String(isLoading));
}

/** Resolve after `ms` milliseconds (used to simulate a network round-trip). */
export function wait(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}
