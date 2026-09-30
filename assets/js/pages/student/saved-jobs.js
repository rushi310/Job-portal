/**
 * saved-jobs.js — Saved Jobs page (Phase 6; UI_SPEC.md §5 "Saved Jobs", BR-18).
 * Lists the logged-in student's saved jobs with an Unsave toggle. Jobs that have expired are
 * labelled; jobs that were closed or removed stay listed as "no longer available" until the
 * student removes them (saved links are never deleted automatically).
 */

import { ROLES, PAGE_PATHS } from '../../core/config.js';
import { toRoot, formatDate, pluralize } from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { createJobCard, createViewDetailsLink } from '../../components/job-card.js';
import { createEmptyState } from '../../components/empty-state.js';
import { createSaveButton, bindSaveButtons } from '../../components/save-button.js';
import { getSavedJobsWithDetails } from '../../services/saved-job-service.js';
import { JOB_AVAILABILITY } from '../../services/job-service.js';

const listEl = document.querySelector('[data-saved-list]');
const countEl = document.querySelector('[data-saved-count]');
let student = null;

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** A saved job whose record is gone or no longer visible to students. */
function createUnavailableCard({ record, job, availability }) {
  const cardEl = createElement('article', 'card job-card job-card--unavailable');
  const title = job?.title ?? 'Job no longer available';
  cardEl.append(
    createElement('h3', 'job-card__title', title),
    createElement('p', 'job-card__company', job?.companyName ?? 'This job was removed.'),
    createElement('span', 'badge badge--status-closed',
      availability === JOB_AVAILABILITY.CLOSED ? 'Closed by recruiter' : 'No longer available'),
    createElement('p', 'job-card__note text-muted', `Saved on ${formatDate(record.savedAt)}`),
  );
  const footerEl = createElement('div', 'job-card__footer');
  const actionsEl = createElement('div', 'job-card__actions');
  actionsEl.append(createSaveButton({ id: record.jobId, title }, true));
  footerEl.append(actionsEl);
  cardEl.append(footerEl);
  return cardEl;
}

function createSavedCard(item) {
  const { record, job, availability } = item;
  if (availability === JOB_AVAILABILITY.CLOSED || availability === JOB_AVAILABILITY.UNAVAILABLE) {
    return createUnavailableCard(item);
  }
  return createJobCard(job, {
    isExpired: availability === JOB_AVAILABILITY.EXPIRED,
    note: `Saved on ${formatDate(record.savedAt)}`,
    actions: [createSaveButton(job, true), createViewDetailsLink(job)],
  });
}

function render() {
  try {
    const items = getSavedJobsWithDetails(student.id);
    countEl.textContent = items.length === 0 ? '' : `${pluralize(items.length, 'saved job')}`;
    if (items.length === 0) {
      listEl.replaceChildren(createEmptyState({
        icon: 'bookmark',
        title: 'No saved jobs yet',
        message: 'Browse jobs and save the ones you want to come back to.',
        action: { label: 'Browse jobs', href: toRoot(PAGE_PATHS.JOBS) },
      }));
      return;
    }
    listEl.replaceChildren(...items.map(createSavedCard));
  } catch (error) {
    console.error('saved-jobs: could not render saved jobs', error);
    countEl.textContent = '';
    listEl.replaceChildren(createEmptyState({
      icon: 'alert',
      title: 'Saved jobs could not be loaded',
      message: 'Please reload the page.',
    }));
  }
}

async function init() {
  student = await initProtectedPage(ROLES.STUDENT);
  if (!student) return;
  // Unsaving here removes the card; focus moves to the count so keyboard users are not lost.
  bindSaveButtons(listEl, {
    onChange: (jobId, isSaved) => {
      if (isSaved) return;
      render();
      countEl.tabIndex = -1;
      countEl.focus();
    },
  });
  render();
}

init();
