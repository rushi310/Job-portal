/**
 * sidebar.js — Role-based side navigation for logged-in pages (UI_SPEC.md §3.2–3.3).
 * Desktop (≥ 1024px): always visible. Smaller screens: off-canvas drawer opened from the navbar ☰ button.
 */

import { ROLES, ROLE_HOME_PATHS } from '../core/config.js';
import { toRoot, getLabel } from '../core/utils.js';
import { createIcon } from './icons.js';
import { keepFocusInside } from './modal.js';

/** Same breakpoint as layout.css (`lg`). */
const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Navigation per role (UI_SPEC.md §3.3; paths from ARCHITECTURE.md §3).
 * Set `isAvailable: true` in the phase that builds the page; until then the item shows as "Soon".
 * The page currently being viewed is always treated as available.
 */
export const NAV_ITEMS = Object.freeze({
  [ROLES.STUDENT]: [
    { label: 'Dashboard', path: ROLE_HOME_PATHS[ROLES.STUDENT], icon: 'home', isAvailable: true },
    { label: 'Browse Jobs', path: 'pages/student/jobs.html', icon: 'search', isAvailable: true },
    { label: 'My Applications', path: 'pages/student/applications.html', icon: 'fileText', isAvailable: false },
    { label: 'Saved Jobs', path: 'pages/student/saved-jobs.html', icon: 'bookmark', isAvailable: false },
    { label: 'Profile & Resume', path: 'pages/student/profile.html', icon: 'user', isAvailable: false },
    { label: 'Notifications', path: 'pages/shared/notifications.html', icon: 'bell', isAvailable: false },
  ],
  [ROLES.RECRUITER]: [
    { label: 'Dashboard', path: ROLE_HOME_PATHS[ROLES.RECRUITER], icon: 'home', isAvailable: true },
    { label: 'Post a Job', path: 'pages/recruiter/post-job.html', icon: 'plusSquare', isAvailable: false },
    { label: 'My Jobs', path: 'pages/recruiter/my-jobs.html', icon: 'briefcase', isAvailable: false },
    { label: 'Company Profile', path: 'pages/recruiter/company-profile.html', icon: 'building', isAvailable: false },
    { label: 'Notifications', path: 'pages/shared/notifications.html', icon: 'bell', isAvailable: false },
  ],
  [ROLES.ADMIN]: [
    { label: 'Dashboard', path: ROLE_HOME_PATHS[ROLES.ADMIN], icon: 'home', isAvailable: true },
    { label: 'Users', path: 'pages/admin/users.html', icon: 'users', isAvailable: false },
    { label: 'Jobs', path: 'pages/admin/jobs.html', icon: 'briefcase', isAvailable: false },
    { label: 'Announcements', path: 'pages/admin/announcements.html', icon: 'megaphone', isAvailable: false },
    { label: 'Reports', path: 'pages/admin/reports.html', icon: 'barChart', isAvailable: false },
    { label: 'Notifications', path: 'pages/shared/notifications.html', icon: 'bell', isAvailable: false },
  ],
});

/** True when a project path points at the page currently open (query string ignored). */
function isCurrentPage(path, currentPath) {
  return new URL(toRoot(path)).pathname === currentPath;
}

function createItemContent(item) {
  const labelEl = document.createElement('span');
  labelEl.className = 'sidebar-nav__label';
  const textEl = document.createElement('span');
  textEl.textContent = item.label;
  labelEl.append(createIcon(item.icon), textEl);
  return labelEl;
}

function createNavItem(item, currentPath) {
  const itemEl = document.createElement('li');
  const isCurrent = isCurrentPage(item.path, currentPath);

  if (item.isAvailable || isCurrent) {
    const linkEl = document.createElement('a');
    linkEl.className = 'sidebar-nav__link';
    linkEl.href = toRoot(item.path);
    linkEl.append(createItemContent(item));
    if (isCurrent) {
      linkEl.classList.add('is-active');
      linkEl.setAttribute('aria-current', 'page');
    }
    itemEl.append(linkEl);
    return itemEl;
  }

  // Page not built yet: readable by screen readers, but not a link and not focusable.
  const disabledEl = document.createElement('span');
  disabledEl.className = 'sidebar-nav__link is-disabled';
  disabledEl.setAttribute('aria-disabled', 'true');
  disabledEl.title = 'Coming soon';
  const tagEl = document.createElement('span');
  tagEl.className = 'tag-soon';
  tagEl.textContent = 'Soon';
  disabledEl.append(createItemContent(item), tagEl);
  itemEl.append(disabledEl);
  return itemEl;
}

function createSidebarElement(user, currentPath) {
  const sidebarEl = document.createElement('aside');
  sidebarEl.className = 'app-sidebar';
  sidebarEl.id = 'app-sidebar';

  const headerEl = document.createElement('div');
  headerEl.className = 'app-sidebar__header';
  const roleEl = document.createElement('p');
  roleEl.className = 'app-sidebar__role';
  roleEl.textContent = `${getLabel(user.role)} portal`;
  const closeEl = document.createElement('button');
  closeEl.type = 'button';
  closeEl.className = 'icon-btn app-sidebar__close';
  closeEl.setAttribute('aria-label', 'Close navigation menu');
  closeEl.append(createIcon('close'));
  headerEl.append(roleEl, closeEl);

  const navEl = document.createElement('nav');
  navEl.className = 'sidebar-nav';
  navEl.setAttribute('aria-label', `${getLabel(user.role)} navigation`);
  const listEl = document.createElement('ul');
  listEl.className = 'sidebar-nav__list';
  listEl.setAttribute('role', 'list');
  listEl.append(...(NAV_ITEMS[user.role] ?? []).map((item) => createNavItem(item, currentPath)));
  navEl.append(listEl);

  sidebarEl.append(headerEl, navEl);
  return { sidebarEl, closeEl };
}

/**
 * Replace a mount element with the sidebar (+ drawer backdrop).
 * @param {HTMLElement} mountEl
 * @param {object} user current user from auth.getCurrentUser()
 * @param {{ currentPath?: string }} [options] currentPath defaults to the page's own path
 * @returns {{ element: HTMLElement, open: Function, close: Function, isOpen: Function, bindToggle: Function }}
 */
export function renderSidebar(mountEl, user, { currentPath = window.location.pathname } = {}) {
  const { sidebarEl, closeEl } = createSidebarElement(user, currentPath);
  const backdropEl = document.createElement('div');
  backdropEl.className = 'app-backdrop';
  backdropEl.hidden = true;
  mountEl.replaceWith(sidebarEl, backdropEl);

  const desktopQuery = window.matchMedia(DESKTOP_QUERY);
  let toggleEl = null;

  const isOpen = () => sidebarEl.classList.contains('is-open');

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    keepFocusInside(sidebarEl, event);
  }

  function setOpenState(open) {
    sidebarEl.classList.toggle('is-open', open);
    backdropEl.hidden = !open;
    document.body.classList.toggle('has-drawer', open);
    toggleEl?.setAttribute('aria-expanded', String(open));
    if (open) {
      document.addEventListener('keydown', handleKeydown);
    } else {
      document.removeEventListener('keydown', handleKeydown);
    }
  }

  /** Open the drawer (small screens only) and move focus into it. */
  function open() {
    if (desktopQuery.matches || isOpen()) return;
    setOpenState(true);
    closeEl.focus();
  }

  /** Close the drawer; focus returns to the ☰ button unless told otherwise. */
  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    setOpenState(false);
    if (restoreFocus) toggleEl?.focus();
  }

  /** Connect the navbar's ☰ button. */
  function bindToggle(buttonEl) {
    toggleEl = buttonEl;
    toggleEl.setAttribute('aria-controls', sidebarEl.id);
    toggleEl.setAttribute('aria-expanded', 'false');
    toggleEl.addEventListener('click', () => (isOpen() ? close() : open()));
  }

  closeEl.addEventListener('click', () => close());
  backdropEl.addEventListener('click', () => close());
  sidebarEl.addEventListener('click', (event) => {
    if (event.target.closest('a')) close({ restoreFocus: false });
  });
  // Growing past the breakpoint (e.g. rotating a tablet) turns the drawer into the fixed sidebar.
  window.addEventListener('resize', () => {
    if (desktopQuery.matches) close({ restoreFocus: false });
  });

  return {
    element: sidebarEl, open, close, isOpen, bindToggle,
  };
}
