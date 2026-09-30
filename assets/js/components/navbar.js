/**
 * navbar.js — Site headers.
 * - renderPublicNavbar: landing page (Phase 1).
 * - renderAppNavbar: logged-in pages — ☰ drawer toggle, logo, user menu with logout (P2-T04).
 *   The notification bell is added in Phase 10 (UI_SPEC.md §3.2).
 */

import { PAGE_PATHS, ROLES, USER_STATUS } from '../core/config.js';
import { toRoot, getLabel, getInitials } from '../core/utils.js';
import { setFlash } from '../core/storage.js';
import { logout, getPostLoginPath } from '../core/auth.js';
import { createIcon } from './icons.js';

const PUBLIC_LINKS = [
  { label: 'Home', path: 'index.html#top' },
  { label: 'How it works', path: 'index.html#how-it-works' },
  { label: 'Featured jobs', path: 'index.html#featured-jobs' },
];

/** A small button-styled link to a project page (e.g. Login / Register). */
function createButtonLink(label, path, variant) {
  const linkEl = document.createElement('a');
  linkEl.className = `btn btn--${variant} btn--sm`;
  linkEl.href = toRoot(path);
  linkEl.textContent = label;
  return linkEl;
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

  const actionsEl = document.createElement('div');
  actionsEl.className = 'site-nav__actions';
  actionsEl.append(
    createButtonLink('Log in', PAGE_PATHS.LOGIN, 'outline'),
    createButtonLink('Register', PAGE_PATHS.REGISTER, 'primary'),
  );

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

/* ==========================================================================
   App navbar (logged-in pages)
   ========================================================================== */

/** Profile page per role in the user menu (none for admin). Shown as "Soon" until built. */
const PROFILE_MENU_ITEMS = {
  [ROLES.STUDENT]: { label: 'Profile & Resume', path: 'pages/student/profile.html', isAvailable: true },
  [ROLES.RECRUITER]: { label: 'Company Profile', path: 'pages/recruiter/company-profile.html', isAvailable: false },
};

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Logout through auth.js, then go to the documented destination (ARCHITECTURE.md §5). */
function handleLogout() {
  logout();
  setFlash('You have been logged out.', 'info');
  window.location.assign(toRoot(PAGE_PATHS.HOME));
}

function createUserMenuHeader(user) {
  const headerEl = createElement('div', 'user-menu__header');
  const nameEl = createElement('p', 'user-menu__full-name', user.name);
  const emailEl = createElement('p', 'user-menu__email', user.email);
  const badgesEl = createElement('div', 'flex flex-wrap gap-2');
  badgesEl.append(createElement('span', 'badge badge--primary', getLabel(user.role)));
  if (user.status === USER_STATUS.PENDING) {
    badgesEl.append(createElement('span', 'badge badge--status-pending', 'Awaiting approval'));
  }
  headerEl.append(nameEl, emailEl, badgesEl);
  return headerEl;
}

function createProfileMenuItem(role) {
  const item = PROFILE_MENU_ITEMS[role];
  if (!item) return null;
  const itemEl = createElement('li');
  if (item.isAvailable) {
    const linkEl = createElement('a', 'user-menu__item');
    linkEl.href = toRoot(item.path);
    linkEl.append(createIcon('user'), item.label);
    itemEl.append(linkEl);
  } else {
    const disabledEl = createElement('span', 'user-menu__item is-disabled');
    disabledEl.setAttribute('aria-disabled', 'true');
    const tagEl = createElement('span', 'tag-soon', 'Soon');
    disabledEl.append(createIcon('user'), item.label, ' ', tagEl);
    itemEl.append(disabledEl);
  }
  return itemEl;
}

function createUserMenu(user) {
  const menuEl = createElement('div', 'user-menu');

  const buttonEl = createElement('button', 'user-menu__button');
  buttonEl.type = 'button';
  buttonEl.setAttribute('aria-expanded', 'false');
  buttonEl.setAttribute('aria-controls', 'user-menu-panel');
  buttonEl.setAttribute('aria-label', `Account menu for ${user.name}`);
  const avatarEl = createElement('span', 'avatar', getInitials(user.name));
  avatarEl.setAttribute('aria-hidden', 'true');
  const nameEl = createElement('span', 'user-menu__name', user.name);
  nameEl.setAttribute('aria-hidden', 'true');
  buttonEl.append(avatarEl, nameEl, createIcon('chevronDown'));

  const panelEl = createElement('div', 'user-menu__panel');
  panelEl.id = 'user-menu-panel';
  panelEl.hidden = true;

  const listEl = createElement('ul', 'user-menu__list');
  listEl.setAttribute('role', 'list');
  const profileItemEl = createProfileMenuItem(user.role);
  if (profileItemEl) listEl.append(profileItemEl);

  const logoutItemEl = createElement('li');
  const logoutEl = createElement('button', 'user-menu__item');
  logoutEl.type = 'button';
  logoutEl.dataset.action = 'logout';
  logoutEl.append(createIcon('logOut'), 'Log out');
  logoutEl.addEventListener('click', handleLogout);
  logoutItemEl.append(logoutEl);
  listEl.append(logoutItemEl);

  panelEl.append(createUserMenuHeader(user), listEl);
  menuEl.append(buttonEl, panelEl);
  bindUserMenu(menuEl, buttonEl, panelEl);
  return menuEl;
}

/** Disclosure behaviour: toggle on click; close on Esc, outside click, or focus leaving the menu. */
function bindUserMenu(menuEl, buttonEl, panelEl) {
  const setOpen = (isOpen) => {
    panelEl.hidden = !isOpen;
    buttonEl.setAttribute('aria-expanded', String(isOpen));
    menuEl.classList.toggle('is-open', isOpen);
  };
  const isOpen = () => !panelEl.hidden;

  buttonEl.addEventListener('click', () => setOpen(!isOpen()));
  menuEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.stopPropagation();
      setOpen(false);
      buttonEl.focus();
    }
  });
  menuEl.addEventListener('focusout', (event) => {
    if (isOpen() && !menuEl.contains(event.relatedTarget)) setOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (isOpen() && !menuEl.contains(event.target)) setOpen(false);
  });
}

/**
 * Replace a mount element with the logged-in app header.
 * @param {HTMLElement} mountEl
 * @param {object} user current user from auth.getCurrentUser()
 * @param {{ sidebar?: { bindToggle: Function } }} [options] sidebar controller from renderSidebar()
 * @returns {HTMLElement}
 */
export function renderAppNavbar(mountEl, user, { sidebar } = {}) {
  const headerEl = createElement('header', 'app-header');

  const startEl = createElement('div', 'app-header__start');
  if (sidebar) {
    const toggleEl = createElement('button', 'icon-btn app-menu-toggle');
    toggleEl.type = 'button';
    toggleEl.setAttribute('aria-label', 'Open navigation menu');
    toggleEl.append(createIcon('menu'));
    sidebar.bindToggle(toggleEl);
    startEl.append(toggleEl);
  }
  const logoLinkEl = createLogoLink();
  logoLinkEl.href = toRoot(getPostLoginPath(user.role));
  startEl.append(logoLinkEl);

  const endEl = createElement('div', 'app-header__end');
  endEl.append(createUserMenu(user));

  headerEl.append(startEl, endEl);
  mountEl.replaceWith(headerEl);
  return headerEl;
}

/**
 * Show a changed name in the app header without reloading (e.g. after the student edits it on Profile).
 * @param {object} user updated public user
 */
export function updateNavbarUser(user) {
  const menuEl = document.querySelector('.app-header .user-menu');
  if (!menuEl) return;
  menuEl.querySelector('.user-menu__button').setAttribute('aria-label', `Account menu for ${user.name}`);
  menuEl.querySelector('.avatar').textContent = getInitials(user.name);
  menuEl.querySelector('.user-menu__name').textContent = user.name;
  menuEl.querySelector('.user-menu__full-name').textContent = user.name;
}
