/**
 * save-button.js — "♡ Save / ♥ Saved" toggle for job cards and Job Details (UI_SPEC.md §4, BR-18).
 * One implementation for every page: build buttons with createSaveButton() and let
 * bindSaveButtons() handle clicks on a container (event delegation).
 * Exception to the layer rule: this component calls saved-job-service (see ARCHITECTURE.md §1).
 */

import { saveJob, unsaveJob } from '../services/saved-job-service.js';
import { showToast } from './toast.js';

/** Update a button to show the saved / not saved state (text + aria-pressed, not colour alone). */
function setSavedState(buttonEl, isSaved) {
  buttonEl.setAttribute('aria-pressed', String(isSaved));
  buttonEl.classList.toggle('is-saved', isSaved);
  buttonEl.querySelector('[data-save-icon]').textContent = isSaved ? '♥' : '♡';
  buttonEl.querySelector('[data-save-label]').textContent = isSaved ? 'Saved' : 'Save';
}

/**
 * @param {object} job
 * @param {boolean} isSaved
 * @param {{ block?: boolean }} [options] block = full-width button (Job Details panel)
 * @returns {HTMLButtonElement}
 */
export function createSaveButton(job, isSaved, { block = false } = {}) {
  const buttonEl = document.createElement('button');
  buttonEl.type = 'button';
  buttonEl.className = `btn btn--outline btn--sm save-btn${block ? ' btn--block' : ''}`;
  buttonEl.dataset.action = 'toggle-save';
  buttonEl.dataset.jobId = job.id;

  const iconEl = document.createElement('span');
  iconEl.dataset.saveIcon = '';
  iconEl.setAttribute('aria-hidden', 'true'); // the heart is decorative; the text says the state
  const labelEl = document.createElement('span');
  labelEl.dataset.saveLabel = '';
  const titleEl = document.createElement('span');
  titleEl.className = 'visually-hidden';
  titleEl.textContent = `: ${job.title}`; // accessible name "Save: <job title>"
  buttonEl.append(iconEl, labelEl, titleEl);

  setSavedState(buttonEl, isSaved);
  return buttonEl;
}

/**
 * Handle save/unsave clicks inside a container.
 * @param {HTMLElement} containerEl
 * @param {{ onChange?: (jobId: string, isSaved: boolean) => void }} [options]
 */
export function bindSaveButtons(containerEl, { onChange } = {}) {
  containerEl.addEventListener('click', (event) => {
    const buttonEl = event.target.closest('[data-action="toggle-save"]');
    if (!buttonEl || !containerEl.contains(buttonEl)) return;
    event.preventDefault(); // never let a save click trigger other card behaviour
    if (buttonEl.getAttribute('aria-busy') === 'true') return; // one operation at a time

    const { jobId } = buttonEl.dataset;
    const wasSaved = buttonEl.getAttribute('aria-pressed') === 'true';
    buttonEl.setAttribute('aria-busy', 'true');
    const result = wasSaved ? unsaveJob(jobId) : saveJob(jobId);
    buttonEl.removeAttribute('aria-busy');

    if (!result.ok) {
      showToast(result.error, { type: 'error' });
      return;
    }
    setSavedState(buttonEl, result.data.saved);
    showToast(result.data.saved ? 'Job saved.' : 'Job removed from saved jobs.', { type: 'success', duration: 2500 });
    if (onChange) onChange(jobId, result.data.saved);
  });
}
