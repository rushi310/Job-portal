/**
 * load-state.js — What a section shows while its data is on the way from the server, and when
 * loading failed. Every page uses the same two states, so waiting and errors look the same
 * everywhere. Both are replaced as soon as the section renders its real content.
 */

import { createEmptyState } from './empty-state.js';

/**
 * Show "Loading…" in a container (announced politely to screen readers).
 * @param {HTMLElement} containerEl
 * @param {string} [text]
 */
export function renderLoading(containerEl, text = 'Loading…') {
  const messageEl = document.createElement('p');
  messageEl.className = 'text-muted';
  messageEl.setAttribute('role', 'status');
  messageEl.textContent = text;
  containerEl.replaceChildren(messageEl);
}

/**
 * Show a "could not load" message (with the server's reason) in a container.
 * @param {HTMLElement} containerEl
 * @param {{ title: string, message?: string, headingLevel?: number }} options
 */
export function renderLoadError(containerEl, { title, message = 'Please reload the page.', headingLevel = 3 }) {
  const errorEl = createEmptyState({ icon: 'alert', title, message, headingLevel });
  errorEl.setAttribute('role', 'alert');
  containerEl.replaceChildren(errorEl);
}
