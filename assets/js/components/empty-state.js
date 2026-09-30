/**
 * empty-state.js — Friendly placeholder shown instead of an empty list (UI_SPEC.md §6).
 */

import { createIcon } from './icons.js';

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.message]
 * @param {string} [options.icon='inbox'] icon name from icons.js
 * @param {{ label: string, href: string }} [options.action] optional link button
 * @param {number} [options.headingLevel=3] use 2 when the empty state sits directly under the page h1
 * @returns {HTMLElement}
 */
export function createEmptyState({
  title, message = '', icon = 'inbox', action, headingLevel = 3,
} = {}) {
  const wrapperEl = document.createElement('div');
  wrapperEl.className = 'empty-state';

  const iconEl = document.createElement('span');
  iconEl.className = 'empty-state__icon';
  iconEl.append(createIcon(icon));

  const titleEl = document.createElement(`h${[2, 3, 4].includes(headingLevel) ? headingLevel : 3}`);
  titleEl.className = 'empty-state__title';
  titleEl.textContent = title;

  wrapperEl.append(iconEl, titleEl);

  if (message) {
    const messageEl = document.createElement('p');
    messageEl.className = 'empty-state__message';
    messageEl.textContent = message;
    wrapperEl.append(messageEl);
  }

  if (action) {
    const linkEl = document.createElement('a');
    linkEl.className = 'btn btn--primary';
    linkEl.href = action.href;
    linkEl.textContent = action.label;
    wrapperEl.append(linkEl);
  }

  return wrapperEl;
}
