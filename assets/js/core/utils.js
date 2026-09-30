/**
 * utils.js — Small, dependency-free helpers shared across FreshHire.
 * No DOM rendering and no storage access here.
 */

import { LABELS, SALARY_PERIODS } from './config.js';

/** Project root URL, derived from this file's location (assets/js/core/utils.js). */
const ROOT_URL = new URL('../../../', import.meta.url);

/**
 * Resolve a project-root-relative path (e.g. "data/jobs.json") to a full URL.
 * Works under any base path (Live Server, sub-folder, GitHub Pages).
 * @param {string} path
 * @returns {string}
 */
export function toRoot(path = '') {
  return new URL(path, ROOT_URL).href;
}

/**
 * Create a unique id such as "job_lx2k9a_4f7".
 * @param {string} prefix one of usr, job, app, ntf
 */
export function generateId(prefix) {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 5);
  return `${prefix}_${time}_${random}`;
}

/** Escape text for safe use inside HTML strings. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Display label for a stored code; falls back to the code itself. */
export function getLabel(code) {
  return LABELS[code] ?? code;
}

/**
 * Parse a date. Plain "YYYY-MM-DD" strings are treated as local dates (not UTC)
 * so deadlines don't shift by a day in Indian time.
 */
export function parseDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format as "29 Sep 2026" (fixed format, independent of browser locale quirks). */
export function formatDate(value) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Format as relative time: "just now", "5 min ago", "2 days ago", or a date if older. */
export function formatRelativeTime(value) {
  const date = parseDate(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return '';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

/**
 * True if the given "YYYY-MM-DD" deadline has fully passed (the whole deadline day counts).
 * @param {string} dateString
 */
export function isDeadlinePassed(dateString) {
  const endOfDay = parseDate(dateString);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime() < Date.now();
}

/** Whole days from today until the given date (negative if past). */
export function daysUntil(dateString) {
  const target = parseDate(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

const inrFormatter = new Intl.NumberFormat('en-IN');

/**
 * Format a job's pay (UI_SPEC.md §6):
 * yearly  → "₹3.0 – 4.5 LPA", monthly → "₹15,000 /month" or "₹10,000 – 15,000 /month".
 */
export function formatSalary(job) {
  const { salaryMin, salaryMax, salaryPeriod } = job;
  if (!salaryMin && !salaryMax) return 'Not disclosed';

  if (salaryPeriod === SALARY_PERIODS.MONTH) {
    const range = salaryMin === salaryMax || !salaryMax
      ? inrFormatter.format(salaryMin)
      : `${inrFormatter.format(salaryMin)} – ${inrFormatter.format(salaryMax)}`;
    return `₹${range} /month`;
  }

  const toLakh = (amount) => (amount / 100000).toFixed(1);
  const range = salaryMin === salaryMax || !salaryMax
    ? toLakh(salaryMin)
    : `${toLakh(salaryMin)} – ${toLakh(salaryMax)}`;
  return `₹${range} LPA`;
}

/** "Asha Patil" → "AP"; "TechNova Pvt Ltd" → "TP". */
export function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/** Delay calls until `wait` ms have passed without another call. */
export function debounce(fn, wait = 300) {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), wait);
  };
}

/** Read a query-string parameter from the current URL. */
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/** Basic email format check (not a full RFC validator). */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
}

/** Password rule BR-02: ≥ 8 chars, one uppercase, one lowercase, one digit. */
export function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(password));
}

/**
 * Split a list into pages. The page number is clamped into range.
 * @param {Array} items
 * @param {number} page 1-based
 * @param {number} perPage
 * @returns {{ items: Array, page: number, totalPages: number, total: number, from: number, to: number }}
 *   from/to are 1-based positions of the first/last item shown (0 when empty)
 */
export function paginate(items, page, perPage) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, Math.trunc(Number(page)) || 1), totalPages);
  const start = (currentPage - 1) * perPage;
  const pageItems = items.slice(start, start + perPage);
  return {
    items: pageItems,
    page: currentPage,
    totalPages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + pageItems.length,
  };
}

/** Pluralise a simple English noun: pluralize(1, 'job') → "1 job". */
export function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
