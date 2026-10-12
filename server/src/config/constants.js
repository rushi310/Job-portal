/**
 * constants.js — Roles, statuses and limits (PROJECT_SPEC.md §2–§5).
 * These mirror assets/js/core/config.js in the frontend; the server copy is the one that is enforced.
 */

const ROLES = Object.freeze({ STUDENT: 'student', RECRUITER: 'recruiter', ADMIN: 'admin' });
const USER_STATUS = Object.freeze({ ACTIVE: 'active', PENDING: 'pending', BLOCKED: 'blocked' });
const JOB_STATUS = Object.freeze({
  PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', CLOSED: 'closed',
});
const APPLICATION_STATUS = Object.freeze({
  APPLIED: 'applied',
  UNDER_REVIEW: 'under_review',
  SHORTLISTED: 'shortlisted',
  INTERVIEW: 'interview',
  SELECTED: 'selected',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
});
const JOB_TYPES = Object.freeze({ FULL_TIME: 'full-time', INTERNSHIP: 'internship', PART_TIME: 'part-time' });
const WORK_MODES = Object.freeze({ ON_SITE: 'on-site', REMOTE: 'remote', HYBRID: 'hybrid' });
const SALARY_PERIODS = Object.freeze({ YEAR: 'year', MONTH: 'month' });
const NOTIFICATION_TYPES = Object.freeze({
  APPLICATION: 'application', STATUS: 'status', JOB: 'job', ACCOUNT: 'account', ANNOUNCEMENT: 'announcement',
});

/** Roles that may self-register (BR-06: admins are created by the seed script only). */
const PUBLIC_REGISTRATION_ROLES = Object.freeze([ROLES.STUDENT, ROLES.RECRUITER]);
const DEGREE_OPTIONS = Object.freeze(['B.E.', 'B.Tech', 'BCA', 'B.Sc', 'MCA']);
const COMPANY_SIZE_OPTIONS = Object.freeze(['1-10', '11-50', '51-200', '201-500', '500+']);
const CGPA_MAX = 10;

/** Recruiter status changes allowed from each application status (BR-15). */
const RECRUITER_STATUS_FLOW = Object.freeze({
  applied: ['under_review', 'rejected'],
  under_review: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['selected', 'rejected'],
  selected: [],
  rejected: [],
  withdrawn: [],
});
/** A student may withdraw only from these statuses (BR-15). */
const WITHDRAWABLE_STATUSES = Object.freeze([APPLICATION_STATUS.APPLIED, APPLICATION_STATUS.UNDER_REVIEW]);
/** Forward stages of an application, in order (recruiter status funnel). */
const APPLICATION_PIPELINE = Object.freeze([
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.UNDER_REVIEW,
  APPLICATION_STATUS.SHORTLISTED,
  APPLICATION_STATUS.INTERVIEW,
  APPLICATION_STATUS.SELECTED,
]);

/** Salary / stipend filter ranges (amounts in INR). */
const PAY_RANGES = Object.freeze([
  { value: 'stipend-upto-15k', period: 'month', min: 0, max: 15000 },
  { value: 'stipend-15k-plus', period: 'month', min: 15000, max: Infinity },
  { value: 'salary-upto-4l', period: 'year', min: 0, max: 400000 },
  { value: 'salary-4l-6l', period: 'year', min: 400000, max: 600000 },
  { value: 'salary-6l-plus', period: 'year', min: 600000, max: Infinity },
]);
const JOB_SORTS = Object.freeze(['newest', 'deadline', 'salary']);

const ANNOUNCEMENT_AUDIENCES = Object.freeze({
  all: [ROLES.STUDENT, ROLES.RECRUITER],
  students: [ROLES.STUDENT],
  recruiters: [ROLES.RECRUITER],
});

const LIMITS = Object.freeze({
  COVER_NOTE: 1000,
  REJECTION_REASON: 300,
  ANNOUNCEMENT_TITLE: 100,
  ANNOUNCEMENT_MESSAGE: 500,
  MAX_RESUME_SIZE: 500 * 1024,
  SEARCH_QUERY: 100,
  JOBS_PER_PAGE: 9,
  FEATURED_JOBS: 6,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  REPORT_MAX_WEEKLY_POINTS: 16,
  PASSWORD_MAX: 128, // bcrypt only uses the first 72 bytes; also stops very long inputs
});

const PROFILE_LIMITS = Object.freeze({
  SHORT_TEXT: 100,
  ABOUT: 1000,
  SKILL: 40,
  MAX_SKILLS: 30,
  LEVEL: 50,
  SCORE: 20,
  PROJECT_DESCRIPTION: 500,
  MAX_EDUCATION: 5,
  MAX_PROJECTS: 5,
  MIN_EDUCATION_YEAR: 1980,
});

const JOB_LIMITS = Object.freeze({
  TITLE: 100,
  LOCATION: 100,
  EXPERIENCE: 50,
  DESCRIPTION: 2000,
  RESPONSIBILITY: 200,
  MAX_RESPONSIBILITIES: 10,
  SKILL: 40,
  MAX_SKILLS: 15,
  MAX_OPENINGS: 1000,
  MAX_SALARY: 100000000,
});

const RESUME_MIME_TYPE = 'application/pdf';

/** Project pages that notifications link to (paths relative to the frontend root). */
const PAGE_PATHS = Object.freeze({
  APPLICATIONS: 'pages/student/applications.html',
  APPLICANTS: 'pages/recruiter/applicants.html',
  MY_JOBS: 'pages/recruiter/my-jobs.html',
  POST_JOB: 'pages/recruiter/post-job.html',
});

module.exports = {
  ROLES,
  USER_STATUS,
  JOB_STATUS,
  APPLICATION_STATUS,
  JOB_TYPES,
  WORK_MODES,
  SALARY_PERIODS,
  NOTIFICATION_TYPES,
  PUBLIC_REGISTRATION_ROLES,
  DEGREE_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  CGPA_MAX,
  RECRUITER_STATUS_FLOW,
  WITHDRAWABLE_STATUSES,
  APPLICATION_PIPELINE,
  PAY_RANGES,
  JOB_SORTS,
  ANNOUNCEMENT_AUDIENCES,
  LIMITS,
  PROFILE_LIMITS,
  JOB_LIMITS,
  RESUME_MIME_TYPE,
  PAGE_PATHS,
};
