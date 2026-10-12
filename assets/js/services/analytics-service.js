/**
 * analytics-service.js — Charts and reports (PROJECT_SPEC §3.2–3.4).
 * The server counts everything from the database each time, limited to what the logged-in user
 * may see (a student's own applications, a recruiter's own jobs, the whole platform for an
 * admin). This module only adds display labels to those numbers and turns a report into CSV text.
 */

import {
  getLabel, formatDate, formatShortDate, formatMonth, toDateKey,
} from '../core/utils.js';
import * as api from '../core/api.js';

/** Add the display label to each `{ key, count, percent }` item from the server. */
export function withLabels(items = []) {
  return items.map((item) => ({ ...item, label: getLabel(item.key) }));
}

/** `{ total, items }` category counts with labels, safe for a missing value. */
export function toCategoryReport(category) {
  return { total: category?.total ?? 0, items: withLabels(category?.items) };
}

/** Status funnel with labels (`stages` instead of `items`). */
export function toFunnel(funnel) {
  return { total: funnel?.total ?? 0, stages: withLabels(funnel?.stages) };
}

/** Add axis and table labels to the time points ("Week of 5 Oct 2026" / "Oct 2026"). */
function toTimeline(timeline) {
  const unit = timeline?.unit === 'month' ? 'month' : 'week';
  return {
    unit,
    total: timeline?.total ?? 0,
    invalid: timeline?.invalid ?? 0,
    points: (timeline?.points ?? []).map((point) => ({
      ...point,
      label: unit === 'week' ? `Week of ${formatDate(point.key)}` : formatMonth(point.key),
      shortLabel: unit === 'week' ? formatShortDate(point.key) : formatMonth(point.key),
    })),
  };
}

/**
 * Platform report for the admin Reports page: users by role, jobs by status, applications by
 * status and applications over time (weekly while the data spans at most 16 weeks, then monthly).
 * @returns {Promise<{ ok: true, data: object } | { ok: false, code: string, error: string }>}
 */
export async function getPlatformReport() {
  const result = await api.get('/admin/reports');
  if (!result.ok) return result;
  const report = result.data;
  return {
    ok: true,
    data: {
      generatedAt: report.generatedAt,
      usersByRole: toCategoryReport(report.usersByRole),
      jobsByStatus: toCategoryReport(report.jobsByStatus),
      applicationsByStatus: toCategoryReport(report.applicationsByStatus),
      applicationsOverTime: toTimeline(report.applicationsOverTime),
    },
  };
}

/* ==========================================================================
   CSV export
   ========================================================================== */

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
 * CSV export of one report, built from a report the server returned to an admin.
 * @param {string} reportKey a key of REPORTS
 * @param {object} report from getPlatformReport()
 * @param {Date} [now]
 * @returns {{ fileName: string, content: string }|null} null for an unknown report or no data
 */
export function getReportCsv(reportKey, report, now = new Date()) {
  const definition = Object.hasOwn(REPORTS, reportKey) ? REPORTS[reportKey] : null;
  if (!definition || !report) return null;
  return {
    fileName: `freshhire-${reportKey}-${toDateKey(now)}.csv`,
    content: toCsv(definition.toRows(report)),
  };
}
