/**
 * pagination.js — Prev / page numbers / Next (UI_SPEC.md §4 "Pagination").
 * Long ranges are shortened with "…" (first, last, and the pages around the current one).
 */

/** Page numbers to show, with null standing for a gap. */
function getPageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((n, index) => (index > 0 && n - sorted[index - 1] > 1 ? [null, n] : [n]));
}

function createPageButton(label, targetPage, { ariaLabel, isCurrent = false, disabled = false }) {
  const buttonEl = document.createElement('button');
  buttonEl.type = 'button';
  buttonEl.className = 'pagination__btn';
  buttonEl.textContent = label;
  buttonEl.dataset.page = String(targetPage);
  buttonEl.disabled = disabled;
  if (ariaLabel) buttonEl.setAttribute('aria-label', ariaLabel);
  if (isCurrent) buttonEl.setAttribute('aria-current', 'page');
  return buttonEl;
}

/**
 * Render pagination into a container (emptied when there is only one page).
 * @param {HTMLElement} containerEl
 * @param {{ page: number, totalPages: number, onChange: (page: number) => void }} options
 */
export function renderPagination(containerEl, { page, totalPages, onChange }) {
  if (totalPages <= 1) {
    containerEl.replaceChildren();
    return;
  }

  const navEl = document.createElement('nav');
  navEl.setAttribute('aria-label', 'Pagination');
  const listEl = document.createElement('ul');
  listEl.className = 'pagination';

  const items = [
    createPageButton('Prev', page - 1, { ariaLabel: 'Previous page', disabled: page === 1 }),
    ...getPageList(page, totalPages).map((n) => {
      if (n === null) {
        const gapEl = document.createElement('span');
        gapEl.className = 'pagination__gap';
        gapEl.textContent = '…';
        gapEl.setAttribute('aria-hidden', 'true');
        return gapEl;
      }
      return createPageButton(String(n), n, { ariaLabel: `Page ${n}`, isCurrent: n === page });
    }),
    createPageButton('Next', page + 1, { ariaLabel: 'Next page', disabled: page === totalPages }),
  ];
  items.forEach((itemEl) => {
    const listItemEl = document.createElement('li');
    listItemEl.append(itemEl);
    listEl.append(listItemEl);
  });

  navEl.append(listEl);
  navEl.addEventListener('click', (event) => {
    const buttonEl = event.target.closest('[data-page]');
    if (buttonEl && !buttonEl.disabled && !buttonEl.hasAttribute('aria-current')) {
      onChange(Number(buttonEl.dataset.page));
    }
  });
  containerEl.replaceChildren(navEl);
}
