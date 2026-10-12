/**
 * analytics-service.js — Counts for dashboards and reports (PROJECT_SPEC.md §3.2 – §3.4).
 * Everything is calculated from the database each time it is asked for; nothing derived is stored
 * and nothing is taken from the client. Each role gets only its own scope:
 * - student: status breakdown of their own applications;
 * - recruiter: applicants per own job and the status funnel of applications to own jobs;
 * - admin: platform report (users by role, jobs by status, applications by status and over time).
 */

const User = require('../models/user');
const Job = require('../models/job');
const Application = require('../models/application');
const {
  ROLES, USER_STATUS, JOB_STATUS, APPLICATION_STATUS, APPLICATION_PIPELINE, LIMITS,
} = require('../config/constants');
const { toZoned, isExpired } = require('../utils/dates');
const { countApplicationsByJob } = require('./job-service');
const { findRecruiterApplications, countByStatusForStudent } = require('./application-service');

/** Earliest application date accepted on the time chart; older dates are treated as invalid. */
const MIN_REPORT_YEAR = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole-number percentage, safe for a zero total: toPercent(1, 3) → 33, toPercent(0, 0) → 0. */
function toPercent(count, total) {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((count / total) * 100);
}

/** Turn { category: count } into ordered items with percentages (zero counts included). */
function toCategoryItems(countsByKey, categories) {
  const total = categories.reduce((sum, key) => sum + (countsByKey[key] ?? 0), 0);
  return {
    total,
    items: categories.map((key) => ({ key, count: countsByKey[key] ?? 0, percent: toPercent(countsByKey[key] ?? 0, total) })),
  };
}

/** Count a collection's documents per value of one field. */
async function countByField(Model, field) {
  const rows = await Model.aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}

/** Index of the furthest pipeline stage an application reached (0 = applied). */
function getFurthestStage(application) {
  const statuses = [application.status, ...(application.statusHistory ?? []).map((entry) => entry.status)];
  return Math.max(0, ...statuses.map((status) => APPLICATION_PIPELINE.indexOf(status)));
}

/**
 * Status funnel: how many applications reached each forward stage (BR-15). A rejected or
 * withdrawn application counts for every stage it passed.
 */
function getStatusFunnel(applications) {
  const furthest = applications.map(getFurthestStage);
  const total = applications.length;
  return {
    total,
    stages: APPLICATION_PIPELINE.map((key, index) => {
      const count = furthest.filter((stage) => stage >= index).length;
      return { key, count, percent: toPercent(count, total) };
    }),
  };
}

/* ---------- Time grouping (calendar dates in the application's time zone) ---------- */

const toKey = (zonedDate) => zonedDate.toISOString().slice(0, 10);
const startOfMonth = (zoned) => new Date(Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), 1));

function startOfWeek(zoned) {
  const day = Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate());
  return new Date(day - ((zoned.getUTCDay() + 6) % 7) * DAY_MS); // weeks start on Monday
}

function buildPeriodStarts(first, last, unit) {
  const starts = [];
  const cursor = unit === 'week' ? startOfWeek(first) : startOfMonth(first);
  while (cursor <= last) {
    starts.push(new Date(cursor));
    if (unit === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return starts;
}

/**
 * Count dates per week (Monday start) or per month, from the first date up to `now`, including
 * empty periods. Weekly while that is at most REPORT_MAX_WEEKLY_POINTS weeks, else monthly.
 * Missing, pre-2000 and future dates are counted in `invalid` instead of being placed on the line.
 * @returns {{ unit: 'week'|'month', total: number, invalid: number, points: Array<{ key: string, count: number }> }}
 */
function groupByPeriod(dates, now = new Date()) {
  const usable = dates
    .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()) && date <= now)
    .map(toZoned)
    .filter((zoned) => zoned.getUTCFullYear() >= MIN_REPORT_YEAR);
  const invalid = dates.length - usable.length;
  if (usable.length === 0) return { unit: 'week', total: 0, invalid, points: [] };

  const first = new Date(Math.min(...usable));
  const last = toZoned(now);
  const weeks = buildPeriodStarts(first, last, 'week');
  const unit = weeks.length <= LIMITS.REPORT_MAX_WEEKLY_POINTS ? 'week' : 'month';
  const starts = unit === 'week' ? weeks : buildPeriodStarts(first, last, 'month');
  const toStart = unit === 'week' ? startOfWeek : startOfMonth;

  const counts = new Map(starts.map((start) => [toKey(start), 0]));
  usable.forEach((zoned) => {
    const key = toKey(toStart(zoned));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return {
    unit,
    total: usable.length,
    invalid,
    points: starts.map((start) => ({ key: toKey(start), count: counts.get(toKey(start)) })),
  };
}

/* ---------- Per role ---------- */

/** Status breakdown of the student's own applications (every status listed, zero counts included). */
async function getStudentStatusBreakdown(student) {
  const { all, ...counts } = await countByStatusForStudent(student._id);
  return toCategoryItems(counts, Object.values(APPLICATION_STATUS));
}

/**
 * Job-level analytics for the recruiter: applicants per own job and the status funnel.
 * Pending recruiters cannot see applicants (BR-07), so their counts are empty.
 */
async function getRecruiterAnalytics(recruiter) {
  const isActive = recruiter.status === USER_STATUS.ACTIVE;
  const jobs = await Job.find({ recruiter: recruiter._id }).sort({ postedAt: -1, _id: -1 });
  const applications = isActive
    ? await findRecruiterApplications(recruiter._id, { select: 'job status statusHistory.status' })
    : [];
  const countsByJob = isActive ? await countApplicationsByJob(jobs.map((job) => job._id)) : new Map();
  return {
    isActive,
    totalApplicants: applications.length,
    jobs: jobs
      .map((job) => ({
        id: String(job._id),
        title: job.title,
        status: job.status,
        isExpired: isExpired(job.deadlineAt),
        count: countsByJob.get(String(job._id)) ?? 0,
      }))
      .sort((a, b) => b.count - a.count), // stable sort: equal counts stay newest first
    funnel: getStatusFunnel(applications),
  };
}

/**
 * Platform report for the admin Reports page. Counts every record, whatever its status (blocked
 * users, closed jobs, withdrawn applications included), so totals match the admin dashboard.
 */
async function getPlatformReport(now = new Date()) {
  const [usersByRole, jobsByStatus, applicationsByStatus, applications] = await Promise.all([
    countByField(User, 'role'),
    countByField(Job, 'status'),
    countByField(Application, 'status'),
    Application.find().select('appliedAt').lean(),
  ]);
  return {
    generatedAt: now,
    usersByRole: toCategoryItems(usersByRole, Object.values(ROLES)),
    jobsByStatus: toCategoryItems(jobsByStatus, Object.values(JOB_STATUS)),
    applicationsByStatus: toCategoryItems(applicationsByStatus, Object.values(APPLICATION_STATUS)),
    applicationsOverTime: groupByPeriod(applications.map((application) => application.appliedAt), now),
  };
}

module.exports = {
  toPercent,
  toCategoryItems,
  countByField,
  getStatusFunnel,
  groupByPeriod,
  getStudentStatusBreakdown,
  getRecruiterAnalytics,
  getPlatformReport,
};
