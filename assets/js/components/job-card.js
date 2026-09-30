/**
 * job-card.js — Builds a job summary card (UI_SPEC.md §4).
 * Built with createElement/textContent so job data can never inject HTML.
 */

import { MAX_CARD_SKILLS } from '../core/config.js';
import {
  getLabel, formatSalary, formatDate, formatRelativeTime, getInitials, daysUntil,
} from '../core/utils.js';
import { createIcon } from './icons.js';

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createMetaItem(iconName, text, extraClass = '') {
  const itemEl = createElement('li', `job-card__meta-item ${extraClass}`.trim());
  itemEl.append(createIcon(iconName), text);
  return itemEl;
}

function createSkillChips(skillsValue) {
  const skills = Array.isArray(skillsValue) ? skillsValue : [];
  const listEl = createElement('ul', 'chip-list');
  listEl.setAttribute('aria-label', 'Skills');
  skills.slice(0, MAX_CARD_SKILLS).forEach((skill) => {
    listEl.append(createElement('li', 'chip', skill));
  });
  const hiddenCount = skills.length - MAX_CARD_SKILLS;
  if (hiddenCount > 0) listEl.append(createElement('li', 'chip chip--more', `+${hiddenCount} more`));
  return listEl;
}

function describeDeadline(job, isExpired) {
  if (isExpired) return `Closed on ${formatDate(job.deadline)}`;
  const days = daysUntil(job.deadline);
  if (days === 0) return 'Apply by today';
  if (days <= 7) return `${days} day${days === 1 ? '' : 's'} left`;
  return `Apply by ${formatDate(job.deadline)}`;
}

/**
 * Create a job card element.
 * @param {object} job job record (PROJECT_SPEC.md §5.2)
 * @param {object} [options]
 * @param {boolean} [options.isExpired=false] computed by job-service
 * @param {HTMLElement[]} [options.actions=[]] buttons/links for the card footer
 * @param {string} [options.note] short extra line, e.g. "Matches your skills: HTML, CSS"
 * @returns {HTMLElement}
 */
export function createJobCard(job, { isExpired = false, actions = [], note = '' } = {}) {
  const cardEl = createElement('article', 'card card--hover job-card');
  cardEl.dataset.jobId = job.id;

  const headerEl = createElement('div', 'job-card__header');
  const logoEl = createElement('span', 'job-card__logo', getInitials(job.companyName));
  logoEl.setAttribute('aria-hidden', 'true');
  const headingEl = createElement('div', 'job-card__heading');
  headingEl.append(
    createElement('h3', 'job-card__title', job.title),
    createElement('p', 'job-card__company', job.companyName),
  );
  headerEl.append(logoEl, headingEl);

  const badgesEl = createElement('div', 'flex flex-wrap gap-2');
  badgesEl.append(createElement('span', 'badge badge--primary', getLabel(job.jobType)));
  badgesEl.append(createElement('span', 'badge badge--info', getLabel(job.workMode)));
  if (isExpired) badgesEl.append(createElement('span', 'badge badge--status-expired', getLabel('expired')));

  const metaEl = createElement('ul', 'job-card__meta');
  metaEl.append(
    createMetaItem('mapPin', job.location ?? 'Location not specified'),
    createMetaItem('briefcase', job.experience ?? 'Fresher'),
    createMetaItem('wallet', formatSalary(job), 'job-card__salary'),
  );

  const footerEl = createElement('div', 'job-card__footer');
  const timeEl = createElement('span', 'job-card__meta-item');
  timeEl.append(createIcon('clock'), describeDeadline(job, isExpired));
  const postedEl = createElement('span', '', `Posted ${formatRelativeTime(job.postedAt)}`);
  footerEl.append(timeEl, postedEl);

  if (actions.length > 0) {
    const actionsEl = createElement('div', 'job-card__actions');
    actionsEl.append(...actions);
    footerEl.append(actionsEl);
  }

  cardEl.append(headerEl, badgesEl, metaEl, createSkillChips(job.skills));
  if (note) cardEl.append(createElement('p', 'job-card__note', note));
  cardEl.append(footerEl);
  return cardEl;
}
