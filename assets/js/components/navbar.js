/**
 * navbar.js — Site header.
 * Phase 1: public variant only (landing page). The logged-in app variant is added in Phase 2.
 */

import { toRoot } from '../core/utils.js';
import { createIcon } from './icons.js';

const PUBLIC_LINKS = [
  { label: 'Home', path: 'index.html#top' },
  { label: 'How it works', path: 'index.html#how-it-works' },
  { label: 'Featured jobs', path: 'index.html#featured-jobs' },
];

/** A disabled button with a "Soon" tag, for features of later phases. */
export function createSoonButton(label, variant = 'outline', size = 'sm') {
  const buttonEl = document.createElement('button');
  buttonEl.type = 'button';
  buttonEl.className = `btn btn--${variant}${size ? ` btn--${size}` : ''}`;
  buttonEl.disabled = true;
  buttonEl.title = 'Coming soon';
  const tagEl = document.createElement('span');
  tagEl.className = 'tag-soon';
  tagEl.textContent = 'Soon';
  buttonEl.append(label, ' ', tagEl);
  return buttonEl;
}

function createLogoLink() {
  const linkEl = document.createElement('a');
  linkEl.className = 'brand';
  linkEl.href = toRoot('index.html');
  const logoEl = document.createElement('img');
  logoEl.className = 'brand__logo';
  logoEl.src = toRoot('assets/images/logo.svg');
  logoEl.alt = 'FreshHire home';
  logoEl.width = 150;
  logoEl.height = 32;
  linkEl.append(logoEl);
  return linkEl;
}

function createNav() {
  const navEl = document.createElement('nav');
  navEl.className = 'site-nav';
  navEl.id = 'primary-nav';
  navEl.setAttribute('aria-label', 'Primary');

  const listEl = document.createElement('ul');
  listEl.className = 'site-nav__list';
  listEl.setAttribute('role', 'list');
  PUBLIC_LINKS.forEach(({ label, path }) => {
    const itemEl = document.createElement('li');
    const linkEl = document.createElement('a');
    linkEl.className = 'site-nav__link';
    linkEl.href = toRoot(path);
    linkEl.textContent = label;
    itemEl.append(linkEl);
    listEl.append(itemEl);
  });

  // Login & Register become real links in Phase 2.
  const actionsEl = document.createElement('div');
  actionsEl.className = 'site-nav__actions';
  actionsEl.append(createSoonButton('Login', 'outline'), createSoonButton('Register', 'primary'));

  navEl.append(listEl, actionsEl);
  return navEl;
}

/** Wire the mobile menu toggle: click, Esc, and closing after a link is chosen. */
function bindMenuToggle(toggleEl, navEl) {
  const setOpen = (isOpen) => {
    navEl.classList.toggle('is-open', isOpen);
    toggleEl.setAttribute('aria-expanded', String(isOpen));
    toggleEl.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    toggleEl.replaceChildren(createIcon(isOpen ? 'close' : 'menu'));
  };

  toggleEl.addEventListener('click', () => setOpen(!navEl.classList.contains('is-open')));
  navEl.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navEl.classList.contains('is-open')) {
      setOpen(false);
      toggleEl.focus();
    }
  });
}

/**
 * Replace a mount element with the public site header.
 * @param {HTMLElement} mountEl placeholder element in the page
 */
export function renderPublicNavbar(mountEl) {
  const headerEl = document.createElement('header');
  headerEl.className = 'site-header';

  const innerEl = document.createElement('div');
  innerEl.className = 'container site-header__inner';

  const toggleEl = document.createElement('button');
  toggleEl.type = 'button';
  toggleEl.className = 'site-header__toggle';
  toggleEl.setAttribute('aria-controls', 'primary-nav');
  toggleEl.setAttribute('aria-expanded', 'false');
  toggleEl.setAttribute('aria-label', 'Open menu');
  toggleEl.append(createIcon('menu'));

  const navEl = createNav();
  innerEl.append(createLogoLink(), toggleEl, navEl);
  headerEl.append(innerEl);
  mountEl.replaceWith(headerEl);

  bindMenuToggle(toggleEl, navEl);
  return headerEl;
}
