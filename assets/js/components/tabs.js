/**
 * tabs.js — Accessible tabs (UI_SPEC.md §4 "Tabs"; WAI-ARIA tabs pattern, automatic activation).
 * Markup contract: `[role="tablist"]` of `button[role="tab"][aria-controls]`, each controlling a
 * `[role="tabpanel"]`. Arrow keys, Home and End move between tabs; only the active tab is in the
 * Tab order. The active tab's panel id is mirrored in the URL hash so a link can open a given tab.
 */

/**
 * @param {HTMLElement} tablistEl
 * @param {{ onChange?: (panelId: string) => void }} [options]
 * @returns {{ select: (panelId: string, options?: { focus?: boolean }) => void }}
 */
export function initTabs(tablistEl, { onChange } = {}) {
  const tabEls = [...tablistEl.querySelectorAll('[role="tab"]')];
  const panelOf = (tabEl) => document.getElementById(tabEl.getAttribute('aria-controls'));

  function activate(tabEl, { focus = false, updateHash = true } = {}) {
    tabEls.forEach((otherEl) => {
      const isActive = otherEl === tabEl;
      otherEl.setAttribute('aria-selected', String(isActive));
      otherEl.tabIndex = isActive ? 0 : -1;
      panelOf(otherEl).hidden = !isActive;
    });
    if (focus) tabEl.focus();
    const panelId = tabEl.getAttribute('aria-controls');
    if (updateHash) window.history.replaceState(null, '', `#${panelId}`);
    onChange?.(panelId);
  }

  const findTab = (panelId) => tabEls.find((tabEl) => tabEl.getAttribute('aria-controls') === panelId);

  tablistEl.addEventListener('click', (event) => {
    const tabEl = event.target.closest('[role="tab"]');
    if (tabEl) activate(tabEl);
  });

  tablistEl.addEventListener('keydown', (event) => {
    const index = tabEls.indexOf(document.activeElement);
    if (index === -1) return;
    const targets = {
      ArrowRight: tabEls[(index + 1) % tabEls.length],
      ArrowLeft: tabEls[(index - 1 + tabEls.length) % tabEls.length],
      Home: tabEls[0],
      End: tabEls[tabEls.length - 1],
    };
    const targetEl = targets[event.key];
    if (!targetEl) return;
    event.preventDefault();
    activate(targetEl, { focus: true });
  });

  const initialTab = findTab(window.location.hash.slice(1)) ?? tabEls[0];
  activate(initialTab, { updateHash: false });

  return {
    select(panelId, { focus = false } = {}) {
      const tabEl = findTab(panelId);
      if (tabEl) activate(tabEl, { focus });
    },
  };
}
