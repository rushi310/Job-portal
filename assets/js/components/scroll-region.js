/**
 * scroll-region.js — Wide tables that scroll sideways inside their box (Phase 12, UI_SPEC §4 "Table").
 * While the table is wider than its wrapper, the wrapper becomes a named, keyboard-focusable region
 * (so it can be scrolled with the arrow keys) and gets `has-more-left` / `has-more-right` classes that
 * fade the edge with hidden columns. When everything fits (desktop, or stacked cards on phones), it is
 * a plain box with no extra tab stop. One debounced window resize listener serves every region.
 */

const RESIZE_DEBOUNCE_MS = 150;
const regions = new Map(); // wrapper element → accessible name
let resizeTimer = 0;
let isListeningForResize = false;

function updateEdges(wrapperEl) {
  const maxScroll = wrapperEl.scrollWidth - wrapperEl.clientWidth;
  wrapperEl.classList.toggle('has-more-left', maxScroll > 1 && wrapperEl.scrollLeft > 1);
  wrapperEl.classList.toggle('has-more-right', maxScroll > 1 && wrapperEl.scrollLeft < maxScroll - 1);
}

function updateRegion(wrapperEl, label) {
  const isScrollable = wrapperEl.scrollWidth > wrapperEl.clientWidth + 1;
  if (isScrollable) {
    wrapperEl.setAttribute('role', 'region');
    wrapperEl.setAttribute('aria-label', `${label} (scroll sideways to see every column)`);
    wrapperEl.tabIndex = 0;
  } else {
    wrapperEl.removeAttribute('role');
    wrapperEl.removeAttribute('aria-label');
    wrapperEl.removeAttribute('tabindex');
  }
  updateEdges(wrapperEl);
}

function updateAllRegions() {
  regions.forEach((label, wrapperEl) => {
    if (wrapperEl.isConnected) updateRegion(wrapperEl, label);
    else regions.delete(wrapperEl); // the list was re-rendered; forget the old table
  });
}

function handleWindowResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateAllRegions, RESIZE_DEBOUNCE_MS);
}

/**
 * Register a `.table-wrapper` whose table may be wider than the screen.
 * Call it while building the table; the check runs once the wrapper is on the page.
 * @param {HTMLElement} wrapperEl
 * @param {string} label what the table shows, e.g. "Your jobs"
 */
export function watchScrollRegion(wrapperEl, label) {
  regions.set(wrapperEl, label);
  wrapperEl.addEventListener('scroll', () => updateEdges(wrapperEl), { passive: true });
  // The caller appends the wrapper right after this returns, in the same task.
  queueMicrotask(() => updateRegion(wrapperEl, label));
  if (!isListeningForResize) {
    window.addEventListener('resize', handleWindowResize);
    isListeningForResize = true;
  }
}
