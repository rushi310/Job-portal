/**
 * job-service.js — Jobs: the API calls for searching and for a recruiter's own job management,
 * plus the job form rules used for quick feedback while typing.
 * The server decides what is visible (BR-08), who owns a job and what may change (BR-07 – BR-11);
 * the recruiter or student is always the logged-in user, never a value sent from the page.
 */

import {
  JOB_STATUS, JOB_TYPES, WORK_MODES, SALARY_PERIODS, ROLES, USER_STATUS, DEGREE_OPTIONS, CGPA_MAX,
  JOB_LIMITS, JOBS_PER_PAGE,
} from '../core/config.js';
import { isDeadlinePassed, parseDate } from '../core/utils.js';
import * as api from '../core/api.js';

/** Availability of a job referenced by a saved job or an application (set by the server). */
export const JOB_AVAILABILITY = Object.freeze({
  OPEN: 'open', // approved, deadline not passed
  EXPIRED: 'expired', // approved, deadline passed
  CLOSED: 'closed', // closed by the recruiter (BR-10)
  UNAVAILABLE: 'unavailable', // deleted, or not approved (pending / rejected)
});

/** Error codes returned in `{ ok: false, code, error }` results. */
export const JOB_ERRORS = Object.freeze({
  NOT_ALLOWED: 'NOT_ALLOWED',
  NOT_APPROVED: 'NOT_APPROVED',
  NOT_FOUND: 'NOT_FOUND',
  CANNOT_EDIT: 'CANNOT_EDIT',
  CANNOT_CLOSE: 'CANNOT_CLOSE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
});

/**
 * Has the job's deadline passed (BR-12)? The server works this out in the application's time
 * zone and sends it with every job; the local calculation is only a fallback.
 */
export function isJobExpired(job) {
  if (typeof job?.isExpired === 'boolean') return job.isExpired;
  if (Number.isNaN(parseDate(job?.deadline).getTime())) return true;
  return isDeadlinePassed(job.deadline);
}

/* ==========================================================================
   Reading jobs
   ========================================================================== */

/**
 * Landing page data: headline numbers and the newest open jobs (no login needed).
 * @returns {Promise<{ ok: true, data: { stats: object, featuredJobs: Array<object> } } | object>}
 */
export function getLandingData() {
  return api.get('/public/landing');
}

/**
 * Search, filter and sort the jobs students can see, one page at a time (PROJECT_SPEC.md §3.2).
 * Each job comes with `isSaved` for the logged-in student.
 * @param {object} criteria query, location, jobType, workMode, payRange, skills[], includeExpired, sort, page
 * @returns {Promise<{ ok: true, data: { items: Array<object>, page: number, totalPages: number,
 *   total: number, from: number, to: number } } | object>}
 */
export function searchJobs({
  query = '', location = '', jobType = '', workMode = '', payRange = '',
  skills = [], includeExpired = false, sort = 'newest', page = 1,
} = {}) {
  return api.get('/jobs', {
    query, location, jobType, workMode, payRange, skills, includeExpired, sort, page, limit: JOBS_PER_PAGE,
  });
}

/** Choices for the location and skills filters. @returns {Promise<{ ok: true, data: { locations: string[], skills: string[] } } | object>} */
export function getJobFilterOptions() {
  return api.get('/jobs/filter-options');
}

/**
 * One approved job as the logged-in student sees it: the job, whether it is saved, the student's
 * application (if any), each eligibility rule (BR-14) and whether they can apply now.
 * @returns {Promise<{ ok: true, data: { job: object, isSaved: boolean, application: object|null,
 *   eligibility: object, applyStatus: object } } | object>}
 */
export function getJobDetails(jobId) {
  return api.get(`/jobs/${encodeURIComponent(jobId)}`);
}

/* ==========================================================================
   Recruiter job management (BR-07 – BR-11)
   ========================================================================== */

/** BR-07: only `active` recruiters can post or manage jobs. */
export function isActiveRecruiter(user) {
  return user?.role === ROLES.RECRUITER && user.status === USER_STATUS.ACTIVE;
}

/** Statuses a recruiter may edit: rejected and closed jobs are final for the recruiter. */
const EDITABLE_STATUSES = Object.freeze([JOB_STATUS.PENDING, JOB_STATUS.APPROVED]);
export const canEditJob = (job) => EDITABLE_STATUSES.includes(job?.status);
export const canCloseJob = (job) => job?.status === JOB_STATUS.APPROVED; // BR-10

/**
 * The logged-in recruiter's own jobs (any status), newest first, with applicant counts.
 * @returns {Promise<{ ok: true, data: { items: Array<{ job: object, applicantCount: number }>,
 *   counts: Object<string, number> } } | object>}
 */
export function getOwnJobs() {
  return api.get('/recruiter/jobs');
}

/**
 * One of the logged-in recruiter's own jobs. Another recruiter's job and an unknown id both
 * come back as "not found", so a page cannot tell them apart.
 */
export function getOwnJob(jobId) {
  return api.get(`/recruiter/jobs/${encodeURIComponent(jobId)}`);
}

/** Post a new job; it is saved as `pending` until an admin approves it (BR-08). */
export function createJob(values = {}) {
  return api.post('/recruiter/jobs', values);
}

/**
 * Edit one of the recruiter's own pending or approved jobs.
 * @returns {Promise<{ ok: true, data: { job: object, returnedToPending: boolean } } | object>}
 */
export function updateJob(jobId, values = {}) {
  return api.patch(`/recruiter/jobs/${encodeURIComponent(jobId)}`, values);
}

/** Close one of the recruiter's own approved jobs (BR-10). Applications are kept. */
export function closeJob(jobId) {
  return api.post(`/recruiter/jobs/${encodeURIComponent(jobId)}/close`);
}

/* ---------- Job form rules (the server applies the same ones) ---------- */

const CURRENT_YEAR = new Date().getFullYear();
const MIN_GRADUATION_YEAR = CURRENT_YEAR - 10;
const MAX_GRADUATION_YEAR = CURRENT_YEAR + 10;

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
