/**
 * toast.js — Small, auto-dismissing notification messages (UI_SPEC.md §4).
 * Announced to screen readers through an aria-live region.
 */

import { TOAST_DURATION } from '../core/config.js';

const TOAST_TYPES = ['success', 'error', 'warning', 'info'];
let containerEl = null;

function getContainer() {
  if (containerEl && document.body.contains(containerEl)) return containerEl;
  containerEl = document.createElement('div');
  containerEl.className = 'toast-container';
  containerEl.setAttribute('aria-live', 'polite');
  containerEl.setAttribute('aria-atomic', 'false');
  document.body.append(containerEl);
  return containerEl;
}

function dismiss(toastEl) {
  if (!toastEl.isConnected) return;
  toastEl.classList.add('is-leaving');
  setTimeout(() => toastEl.remove(), 200);
}

/**
 * Show a toast.
 * @param {string} message plain text (never HTML)
 * @param {{ type?: 'success'|'error'|'warning'|'info', duration?: number }} options
 */
export function showToast(message, { type = 'info', duration = TOAST_DURATION } = {}) {
  const safeType = TOAST_TYPES.includes(type) ? type : 'info';

  const toastEl = document.createElement('div');
  toastEl.className = `toast toast--${safeType}`;
  toastEl.setAttribute('role', safeType === 'error' ? 'alert' : 'status');

  const messageEl = document.createElement('p');
  messageEl.className = 'toast__message';
  messageEl.textContent = message;

  const closeEl = document.createElement('button');
  closeEl.type = 'button';
  closeEl.className = 'toast__close';
  closeEl.setAttribute('aria-label', 'Dismiss notification');
  closeEl.textContent = '×';
  closeEl.addEventListener('click', () => dismiss(toastEl));

  toastEl.append(messageEl, closeEl);
  getContainer().append(toastEl);

  if (duration > 0) setTimeout(() => dismiss(toastEl), duration);
}
