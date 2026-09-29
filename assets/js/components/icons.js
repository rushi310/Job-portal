/**
 * icons.js — Inline SVG icon set (no icon fonts or libraries, see UI_SPEC.md §8).
 * The markup below is static and trusted; never build icons from user data.
 */

const PATHS = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  mapPin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 13h2M3 10h18"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  laptop: '<rect x="4" y="5" width="16" height="11" rx="1"/><path d="M2 19h20"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  userPlus: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  graduation: '<path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6l2-8z"/>',
  alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
};

/**
 * SVG markup string for an icon (decorative: hidden from screen readers).
 * @param {keyof PATHS} name
 */
export function iconSvg(name) {
  const paths = PATHS[name] ?? PATHS.info;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/** Icon as a DOM element. */
export function createIcon(name) {
  const template = document.createElement('template');
  template.innerHTML = iconSvg(name).trim();
  return template.content.firstElementChild;
}
