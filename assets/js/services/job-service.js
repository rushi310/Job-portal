/**
 * job-service.js — Business logic for jobs.
 * Phase 1: read-only getters used by the landing page. Phase 3: skill-based recommendations.
 * Phase 4: search/filter. Phase 8: recruiter create / update / close (BR-07 – BR-11), the recruiter
 * always taken from the session. Admin approval is added in Phase 9.
 */

import {
  STORAGE_KEYS, JOB_STATUS, JOB_TYPES, WORK_MODES, SALARY_PERIODS, PAY_RANGES,
  ROLES, USER_STATUS, DEGREE_OPTIONS, CGPA_MAX, JOB_LIMITS,
} from '../core/config.js';
import { getLocal, setLocal } from '../core/storage.js';
import { isDeadlinePassed, parseDate, generateId } from '../core/utils.js';
import { getCurrentUser } from '../core/auth.js';

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

/**
 * A job a student may open (BR-08): approved, expired or not. Anything else — missing id,
 * unknown id, malformed record, pending/rejected/closed job — returns null ("Job not found").
 * @param {string|null} jobId
 * @returns {object|null}
 */
export function getVisibleJob(jobId) {
  if (typeof jobId !== 'string' || jobId.trim() === '') return null;
  const job = getJobById(jobId);
  return job && job.status === JOB_STATUS.APPROVED ? job : null;
}

/** Availability of a job referenced by a saved job or an application. */
export const JOB_AVAILABILITY = Object.freeze({
  OPEN: 'open', // approved, deadline not passed
  EXPIRED: 'expired', // approved, deadline passed
  CLOSED: 'closed', // closed by the recruiter (BR-10)
  UNAVAILABLE: 'unavailable', // deleted, or not approved (pending / rejected)
});

/**
 * @param {object|null} job
 * @returns {string} a JOB_AVAILABILITY value
 */
export function getJobAvailability(job) {
  if (!job) return JOB_AVAILABILITY.UNAVAILABLE;
  if (job.status === JOB_STATUS.CLOSED) return JOB_AVAILABILITY.CLOSED;
  if (job.status !== JOB_STATUS.APPROVED) return JOB_AVAILABILITY.UNAVAILABLE;
  return isJobExpired(job) ? JOB_AVAILABILITY.EXPIRED : JOB_AVAILABILITY.OPEN;
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

/* ==========================================================================
   Recruiter job management (Phase 8, BR-07 – BR-11)
   ========================================================================== */

/** Error codes returned in `{ ok: false, code, error }` results. */
export const JOB_ERRORS = Object.freeze({
  NOT_ALLOWED: 'NOT_ALLOWED',
  NOT_APPROVED: 'NOT_APPROVED',
  NOT_FOUND: 'NOT_FOUND',
  CANNOT_EDIT: 'CANNOT_EDIT',
  CANNOT_CLOSE: 'CANNOT_CLOSE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
});

/** Statuses a recruiter may edit: rejected and closed jobs are final for the recruiter. */
const EDITABLE_STATUSES = Object.freeze([JOB_STATUS.PENDING, JOB_STATUS.APPROVED]);
/** Core fields: changing any of them on an approved job sends it back for approval (BR-11). */
const CORE_FIELDS = Object.freeze(['title', 'description', 'eligibility', 'salaryMin', 'salaryMax', 'salaryPeriod']);

const CURRENT_YEAR = new Date().getFullYear();
const MIN_GRADUATION_YEAR = CURRENT_YEAR - 10;
const MAX_GRADUATION_YEAR = CURRENT_YEAR + 10;

function jobFailure(code, error, extra = {}) {
  return { ok: false, code, error, ...extra };
}

/** Newest first by posting date — every job of one recruiter, any status. */
export function getJobsByRecruiter(recruiterId) {
  if (!recruiterId) return [];
  return getAllJobs().filter((job) => job.recruiterId === recruiterId).sort(byNewest);
}

/** @returns {object|null} the logged-in recruiter (any login-eligible status), else null */
function getRecruiter() {
  const user = getCurrentUser();
  return user?.role === ROLES.RECRUITER ? user : null;
}

/** BR-07: only `active` recruiters can post or manage jobs. */
export function isActiveRecruiter(user) {
  return user?.role === ROLES.RECRUITER && user.status === USER_STATUS.ACTIVE;
}

/** The logged-in recruiter's own jobs (identity from the session). */
export function getOwnJobs() {
  const recruiter = getRecruiter();
  return recruiter ? getJobsByRecruiter(recruiter.id) : [];
}

/**
 * One of the logged-in recruiter's own jobs. Another recruiter's job, an unknown id and a malformed
 * record all return null, so a page cannot tell them apart.
 * @returns {object|null}
 */
export function getOwnJob(jobId) {
  const recruiter = getRecruiter();
  if (!recruiter || typeof jobId !== 'string') return null;
  const job = getJobById(jobId);
  return job && job.recruiterId === recruiter.id ? job : null;
}

export const canEditJob = (job) => EDITABLE_STATUSES.includes(job?.status);
export const canCloseJob = (job) => job?.status === JOB_STATUS.APPROVED; // BR-10

/* ---------- Validation ---------- */

const text = (value) => String(value ?? '').trim();
const isBlank = (value) => text(value) === '';
const list = (value) => (Array.isArray(value) ? value : []);
const tooLong = (label, limit) => (value) => (
  text(value).length > limit ? `${label} must be ${limit} characters or fewer.` : ''
);
const required = (label, limit, message) => (value) => (isBlank(value) ? message : tooLong(label, limit)(value));
const wholeNumber = (value) => (/^\d+$/.test(text(value)) ? Number(text(value)) : NaN);

/** Can this skill be added to a job's list? */
export function validateJobSkill(skill, skills = []) {
  const value = text(skill);
  if (!value) return 'Please type a skill to add.';
  if (value.length > JOB_LIMITS.SKILL) return `A skill must be ${JOB_LIMITS.SKILL} characters or fewer.`;
  if (skills.some((existing) => text(existing).toLowerCase() === value.toLowerCase())) {
    return `"${value}" is already in the list.`;
  }
  if (skills.length >= JOB_LIMITS.MAX_SKILLS) return `You can add up to ${JOB_LIMITS.MAX_SKILLS} skills.`;
  return '';
}

/** One rule per form field: (value, allValues) → message ('' when valid). */
const JOB_FIELD_RULES = {
  title: required('Job title', JOB_LIMITS.TITLE, 'Please enter the job title.'),
  location: required('Location', JOB_LIMITS.LOCATION, 'Please enter the job location.'),
  jobType: (value) => (Object.values(JOB_TYPES).includes(value) ? '' : 'Please choose a job type.'),
  workMode: (value) => (Object.values(WORK_MODES).includes(value) ? '' : 'Please choose a work mode.'),
  experience: required('Experience', JOB_LIMITS.EXPERIENCE, 'Please enter the experience needed, e.g. Fresher.'),
  openings: (value) => {
    const openings = wholeNumber(value);
    return openings >= 1 && openings <= JOB_LIMITS.MAX_OPENINGS
      ? '' : `Please enter the number of openings (1 to ${JOB_LIMITS.MAX_OPENINGS}).`;
  },
  deadline: (value) => {
    if (isBlank(value)) return 'Please choose an application deadline.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value)) || Number.isNaN(parseDate(text(value)).getTime())) {
      return 'Please enter a valid date.';
    }
    return isDeadlinePassed(text(value)) ? 'The deadline must be today or a later date.' : '';
  },
  salaryPeriod: (value, values) => {
    if (!Object.values(SALARY_PERIODS).includes(value)) return 'Please choose how the pay is counted.';
    return values.jobType === JOB_TYPES.INTERNSHIP && value !== SALARY_PERIODS.MONTH
      ? 'Internships pay a monthly stipend. Please choose "per month".' : '';
  },
  salaryMin: (value, values) => {
    if (isBlank(value) && isBlank(values.salaryMax)) return ''; // pay not disclosed
    const amount = wholeNumber(value);
    return amount >= 1 && amount <= JOB_LIMITS.MAX_SALARY
      ? '' : 'Please enter the minimum pay in rupees (whole number), or leave both amounts empty.';
  },
  salaryMax: (value, values) => {
    if (isBlank(value)) return '';
    const amount = wholeNumber(value);
    if (!(amount >= 1 && amount <= JOB_LIMITS.MAX_SALARY)) return 'Please enter the maximum pay in rupees (whole number).';
    const min = wholeNumber(values.salaryMin);
    return Number.isNaN(min) || amount >= min ? '' : 'The maximum must be at least the minimum.';
  },
  description: required('Description', JOB_LIMITS.DESCRIPTION, 'Please describe the job.'),
  responsibilities: (value) => {
    const items = list(value).map(text).filter(Boolean);
    if (items.length > JOB_LIMITS.MAX_RESPONSIBILITIES) return `Please list up to ${JOB_LIMITS.MAX_RESPONSIBILITIES} responsibilities.`;
    return items.some((item) => item.length > JOB_LIMITS.RESPONSIBILITY)
      ? `Each responsibility must be ${JOB_LIMITS.RESPONSIBILITY} characters or fewer.` : '';
  },
  skills: (value) => {
    const skills = list(value);
    if (skills.length === 0) return 'Please add at least one skill.';
    const accepted = [];
    for (const skill of skills) {
      const message = validateJobSkill(skill, accepted);
      if (message) return message;
      accepted.push(text(skill));
    }
    return '';
  },
  degrees: (value) => (list(value).every((degree) => DEGREE_OPTIONS.includes(degree))
    ? '' : 'Please choose degrees from the list.'),
  graduationYears: (value) => (list(value).every((year) => {
    const number = Number(year);
    return Number.isInteger(number) && number >= MIN_GRADUATION_YEAR && number <= MAX_GRADUATION_YEAR;
  }) ? '' : 'Please choose graduation years from the list.'),
  minCgpa: (value) => {
    if (isBlank(value)) return '';
    const cgpa = Number(text(value));
    return Number.isFinite(cgpa) && cgpa >= 0 && cgpa <= CGPA_MAX ? '' : `Minimum CGPA must be between 0 and ${CGPA_MAX}.`;
  },
};

/** Field names in form order (the first invalid one gets focus). */
export const JOB_FORM_FIELDS = Object.freeze(Object.keys(JOB_FIELD_RULES));

/** @returns {string} error message, or '' when valid */
export function validateJobField(field, values) {
  const rule = JOB_FIELD_RULES[field];
  return rule ? rule(values[field], values) : '';
}

/** @returns {Object<string, string>} field → message for invalid fields only */
export function validateJobForm(values = {}) {
  return JOB_FORM_FIELDS.reduce((errors, field) => {
    const message = validateJobField(field, values);
    return message ? { ...errors, [field]: message } : errors;
  }, {});
}

/** The job fields a recruiter controls, normalised (call after validateJobForm passed). */
function buildJobFields(values) {
  const hasPay = !isBlank(values.salaryMin);
  const salaryMin = hasPay ? wholeNumber(values.salaryMin) : 0;
  return {
    title: text(values.title),
    location: text(values.location),
    jobType: values.jobType,
    workMode: values.workMode,
    salaryMin,
    salaryMax: hasPay ? (isBlank(values.salaryMax) ? salaryMin : wholeNumber(values.salaryMax)) : 0,
    salaryPeriod: values.salaryPeriod,
    experience: text(values.experience),
    skills: list(values.skills).map(text),
    description: text(values.description),
    responsibilities: list(values.responsibilities).map(text).filter(Boolean),
    eligibility: {
      degrees: DEGREE_OPTIONS.filter((degree) => list(values.degrees).includes(degree)),
      graduationYears: [...new Set(list(values.graduationYears).map(Number))].sort((a, b) => a - b),
      minCgpa: isBlank(values.minCgpa) ? null : Math.round(Number(text(values.minCgpa)) * 100) / 100,
    },
    openings: wholeNumber(values.openings),
    deadline: text(values.deadline),
  };
}

/** Did any BR-11 core field change? */
function hasCoreChanges(job, fields) {
  return CORE_FIELDS.some((field) => JSON.stringify(job[field] ?? null) !== JSON.stringify(fields[field] ?? null));
}

/** Common checks for every write: active recruiter (BR-07). */
function getActiveRecruiterOrFailure() {
  const recruiter = getRecruiter();
  if (!recruiter) return { failure: jobFailure(JOB_ERRORS.NOT_ALLOWED, 'Please log in as a recruiter.') };
  if (!isActiveRecruiter(recruiter)) {
    return {
      failure: jobFailure(JOB_ERRORS.NOT_APPROVED,
        'Your account is awaiting admin approval. You can post and manage jobs once it is approved.'),
    };
  }
  return { recruiter };
}

function saveJobs(jobs, job, extra = {}) {
  const saved = setLocal(STORAGE_KEYS.JOBS, jobs);
  return saved.ok ? { ok: true, data: job, ...extra } : jobFailure(JOB_ERRORS.STORAGE_ERROR, saved.error);
}

/**
 * Post a new job as the logged-in, active recruiter. It is saved as `pending` (BR-08) and is not
 * visible to students until an admin approves it. Owner and company always come from the session.
 * @returns {{ ok: true, data: object } | { ok: false, code: string, error: string, fieldErrors?: object }}
 */
export function createJob(values = {}) {
  const { recruiter, failure } = getActiveRecruiterOrFailure();
  if (failure) return failure;

  const fieldErrors = validateJobForm(values);
  if (Object.keys(fieldErrors).length > 0) {
    return jobFailure(JOB_ERRORS.VALIDATION_FAILED, 'Please correct the highlighted fields.', { fieldErrors });
  }

  const now = new Date().toISOString();
  const fields = buildJobFields(values);
  const job = {
    id: generateId('job'),
    recruiterId: recruiter.id,
    title: fields.title,
    companyName: text(recruiter.profile?.companyName) || recruiter.name,
    ...fields,
    status: JOB_STATUS.PENDING,
    rejectionReason: '',
    postedAt: now,
    updatedAt: now,
  };
  const stored = getLocal(STORAGE_KEYS.JOBS, []);
  return saveJobs([...(Array.isArray(stored) ? stored : []), job], job);
}

/**
 * Edit one of the logged-in recruiter's own pending or approved jobs. id, owner, company, status,
 * rejection reason and posting date are kept; an approved job whose core fields change goes back
 * to `pending` (BR-11). A recruiter can never make a job `approved`.
 * @returns {{ ok: true, data: object, returnedToPending: boolean }
 *   | { ok: false, code: string, error: string, fieldErrors?: object }}
 */
export function updateJob(jobId, values = {}) {
  const { recruiter, failure } = getActiveRecruiterOrFailure();
  if (failure) return failure;

  const jobs = getLocal(STORAGE_KEYS.JOBS, []);
  const index = Array.isArray(jobs) ? jobs.findIndex((job) => isUsableJob(job) && job.id === jobId) : -1;
  if (index === -1 || jobs[index].recruiterId !== recruiter.id) {
    return jobFailure(JOB_ERRORS.NOT_FOUND, 'Job not found.');
  }
  const job = jobs[index];
  if (!canEditJob(job)) return jobFailure(JOB_ERRORS.CANNOT_EDIT, 'Closed and rejected jobs cannot be edited.');

  const fieldErrors = validateJobForm(values);
  if (Object.keys(fieldErrors).length > 0) {
    return jobFailure(JOB_ERRORS.VALIDATION_FAILED, 'Please correct the highlighted fields.', { fieldErrors });
  }

  const fields = buildJobFields(values);
  const returnedToPending = job.status === JOB_STATUS.APPROVED && hasCoreChanges(job, fields);
  const updated = {
    ...job,
    ...fields,
    id: job.id,
    recruiterId: job.recruiterId,
    companyName: job.companyName,
    status: returnedToPending ? JOB_STATUS.PENDING : job.status,
    updatedAt: new Date().toISOString(),
  };
  const next = jobs.map((item, position) => (position === index ? updated : item));
  return saveJobs(next, updated, { returnedToPending });
}

/**
 * Close one of the logged-in recruiter's own approved jobs (BR-10). Applications are kept;
 * the job disappears from job search.
 * @returns {{ ok: true, data: object } | { ok: false, code: string, error: string }}
 */
export function closeJob(jobId) {
  const { recruiter, failure } = getActiveRecruiterOrFailure();
  if (failure) return failure;

  const jobs = getLocal(STORAGE_KEYS.JOBS, []);
  const index = Array.isArray(jobs) ? jobs.findIndex((job) => isUsableJob(job) && job.id === jobId) : -1;
  if (index === -1 || jobs[index].recruiterId !== recruiter.id) {
    return jobFailure(JOB_ERRORS.NOT_FOUND, 'Job not found.');
  }
  if (!canCloseJob(jobs[index])) return jobFailure(JOB_ERRORS.CANNOT_CLOSE, 'Only approved jobs can be closed.');

  const updated = { ...jobs[index], status: JOB_STATUS.CLOSED, updatedAt: new Date().toISOString() };
  const next = jobs.map((item, position) => (position === index ? updated : item));
  return saveJobs(next, updated);
}
