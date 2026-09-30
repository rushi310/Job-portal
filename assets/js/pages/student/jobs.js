/**
 * jobs.js — Browse Jobs page (Phase 4; PROJECT_SPEC.md §3.2, UI_SPEC.md §5 "Browse Jobs").
 * Search (debounced), filters, sort, pagination, "Show expired", and a mobile filter drawer.
 * Filtering/sorting rules live in job-service.js; this file only manages page state and rendering.
 * State is kept for the current tab in sessionStorage (fh_job_filters) via storage.js.
 */

import {
  ROLES, STORAGE_KEYS, JOB_TYPES, WORK_MODES, JOB_SORT_OPTIONS, PAY_RANGES,
  JOBS_PER_PAGE, SEARCH_DEBOUNCE_MS,
} from '../../core/config.js';
import { getSession, setSession } from '../../core/storage.js';
import {
  getLabel, debounce, paginate, pluralize,
} from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { createIcon } from '../../components/icons.js';
import { keepFocusInside } from '../../components/modal.js';
import { createJobCard } from '../../components/job-card.js';
import { createEmptyState } from '../../components/empty-state.js';
import { renderPagination } from '../../components/pagination.js';
import { searchJobs, getJobFilterOptions, isJobExpired } from '../../services/job-service.js';

const DESKTOP_QUERY = window.matchMedia('(min-width: 1024px)');

const DEFAULT_STATE = Object.freeze({
  query: '',
  location: '',
  jobType: '',
  workMode: '',
  payRange: '',
  skills: [],
  includeExpired: false,
  sort: JOB_SORT_OPTIONS[0].value,
  page: 1,
});

/** Keys that count as "active filters" (search, sort and page are not filters). */
const FILTER_KEYS = ['location', 'jobType', 'workMode', 'payRange', 'skills', 'includeExpired'];

const $ = (selector) => document.querySelector(selector);
const searchFormEl = $('[data-search-form]');
const filterFormEl = $('[data-filter-form]');
const panelEl = $('[data-filter-panel]');
const backdropEl = $('[data-filter-backdrop]');
const openFiltersEl = $('[data-action="open-filters"]');
const resultsEl = $('[data-results]');
const countEl = $('[data-result-count]');
const paginationEl = $('[data-pagination]');

let state = { ...DEFAULT_STATE };
let filterOptions = { locations: [], skills: [] };

/* ---------- State ---------- */

/** Keep only values the page actually offers, so a stale or edited session value can't break it. */
function sanitizeState(saved) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const pick = (value, allowed) => (allowed.includes(value) ? value : '');
  const skills = Array.isArray(source.skills) ? source.skills : [];
  return {
    query: typeof source.query === 'string' ? source.query.slice(0, 100) : '',
    location: pick(source.location, filterOptions.locations),
    jobType: pick(source.jobType, Object.values(JOB_TYPES)),
    workMode: pick(source.workMode, Object.values(WORK_MODES)),
    payRange: pick(source.payRange, PAY_RANGES.map((range) => range.value)),
    skills: [...new Set(skills.filter((skill) => filterOptions.skills.includes(skill)))],
    includeExpired: source.includeExpired === true,
    sort: pick(source.sort, JOB_SORT_OPTIONS.map((option) => option.value)) || DEFAULT_STATE.sort,
    page: Number.isInteger(source.page) && source.page > 0 ? source.page : 1,
  };
}

function saveState() {
  setSession(STORAGE_KEYS.JOB_FILTERS, state);
}

function countActiveFilters() {
  return FILTER_KEYS.filter((key) => {
    const value = state[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }).length;
}

/** Apply a change, go back to page 1 (unless the page itself changed), re-render and remember. */
function updateState(changes) {
  state = { ...state, page: 1, ...changes };
  render();
  saveState();
}

/* ---------- Controls ---------- */

function fillSelect(selectEl, options) {
  selectEl.append(...options.map(({ value, label }) => new Option(label, value)));
}

function buildControls() {
  fillSelect($('[data-sort]'), JOB_SORT_OPTIONS);
  const optionSets = {
    locations: filterOptions.locations.map((value) => ({ value, label: value })),
    jobTypes: Object.values(JOB_TYPES).map((value) => ({ value, label: getLabel(value) })),
    workModes: Object.values(WORK_MODES).map((value) => ({ value, label: getLabel(value) })),
    payRanges: PAY_RANGES.map(({ value, label }) => ({ value, label })),
  };
  filterFormEl.querySelectorAll('select[data-options]').forEach((selectEl) => {
    fillSelect(selectEl, optionSets[selectEl.dataset.options]);
  });

  const skillListEl = $('[data-skill-list]');
  skillListEl.replaceChildren(...filterOptions.skills.map((skill, index) => {
    const labelEl = document.createElement('label');
    labelEl.className = 'form-check';
    const inputEl = document.createElement('input');
    inputEl.type = 'checkbox';
    inputEl.name = 'skills';
    inputEl.value = skill;
    inputEl.id = `filter-skill-${index}`;
    labelEl.append(inputEl, skill);
    return labelEl;
  }));

  $('.filter-panel__close').append(createIcon('close'));
}

/** Put the current state into the form controls (after restore or clear). */
function syncControls() {
  searchFormEl.elements.query.value = state.query;
  searchFormEl.elements.sort.value = state.sort;
  ['location', 'jobType', 'workMode', 'payRange'].forEach((name) => {
    filterFormEl.elements[name].value = state[name];
  });
  filterFormEl.querySelectorAll('input[name="skills"]').forEach((inputEl) => {
    inputEl.checked = state.skills.includes(inputEl.value);
  });
  $('[data-include-expired]').checked = state.includeExpired;
}

/* ---------- Rendering ---------- */

function renderEmptyState() {
  const hasCriteria = countActiveFilters() > 0 || state.query.trim() !== '';
  const emptyEl = createEmptyState({
    icon: 'search',
    title: 'No jobs found',
    message: hasCriteria
      ? 'Try different keywords or remove some filters.'
      : 'There are no open jobs right now. Please check back soon.',
  });
  if (hasCriteria) {
    const clearEl = document.createElement('button');
    clearEl.type = 'button';
    clearEl.className = 'btn btn--primary';
    clearEl.dataset.action = 'clear-filters';
    clearEl.textContent = 'Clear filters';
    emptyEl.append(clearEl);
  }
  resultsEl.replaceChildren(emptyEl);
}

function renderCount({ total, from, to }) {
  countEl.textContent = total === 0
    ? 'No jobs found'
    : `${pluralize(total, 'job')} found · showing ${from}–${to}`;
}

function renderActiveFilterCount() {
  const active = countActiveFilters();
  const badgeEl = $('[data-active-count]');
  badgeEl.hidden = active === 0;
  badgeEl.textContent = String(active);
  openFiltersEl.setAttribute('aria-label', active ? `Filters, ${active} active` : 'Filters');
}

function render() {
  try {
    const page = paginate(searchJobs(state), state.page, JOBS_PER_PAGE);
    state.page = page.page; // clamp an out-of-range page (e.g. restored from an older session)

    renderCount(page);
    if (page.total === 0) {
      renderEmptyState();
    } else {
      resultsEl.replaceChildren(...page.items.map((job) => createJobCard(job, { isExpired: isJobExpired(job) })));
    }
    renderPagination(paginationEl, {
      page: page.page,
      totalPages: page.totalPages,
      onChange: (newPage) => {
        updateState({ page: newPage });
        countEl.scrollIntoView({ block: 'start' });
      },
    });
  } catch (error) {
    console.error('jobs: could not render job results', error);
    countEl.textContent = '';
    paginationEl.replaceChildren();
    resultsEl.replaceChildren(createEmptyState({
      icon: 'alert',
      title: 'Jobs could not be loaded',
      message: 'Please reload the page. If the problem continues, reset the demo data.',
    }));
  }
  renderActiveFilterCount();
}

/* ---------- Filter drawer (below 1024px) ---------- */

function handleDrawerKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeFilters();
    return;
  }
  keepFocusInside(panelEl, event);
}

function openFilters() {
  if (DESKTOP_QUERY.matches) return;
  panelEl.classList.add('is-open');
  backdropEl.hidden = false;
  openFiltersEl.setAttribute('aria-expanded', 'true');
  document.body.classList.add('has-drawer');
  document.addEventListener('keydown', handleDrawerKeydown);
  $('[data-action="close-filters"]').focus();
}

function closeFilters({ restoreFocus = true } = {}) {
  if (!panelEl.classList.contains('is-open')) return;
  panelEl.classList.remove('is-open');
  backdropEl.hidden = true;
  openFiltersEl.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('has-drawer');
  document.removeEventListener('keydown', handleDrawerKeydown);
  if (restoreFocus) openFiltersEl.focus();
}

/* ---------- Events ---------- */

function clearFilters() {
  state = { ...DEFAULT_STATE };
  syncControls();
  render();
  saveState();
}

function bindEvents() {
  const runSearch = debounce((query) => updateState({ query }), SEARCH_DEBOUNCE_MS);
  searchFormEl.elements.query.addEventListener('input', (event) => runSearch(event.target.value));
  searchFormEl.addEventListener('submit', (event) => {
    event.preventDefault(); // Enter searches immediately
    updateState({ query: searchFormEl.elements.query.value });
  });
  searchFormEl.elements.sort.addEventListener('change', (event) => updateState({ sort: event.target.value }));

  filterFormEl.addEventListener('change', (event) => {
    const { name, value, checked } = event.target;
    if (name === 'skills') {
      const skills = checked ? [...state.skills, value] : state.skills.filter((skill) => skill !== value);
      updateState({ skills });
    } else if (name === 'includeExpired') {
      updateState({ includeExpired: checked });
    } else {
      updateState({ [name]: value });
    }
  });
  filterFormEl.addEventListener('submit', (event) => event.preventDefault());

  document.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl.dataset.action === 'clear-filters') clearFilters();
    if (actionEl.dataset.action === 'open-filters') openFilters();
    if (actionEl.dataset.action === 'close-filters') closeFilters();
  });
  backdropEl.addEventListener('click', () => closeFilters());
  window.addEventListener('resize', () => {
    if (DESKTOP_QUERY.matches) closeFilters({ restoreFocus: false });
  });
}

/* ---------- Start ---------- */

async function init() {
  const user = await initProtectedPage(ROLES.STUDENT);
  if (!user) return;

  try {
    filterOptions = getJobFilterOptions();
  } catch (error) {
    console.error('jobs: could not read filter options', error);
  }
  buildControls();
  state = sanitizeState(getSession(STORAGE_KEYS.JOB_FILTERS)); // restore this tab's last filters
  syncControls();
  bindEvents();
  render();
}

init();
