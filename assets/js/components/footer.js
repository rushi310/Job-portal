/**
 * footer.js — Site footer with the mandatory demo notice (CLAUDE.md §6, UI_SPEC.md §1).
 */

import { APP_NAME } from '../core/config.js';
import { toRoot } from '../core/utils.js';
import { createIcon } from './icons.js';
import { openModal } from './modal.js';

const DEMO_NOTICE = 'Demo project — not a real hiring service. Please do not enter real personal data.';

const EXPLORE_LINKS = [
  { label: 'Home', path: 'index.html#top' },
  { label: 'How it works', path: 'index.html#how-it-works' },
  { label: 'Featured jobs', path: 'index.html#featured-jobs' },
];

/** Explains honestly what the project is; shown from the "About this demo" button. */
function openAboutDemoModal() {
  const contentEl = document.createElement('div');
  const points = [
    `${APP_NAME} is a final-year college project that simulates a job portal for freshers.`,
    'The pages are plain HTML, CSS and JavaScript. They talk to a small Node.js / Express API that stores data in MongoDB.',
    'Accounts, jobs and applications here are for demonstration only: no real company is hiring through this site.',
    'It runs on free hosting and is not hardened like a production service, so use a made-up name and a password you do not use anywhere else.',
  ];
  const listEl = document.createElement('ul');
  points.forEach((point) => {
    const itemEl = document.createElement('li');
    itemEl.textContent = point;
    listEl.append(itemEl);
  });
  contentEl.append(listEl);

  openModal({ title: 'About this demo', content: contentEl, actions: [{ label: 'Got it', variant: 'primary' }] });
}

function createLinkColumn(heading, links) {
  const columnEl = document.createElement('div');
  const headingEl = document.createElement('h2');
  headingEl.className = 'site-footer__heading';
  headingEl.textContent = heading;
  const listEl = document.createElement('ul');
  listEl.className = 'site-footer__links';
  listEl.setAttribute('role', 'list');
  links.forEach(({ label, path }) => {
    const itemEl = document.createElement('li');
    const linkEl = document.createElement('a');
    linkEl.href = toRoot(path);
    linkEl.textContent = label;
    itemEl.append(linkEl);
    listEl.append(itemEl);
  });
  columnEl.append(headingEl, listEl);
  return columnEl;
}

function createInfoColumn() {
  const columnEl = document.createElement('div');
  const headingEl = document.createElement('h2');
  headingEl.className = 'site-footer__heading';
  headingEl.textContent = 'Project';
  const textEl = document.createElement('p');
  textEl.textContent = 'Built with HTML5, CSS3 and Vanilla JavaScript, with a Node.js, Express and MongoDB API.';
  const aboutBtnEl = document.createElement('button');
  aboutBtnEl.type = 'button';
  aboutBtnEl.className = 'btn btn--outline btn--sm mt-2';
  aboutBtnEl.textContent = 'About this demo';
  aboutBtnEl.addEventListener('click', openAboutDemoModal);
  columnEl.append(headingEl, textEl, aboutBtnEl);
  return columnEl;
}

/**
 * Replace a mount element with the site footer.
 * @param {HTMLElement} mountEl
 */
export function renderFooter(mountEl) {
  const footerEl = document.createElement('footer');
  footerEl.className = 'site-footer';

  const containerEl = document.createElement('div');
  containerEl.className = 'container';

  const innerEl = document.createElement('div');
  innerEl.className = 'site-footer__inner';

  const brandEl = document.createElement('div');
  const logoEl = document.createElement('img');
  logoEl.className = 'brand__logo';
  logoEl.src = toRoot('assets/images/logo.svg');
  logoEl.alt = APP_NAME;
  logoEl.width = 150;
  logoEl.height = 32;
  const taglineEl = document.createElement('p');
  taglineEl.className = 'site-footer__tagline';
  taglineEl.textContent = 'Helping freshers find their first job and internship.';
  brandEl.append(logoEl, taglineEl);

  innerEl.append(brandEl, createLinkColumn('Explore', EXPLORE_LINKS), createInfoColumn());

  const bottomEl = document.createElement('div');
  bottomEl.className = 'site-footer__bottom';
  const copyrightEl = document.createElement('p');
  copyrightEl.textContent = `© ${new Date().getFullYear()} ${APP_NAME}. Academic project.`;
  const noticeEl = document.createElement('p');
  noticeEl.className = 'site-footer__notice';
  noticeEl.append(createIcon('info'), DEMO_NOTICE);
  bottomEl.append(copyrightEl, noticeEl);

  containerEl.append(innerEl, bottomEl);
  footerEl.append(containerEl);
  mountEl.replaceWith(footerEl);
  return footerEl;
}
