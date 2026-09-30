/**
 * resume-sheet.js — A simple one-page resume generated from a student's profile (Phase 7).
 * Used for the on-screen preview and the print copy (A4 print styles in student.css).
 * Everything is plain text (textContent); links are printed as text, never as clickable URLs.
 */

import { PROFILE_LINK_FIELDS } from '../core/config.js';

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const list = (value) => (Array.isArray(value) ? value : []);

function createSection(title, headingTag, ...children) {
  const sectionEl = createElement('section', 'resume-sheet__section');
  sectionEl.append(createElement(headingTag, 'resume-sheet__heading', title), ...children);
  return sectionEl;
}

function createEducation(profile, headingTag) {
  const itemsEl = createElement('ul', 'resume-sheet__list');
  const degreeLine = [profile.degree, profile.branch].filter(hasText).join(', ');
  if (degreeLine || hasText(profile.college)) {
    const itemEl = createElement('li');
    itemEl.append(createElement('strong', '', degreeLine || 'Degree'));
    const details = [
      profile.college,
      Number.isFinite(profile.graduationYear) ? `Graduating ${profile.graduationYear}` : '',
      Number.isFinite(profile.cgpa) ? `CGPA ${profile.cgpa}` : '',
    ].filter((value) => hasText(String(value)));
    if (details.length) itemEl.append(createElement('span', 'resume-sheet__muted', ` — ${details.join(' · ')}`));
    itemsEl.append(itemEl);
  }
  list(profile.education).forEach((entry) => {
    const itemEl = createElement('li');
    itemEl.append(createElement('strong', '', String(entry?.level ?? '')));
    const details = [entry?.institute, entry?.year, entry?.score].filter((value) => hasText(String(value ?? '')));
    if (details.length) itemEl.append(createElement('span', 'resume-sheet__muted', ` — ${details.join(' · ')}`));
    itemsEl.append(itemEl);
  });
  return itemsEl.children.length ? createSection('Education', headingTag, itemsEl) : null;
}

function createProjects(profile, headingTag) {
  const projects = list(profile.projects).filter((project) => hasText(project?.title));
  if (!projects.length) return null;
  const itemsEl = createElement('ul', 'resume-sheet__list');
  projects.forEach((project) => {
    const itemEl = createElement('li');
    itemEl.append(createElement('strong', '', project.title));
    if (hasText(project.description)) itemEl.append(createElement('p', 'resume-sheet__text', project.description));
    if (hasText(project.link)) itemEl.append(createElement('p', 'resume-sheet__muted', project.link));
    itemsEl.append(itemEl);
  });
  return createSection('Projects', headingTag, itemsEl);
}

/**
 * Build the resume for a student.
 * @param {object} user public student object
 * @param {{ headingLevel?: number }} [options] level of the name heading; section headings are one below
 * @returns {HTMLElement}
 */
export function createResumeSheet(user, { headingLevel = 3 } = {}) {
  const profile = user?.profile ?? {};
  const sectionHeading = `h${Math.min(headingLevel + 1, 6)}`;
  const sheetEl = createElement('article', 'resume-sheet');

  const headerEl = createElement('header', 'resume-sheet__header');
  headerEl.append(createElement(`h${headingLevel}`, 'resume-sheet__name', user?.name ?? ''));
  const contact = [user?.email, user?.phone, profile.location].filter(hasText);
  if (contact.length) headerEl.append(createElement('p', 'resume-sheet__contact', contact.join(' · ')));
  const links = PROFILE_LINK_FIELDS
    .filter(({ name }) => hasText(profile.links?.[name]))
    .map(({ name, label }) => `${label}: ${profile.links[name]}`);
  if (links.length) headerEl.append(createElement('p', 'resume-sheet__contact', links.join(' · ')));
  sheetEl.append(headerEl);

  const sections = [
    hasText(profile.about)
      ? createSection('About', sectionHeading, createElement('p', 'resume-sheet__text', profile.about))
      : null,
    createEducation(profile, sectionHeading),
    list(profile.skills).length
      ? createSection('Skills', sectionHeading, createElement('p', 'resume-sheet__text', list(profile.skills).join(', ')))
      : null,
    createProjects(profile, sectionHeading),
  ].filter(Boolean);
  sheetEl.append(...sections);
  return sheetEl;
}
