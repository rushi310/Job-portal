/**
 * analytics-service.js — Counts for the Phase 11 charts and reports (PROJECT_SPEC §3.2–3.4).
 * Everything is calculated from the stored records each time it is asked for; nothing derived is
 * ever stored. Each role gets only its own scope, and the user always comes from the session:
 * - student: status breakdown of their own applications;
 * - recruiter: applicants per own job and the status funnel of applications to own jobs;
 * - admin: platform report (users by role, jobs by status, applications by status and over time)
 *   and its CSV export text.
 * Pure helpers (percentages, counting, time grouping, CSV) are exported so they can be tested alone.
 */

import {
  STORAGE_KEYS, ROLES, JOB_STATUS, APPLICATION_STATUS, APPLICATION_PIPELINE, REPORT_MAX_WEEKLY_POINTS,
} from '../core/config.js';
import { getLocal } from '../core/storage.js';
import {
  parseDate, getLabel, formatDate, formatShortDate, formatMonth, toDateKey,
} from '../core/utils.js';
import { getCurrentUser } from '../core/auth.js';
import { getApplicationsByStudent, getApplicationsForRecruiter } from './application-service.js';
import { getOwnJobs, isJobExpired, isActiveRecruiter } from './job-service.js';

/** Key and label used for records whose value is missing or not one of the known categories. */
export const OTHER_CATEGORY = Object.freeze({ key: 'other', label: 'Other / unknown' });

/** Earliest application date accepted on the time chart; older dates are treated as invalid. */
const MIN_REPORT_YEAR = 2000;

/* ==========================================================================
   Pure helpers
   ========================================================================== */

/**
 * Whole-number percentage, safe for a zero total: toPercent(1, 3) → 33, toPercent(0, 0) → 0.
 * @param {number} count
 * @param {number} total
 * @returns {number}
 */
export function toPercent(count, total) {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((count / total) * 100);
}

/**
 * Count records per category, in the given category order (zero counts included).
 * Records whose value is not a known category are counted once under "Other / unknown" (shown only
 * when there are some), so the counts always add up to the number of records.
 * @param {Array<object>} records
 * @param {string} field e.g. 'status'
 * @param {Array<string>} categories
 * @returns {{ total: number, items: Array<{ key: string, label: string, count: number, percent: number }> }}
 */
export function countByCategory(records, field, categories) {
  const counts = new Map(categories.map((category) => [category, 0]));
  let otherCount = 0;
  records.forEach((record) => {
    const value = record?.[field];
    if (counts.has(value)) counts.set(value, counts.get(value) + 1);
    else otherCount += 1;
  });
  const total = records.length;
  const items = categories.map((category) => ({
    key: category,
    label: getLabel(category),
    count: counts.get(category),
    percent: toPercent(counts.get(category), total),
  }));
  if (otherCount > 0) {
    items.push({ ...OTHER_CATEGORY, count: otherCount, percent: toPercent(otherCount, total) });
  }
  return { total, items };
}

/** Index of the furthest pipeline stage an application reached (0 = applied). */
function getFurthestStage(application) {
  const history = Array.isArray(application?.statusHistory) ? application.statusHistory : [];
  const statuses = [application?.status, ...history.map((entry) => entry?.status)];
  return Math.max(0, ...statuses.map((status) => APPLICATION_PIPELINE.indexOf(status)));
}

/**
 * Status funnel: how many applications reached each forward stage (BR-15), using the current status
 * and the status history. A rejected or withdrawn application counts for every stage it passed.
 * @param {Array<object>} applications
 * @returns {{ total: number, stages: Array<{ key: string, label: string, count: number, percent: number }> }}
 */
export function getStatusFunnel(applications) {
  const furthest = applications.map(getFurthestStage);
  const total = applications.length;
  return {
    total,
    stages: APPLICATION_PIPELINE.map((status, index) => {
      const count = furthest.filter((stage) => stage >= index).length;
      return { key: status, label: getLabel(status), count, percent: toPercent(count, total) };
    }),
  };
}

function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // weeks start on Monday
  return start;
}

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

function buildPeriodStarts(first, last, unit) {
  const starts = [];
  const cursor = unit === 'week' ? startOfWeek(first) : startOfMonth(first);
  while (cursor <= last) {
    starts.push(new Date(cursor));
    if (unit === 'week') cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return starts;
}

/**
 * Count dates per week (Monday start) or per month, from the first date up to `now`, including
 * periods with no records. Weekly while that is at most REPORT_MAX_WEEKLY_POINTS weeks, else monthly.
 * Missing, unreadable, pre-2000 and future dates are not placed on the timeline; they are counted
 * in `invalid`.
 * @param {Array<string>} values ISO date strings
 * @param {Date} [now]
 * @returns {{ unit: 'week'|'month', total: number, invalid: number,
 *   points: Array<{ key: string, label: string, shortLabel: string, count: number }> }}
 */
export function groupByPeriod(values, now = new Date()) {
  const dates = [];
  let invalid = 0;
  values.forEach((value) => {
    const date = typeof value === 'string' ? parseDate(value) : new Date(NaN);
    const isUsable = !Number.isNaN(date.getTime()) && date.getFullYear() >= MIN_REPORT_YEAR && date <= now;
    if (isUsable) dates.push(date);
    else invalid += 1;
  });
  if (dates.length === 0) return { unit: 'week', total: 0, invalid, points: [] };

  const first = new Date(Math.min(...dates));
  const weeks = buildPeriodStarts(first, now, 'week');
  const unit = weeks.length <= REPORT_MAX_WEEKLY_POINTS ? 'week' : 'month';
  const starts = unit === 'week' ? weeks : buildPeriodStarts(first, now, 'month');
  const toStart = unit === 'week' ? startOfWeek : startOfMonth;

  const counts = new Map(starts.map((start) => [toDateKey(start), 0]));
  dates.forEach((date) => {
    const key = toDateKey(toStart(date));
    counts.set(key, counts.get(key) + 1);
  });
  return {
    unit,
    total: dates.length,
    invalid,
    points: starts.map((start) => ({
      key: toDateKey(start),
      label: unit === 'week' ? `Week of ${formatDate(start)}` : formatMonth(start),
      shortLabel: unit === 'week' ? formatShortDate(start) : formatMonth(start),
      count: counts.get(toDateKey(start)),
    })),
  };
}

/** One CSV cell: quoted when needed; text that a spreadsheet would run as a formula is prefixed with '. */
function toCsvCell(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV text (RFC 4180: comma separated, CRLF line ends). Starts with a UTF-8 byte order mark so
 * spreadsheet applications read "₹" and other non-ASCII characters correctly.
 * @param {Array<Array<string|number>>} rows first row = column headings
 * @returns {string}
 */
export function toCsv(rows) {
  return `﻿${rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n')}\r\n`;
}

/* ==========================================================================
   Student
   ========================================================================== */

/**
 * Status breakdown of the logged-in student's own applications (PROJECT_SPEC §3.2, Phase 11).
 * Every status is listed (zero counts included); withdrawn applications are shown as "Withdrawn".
 * @returns {{ total: number, items: Array<object> }|null} null unless a student is logged in
 */
export function getStudentStatusBreakdown() {
  const user = getCurrentUser();
  if (user?.role !== ROLES.STUDENT) return null;
  return countByCategory(getApplicationsByStudent(user.id), 'status', Object.values(APPLICATION_STATUS));
}

/* ==========================================================================
   Recruiter
   ========================================================================== */

/**
 * Job-level analytics for the logged-in recruiter (PROJECT_SPEC §3.3, Phase 11): applicants per own
 * job and the status funnel. Ownership is `application.jobId` → `job.recruiterId` (same rule as the
 * Applicants page). Pending recruiters cannot open applicants (BR-07), so their counts are empty.
 * @returns {object|null} null unless a recruiter is logged in
 */
export function getRecruiterAnalytics() {
  const user = getCurrentUser();
  if (user?.role !== ROLES.RECRUITER) return null;
  const isActive = isActiveRecruiter(user);
  const jobs = getOwnJobs();
  const applications = isActive ? getApplicationsForRecruiter() : [];

  const countsByJob = new Map();
  applications.forEach((application) => {
    countsByJob.set(application.jobId, (countsByJob.get(application.jobId) ?? 0) + 1);
  });
  const jobItems = jobs
    .map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      isExpired: isJobExpired(job),
      count: countsByJob.get(job.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count); // stable sort: equal counts stay newest first

  return {
    isActive,
    totalApplicants: applications.length,
    jobs: jobItems,
    funnel: getStatusFunnel(applications),
  };
}

/* ==========================================================================
   Admin
   ========================================================================== */

const readArray = (key) => {
  const value = getLocal(key, []);
  return Array.isArray(value) ? value.filter(Boolean) : [];
};

const isAdmin = () => getCurrentUser()?.role === ROLES.ADMIN;

/**
 * Platform report for the admin Reports page (PROJECT_SPEC §3.4, UI_SPEC §5 "Reports").
 * Counts every stored record, whatever its status (blocked users, closed jobs, withdrawn
 * applications included), so totals match the admin dashboard.
 * @param {Date} [now]
 * @returns {object|null} null unless an admin is logged in
 */
export function getPlatformReport(now = new Date()) {
  if (!isAdmin()) return null;
  const applications = readArray(STORAGE_KEYS.APPLICATIONS);
  return {
    generatedAt: now.toISOString(),
    usersByRole: countByCategory(readArray(STORAGE_KEYS.USERS), 'role', Object.values(ROLES)),
    jobsByStatus: countByCategory(readArray(STORAGE_KEYS.JOBS), 'status', Object.values(JOB_STATUS)),
    applicationsByStatus: countByCategory(applications, 'status', Object.values(APPLICATION_STATUS)),
    applicationsOverTime: groupByPeriod(applications.map((application) => application.appliedAt), now),
  };
}

function categoryRows(heading, countHeading, { total, items }) {
  return [
    [heading, countHeading, 'Percent'],
    ...items.map((item) => [item.label, item.count, `${item.percent}%`]),
    ['Total', total, total > 0 ? '100%' : '0%'],
  ];
}

function timelineRows({ unit, total, invalid, points }) {
  const rows = [
    [unit === 'week' ? 'Week starting' : 'Month', 'Applications'],
    ...points.map((point) => [unit === 'week' ? point.key : point.key.slice(0, 7), point.count]),
  ];
  if (invalid > 0) rows.push(['Date missing or invalid', invalid]);
  rows.push(['Total', total + invalid]);
  return rows;
}

/** The reports that can be exported, in page order. */
export const REPORTS = Object.freeze({
  'users-by-role': { title: 'Users by role', toRows: (report) => categoryRows('Role', 'Users', report.usersByRole) },
  'jobs-by-status': { title: 'Jobs by status', toRows: (report) => categoryRows('Status', 'Jobs', report.jobsByStatus) },
  'applications-by-status': {
    title: 'Applications by status',
    toRows: (report) => categoryRows('Status', 'Applications', report.applicationsByStatus),
  },
  'applications-over-time': {
    title: 'Applications over time',
    toRows: (report) => timelineRows(report.applicationsOverTime),
  },
});

/**
 * CSV export of one report (admin only), built from the current stored data.
 * @param {string} reportKey a key of REPORTS
 * @param {Date} [now]
 * @returns {{ fileName: string, content: string }|null} null for a non-admin or an unknown report
 */
export function getReportCsv(reportKey, now = new Date()) {
  const definition = Object.hasOwn(REPORTS, reportKey) ? REPORTS[reportKey] : null;
  const report = definition ? getPlatformReport(now) : null;
  if (!report) return null;
  return {
    fileName: `freshhire-${reportKey}-${toDateKey(now)}.csv`,
    content: toCsv(definition.toRows(report)),
  };
}
