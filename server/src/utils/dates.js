/**
 * dates.js — Date helpers in the application's time zone (APP_TIMEZONE_OFFSET_MINUTES).
 * Job deadlines are calendar dates ("YYYY-MM-DD"); a deadline day lasts until 23:59:59 in that
 * time zone, wherever the server itself runs (Render uses UTC).
 */

const { config } = require('../config/env');

const OFFSET_MS = config.timezoneOffsetMinutes * 60 * 1000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A Date whose UTC fields show the wall-clock time in the application's time zone. */
const toZoned = (date) => new Date(date.getTime() + OFFSET_MS);

/** Is this a real calendar date written as "YYYY-MM-DD"? */
function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The last millisecond of a "YYYY-MM-DD" day in the application's time zone, or null. */
function endOfDay(dateKey) {
  if (!isValidDateKey(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - OFFSET_MS);
}

/** Calendar date ("YYYY-MM-DD") of a moment in the application's time zone. */
function toDateKey(date) {
  return toZoned(date).toISOString().slice(0, 10);
}

const todayKey = (now = new Date()) => toDateKey(now);
const currentYear = (now = new Date()) => toZoned(now).getUTCFullYear();

/** BR-12: a job is expired once its deadline day has fully passed (no deadline counts as expired). */
function isExpired(deadlineAt, now = new Date()) {
  return !(deadlineAt instanceof Date) || Number.isNaN(deadlineAt.getTime()) || deadlineAt.getTime() < now.getTime();
}

module.exports = { toZoned, isValidDateKey, endOfDay, toDateKey, todayKey, currentYear, isExpired };
