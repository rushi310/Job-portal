/**
 * job-service.js — Business logic for jobs.
 * Phase 1: read-only getters used by the landing page. Phase 3: skill-based recommendations.
 * Search/filter (Phase 4) and create/update/approve (Phases 8–9) are added later.
 */

import {
  STORAGE_KEYS, JOB_STATUS, JOB_TYPES, WORK_MODES, SALARY_PERIODS, PAY_RANGES,
} from '../core/config.js';
import { getLocal } from '../core/storage.js';
import { isDeadlinePassed, parseDate } from '../core/utils.js';

/** Records without an id/title/company can't be shown safely, so they are skipped. */
function isUsableJob(job) {
  return Boolean(job) && typeof job.id === 'string' && typeof job.title === 'string'
    && typeof job.companyName === 'string';
}

/** @returns {Array<object>} every usable job in storage */
export function getAllJobs() {
  const jobs = getLocal(STORAGE_KEYS.JOBS, []);
  return Array.isArray(jobs) ? jobs.filter(isUsableJob) : [];
}

/** @returns {object|null} */
export function getJobById(jobId) {
  return getAllJobs().find((job) => job.id === jobId) ?? null;
}

/** Expiry is computed from the deadline, never stored (BR-12). A missing/invalid deadline counts as expired. */
export function isJobExpired(job) {
  if (Number.isNaN(parseDate(job.deadline).getTime())) return true;
  return isDeadlinePassed(job.deadline);
}

/** Newest first by posting date. */
function byNewest(a, b) {
  return parseDate(b.postedAt) - parseDate(a.postedAt);
}

/**
 * Jobs visible to students (BR-08): approved only.
 * @param {{ includeExpired?: boolean }} options
 */
export function getApprovedJobs({ includeExpired = false } = {}) {
  return getAllJobs()
    .filter((job) => job.status === JOB_STATUS.APPROVED)
    .filter((job) => includeExpired || !isJobExpired(job))
    .sort(byNewest);
}

/** Latest approved, non-expired jobs for the landing page. */
export function getFeaturedJobs(limit) {
  return getApprovedJobs().slice(0, limit);
}

const normalizeSkill = (skill) => String(skill).trim().toLowerCase();

/**
 * Jobs recommended for a student (UI_SPEC.md §5 "Student Dashboard": recommended jobs by skill match).
 * Only approved, non-expired jobs the student has not applied to. Ranked by number of matching
 * skills, then newest. If nothing matches (e.g. no skills on the profile yet), the latest open jobs
 * are returned instead and `isSkillBased` is false.
 * @param {{ skills?: string[], excludeJobIds?: string[], limit?: number }} options
 * @returns {{ items: Array<{ job: object, matchedSkills: string[] }>, isSkillBased: boolean }}
 */
export function getRecommendedJobs({ skills = [], excludeJobIds = [], limit = 3 } = {}) {
  const studentSkills = new Set(skills.map(normalizeSkill));
  const excluded = new Set(excludeJobIds);
  const candidates = getApprovedJobs().filter((job) => !excluded.has(job.id));

  const matched = candidates
    .map((job) => ({
      job,
      matchedSkills: (Array.isArray(job.skills) ? job.skills : [])
        .filter((skill) => studentSkills.has(normalizeSkill(skill))),
    }))
    .filter((item) => item.matchedSkills.length > 0)
    .sort((a, b) => b.matchedSkills.length - a.matchedSkills.length || byNewest(a.job, b.job));

  if (matched.length > 0) return { items: matched.slice(0, limit), isSkillBased: true };
  return {
    items: candidates.slice(0, limit).map((job) => ({ job, matchedSkills: [] })),
    isSkillBased: false,
  };
}

/* ==========================================================================
   Job search (Phase 4) — pure functions over derived arrays; stored jobs are never modified
   ========================================================================== */

const normalizeText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const skillsOf = (job) => (Array.isArray(job.skills) ? job.skills : []);

/** Search covers title, company and skills (DEVELOPMENT_PHASES.md Phase 4); every word must appear. */
function matchesQuery(job, words) {
  if (words.length === 0) return true;
  const text = [job.title, job.companyName, ...skillsOf(job)].map(normalizeText).join(' | ');
  return words.every((word) => text.includes(word));
}

function matchesLocation(job, location) {
  return !location || normalizeText(job.location) === normalizeText(location);
}

function getPayBounds(job) {
  const min = Number(job.salaryMin) || 0;
  const max = Math.max(Number(job.salaryMax) || min, min);
  return { min, max };
}

/** Pay range filter: same pay period and overlapping amounts; undisclosed pay never matches a range. */
function matchesPayRange(job, rangeValue) {
  const range = PAY_RANGES.find((item) => item.value === rangeValue);
  if (!range) return true;
  const { min, max } = getPayBounds(job);
  return job.salaryPeriod === range.period && min > 0 && min <= range.max && max >= range.min;
}

/** Skills filter: the job must list every selected skill (case-insensitive). */
function matchesSkills(job, skills) {
  if (skills.length === 0) return true;
  const jobSkills = new Set(skillsOf(job).map(normalizeText));
  return skills.every((skill) => jobSkills.has(normalizeText(skill)));
}

/** Monthly stipends are compared with yearly salaries as ×12; undisclosed pay sorts last. */
function annualPay(job) {
  const { max } = getPayBounds(job);
  return job.salaryPeriod === SALARY_PERIODS.MONTH ? max * 12 : max;
}

function byDeadline(a, b) {
  const difference = parseDate(a.deadline) - parseDate(b.deadline);
  return (Number.isNaN(difference) ? 0 : difference) || byNewest(a, b);
}

const SORTERS = {
  newest: byNewest,
  deadline: byDeadline,
  salary: (a, b) => annualPay(b) - annualPay(a) || byNewest(a, b),
};

/**
 * Search, filter and sort the jobs students can see (approved; expired only if requested).
 * All criteria combine with AND. Returns a new array.
 * @param {object} criteria
 * @param {string} [criteria.query] words to find in title / company / skills
 * @param {string} [criteria.location] exact location (case-insensitive)
 * @param {string} [criteria.jobType] a JOB_TYPES value
 * @param {string} [criteria.workMode] a WORK_MODES value
 * @param {string} [criteria.payRange] a PAY_RANGES value
 * @param {string[]} [criteria.skills] required skills
 * @param {boolean} [criteria.includeExpired] "Show expired" (BR-12)
 * @param {string} [criteria.sort] a JOB_SORT_OPTIONS value (default newest)
 * @returns {Array<object>}
 */
export function searchJobs({
  query = '', location = '', jobType = '', workMode = '', payRange = '',
  skills = [], includeExpired = false, sort = 'newest',
} = {}) {
  const words = normalizeText(query).split(' ').filter(Boolean);
  return getApprovedJobs({ includeExpired })
    .filter((job) => matchesQuery(job, words))
    .filter((job) => matchesLocation(job, location))
    .filter((job) => !jobType || job.jobType === jobType)
    .filter((job) => !workMode || job.workMode === workMode)
    .filter((job) => matchesPayRange(job, payRange))
    .filter((job) => matchesSkills(job, skills))
    .sort(SORTERS[sort] ?? SORTERS.newest);
}

/** Distinct values, case-insensitive, keeping the first spelling seen; sorted A–Z. */
function uniqueSorted(values) {
  const byKey = new Map();
  values.forEach((value) => {
    const key = normalizeText(value);
    if (key && !byKey.has(key)) byKey.set(key, String(value).trim());
  });
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Choices for the location and skills filters, taken from all approved jobs (including expired,
 * so "Show expired" can still be filtered).
 * @returns {{ locations: string[], skills: string[] }}
 */
export function getJobFilterOptions() {
  const jobs = getApprovedJobs({ includeExpired: true });
  return {
    locations: uniqueSorted(jobs.map((job) => job.location).filter((value) => typeof value === 'string')),
    skills: uniqueSorted(jobs.flatMap(skillsOf).filter((value) => typeof value === 'string')),
  };
}

/** Headline numbers for the landing page stats strip (open, non-expired jobs only). */
export function getPublicJobStats() {
  const openJobs = getApprovedJobs();
  return {
    openJobs: openJobs.length,
    hiringCompanies: new Set(openJobs.map((job) => job.companyName)).size,
    internships: openJobs.filter((job) => job.jobType === JOB_TYPES.INTERNSHIP).length,
    remoteOrHybrid: openJobs.filter((job) => job.workMode !== WORK_MODES.ON_SITE).length,
  };
}
