/**
 * text.js — Small string helpers shared by validators and services.
 * Request values are always turned into trimmed strings before use, so an object or array sent in
 * place of a string can never reach a MongoDB query as an operator.
 */

/** Any value → trimmed string ('' for null / undefined; objects never pass through). */
function text(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

const isBlank = (value) => text(value) === '';
const list = (value) => (Array.isArray(value) ? value : []);

/** Emails are compared case-insensitively and without surrounding spaces (BR-01). */
function normalizeEmail(email) {
  return text(email).toLowerCase();
}

/** Escape text so it can be used literally inside a RegExp. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" pattern for a user-typed word. */
const containsPattern = (word) => new RegExp(escapeRegex(word), 'i');
/** Case-insensitive exact-match pattern. */
const exactPattern = (value) => new RegExp(`^${escapeRegex(value)}$`, 'i');

/** "  Front   end  dev " → ['front', 'end', 'dev'] */
function toWords(value, maxLength = 100) {
  return text(value).slice(0, maxLength).toLowerCase().split(/\s+/).filter(Boolean);
}

/** Distinct values ignoring letter case, first spelling kept, sorted A–Z. */
function uniqueSorted(values) {
  const byKey = new Map();
  values.forEach((value) => {
    const key = text(value).replace(/\s+/g, ' ').toLowerCase();
    if (key && !byKey.has(key)) byKey.set(key, text(value));
  });
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

module.exports = {
  text, isBlank, list, normalizeEmail, escapeRegex, containsPattern, exactPattern, toWords, uniqueSorted,
};
