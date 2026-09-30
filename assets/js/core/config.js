/**
 * config.js — Central constants for FreshHire.
 * Storage keys, seed data version, roles, statuses, and limits live here so no other
 * module needs "magic strings" (see CODING_RULES.md §5.3).
 */

export const APP_NAME = 'FreshHire';

/** Bump whenever the seed JSON in /data changes, so browsers re-seed on next load. */
export const DATA_VERSION = '1.0.0';

/** Prefix shared by every FreshHire storage key. */
export const STORAGE_PREFIX = 'fh_';

export const STORAGE_KEYS = Object.freeze({
  // localStorage
  DATA_VERSION: 'fh_data_version',
  USERS: 'fh_users',
  JOBS: 'fh_jobs',
  APPLICATIONS: 'fh_applications',
  SAVED_JOBS: 'fh_saved_jobs',
  NOTIFICATIONS: 'fh_notifications',
  // sessionStorage
  SESSION: 'fh_session',
  JOB_FILTERS: 'fh_job_filters',
  FLASH: 'fh_flash',
});

/** Seed files (paths relative to the project root) and the localStorage key each fills. */
export const SEED_SOURCES = Object.freeze([
  { key: STORAGE_KEYS.USERS, path: 'data/users.json' },
  { key: STORAGE_KEYS.JOBS, path: 'data/jobs.json' },
  { key: STORAGE_KEYS.APPLICATIONS, path: 'data/applications.json' },
  { key: STORAGE_KEYS.NOTIFICATIONS, path: 'data/notifications.json' },
]);

/** Keys that start empty (no seed file). */
export const EMPTY_COLLECTION_KEYS = Object.freeze([STORAGE_KEYS.SAVED_JOBS]);

/** Public page paths, relative to the project root (ARCHITECTURE.md §3). */
export const PAGE_PATHS = Object.freeze({
  HOME: 'index.html',
  LOGIN: 'pages/auth/login.html',
  REGISTER: 'pages/auth/register.html',
  JOBS: 'pages/student/jobs.html',
  JOB_DETAILS: 'pages/student/job-details.html', // ?id=<jobId>
  SAVED_JOBS: 'pages/student/saved-jobs.html',
  APPLICATIONS: 'pages/student/applications.html',
  PROFILE: 'pages/student/profile.html', // #resume opens the Resume tab
});

export const ROLES = Object.freeze({
  STUDENT: 'student',
  RECRUITER: 'recruiter',
  ADMIN: 'admin',
});

/** Each role's dashboard (ARCHITECTURE.md §3). The pages themselves are created in P2-T04. */
export const ROLE_HOME_PATHS = Object.freeze({
  [ROLES.STUDENT]: 'pages/student/dashboard.html',
  [ROLES.RECRUITER]: 'pages/recruiter/dashboard.html',
  [ROLES.ADMIN]: 'pages/admin/dashboard.html',
});

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  BLOCKED: 'blocked',
});

export const JOB_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CLOSED: 'closed',
});

export const APPLICATION_STATUS = Object.freeze({
  APPLIED: 'applied',
  UNDER_REVIEW: 'under_review',
  SHORTLISTED: 'shortlisted',
  INTERVIEW: 'interview',
  SELECTED: 'selected',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
});

export const JOB_TYPES = Object.freeze({
  FULL_TIME: 'full-time',
  INTERNSHIP: 'internship',
  PART_TIME: 'part-time',
});

export const WORK_MODES = Object.freeze({
  ON_SITE: 'on-site',
  REMOTE: 'remote',
  HYBRID: 'hybrid',
});

export const SALARY_PERIODS = Object.freeze({
  YEAR: 'year',
  MONTH: 'month',
});

/**
 * Human-readable labels for stored codes.
 * 'pending' and 'rejected' are shared by several status groups, so each appears once.
 */
export const LABELS = Object.freeze({
  [ROLES.STUDENT]: 'Student',
  [ROLES.RECRUITER]: 'Recruiter',
  [ROLES.ADMIN]: 'Admin',
  [USER_STATUS.ACTIVE]: 'Active',
  [USER_STATUS.BLOCKED]: 'Blocked',
  [JOB_STATUS.PENDING]: 'Pending',
  [JOB_STATUS.APPROVED]: 'Approved',
  [JOB_STATUS.CLOSED]: 'Closed',
  [APPLICATION_STATUS.APPLIED]: 'Applied',
  [APPLICATION_STATUS.UNDER_REVIEW]: 'Under Review',
  [APPLICATION_STATUS.SHORTLISTED]: 'Shortlisted',
  [APPLICATION_STATUS.INTERVIEW]: 'Interview',
  [APPLICATION_STATUS.SELECTED]: 'Selected',
  [APPLICATION_STATUS.REJECTED]: 'Rejected',
  [APPLICATION_STATUS.WITHDRAWN]: 'Withdrawn',
  [JOB_TYPES.FULL_TIME]: 'Full-time',
  [JOB_TYPES.INTERNSHIP]: 'Internship',
  [JOB_TYPES.PART_TIME]: 'Part-time',
  [WORK_MODES.ON_SITE]: 'On-site',
  [WORK_MODES.REMOTE]: 'Remote',
  [WORK_MODES.HYBRID]: 'Hybrid',
  expired: 'Expired',
});

/** Roles that may self-register (BR-06: admins are seed-only). */
export const PUBLIC_REGISTRATION_ROLES = Object.freeze([ROLES.STUDENT, ROLES.RECRUITER]);

/** Degree options; the same values are used in job eligibility (PROJECT_SPEC.md §5.2). */
export const DEGREE_OPTIONS = Object.freeze(['B.E.', 'B.Tech', 'BCA', 'B.Sc', 'MCA']);

/** Graduation years offered at registration: two years back to two years ahead. */
const CURRENT_YEAR = new Date().getFullYear();
export const GRADUATION_YEAR_OPTIONS = Object.freeze(
  Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - 2 + index),
);

export const CGPA_MAX = 10;

/** Job list sort options (PROJECT_SPEC.md §3.2). The first is the default. */
export const JOB_SORT_OPTIONS = Object.freeze([
  { value: 'newest', label: 'Newest first' },
  { value: 'deadline', label: 'Deadline (soonest first)' },
  { value: 'salary', label: 'Salary / stipend (highest first)' },
]);

/**
 * Salary / stipend range filter (PROJECT_SPEC.md §3.2). Each range applies to one pay period;
 * a job matches when its pay range overlaps the chosen range. Amounts in INR.
 */
export const PAY_RANGES = Object.freeze([
  { value: 'stipend-upto-15k', label: 'Stipend up to ₹15,000 /month', period: 'month', min: 0, max: 15000 },
  { value: 'stipend-15k-plus', label: 'Stipend ₹15,000+ /month', period: 'month', min: 15000, max: Infinity },
  { value: 'salary-upto-4l', label: 'Salary up to ₹4 LPA', period: 'year', min: 0, max: 400000 },
  { value: 'salary-4l-6l', label: 'Salary ₹4 – 6 LPA', period: 'year', min: 400000, max: 600000 },
  { value: 'salary-6l-plus', label: 'Salary ₹6 LPA+', period: 'year', min: 600000, max: Infinity },
]);

/** Optional cover note on an application (PROJECT_SPEC.md §5.3). */
export const COVER_NOTE_MAX_LENGTH = 1000;

/**
 * Student profile limits (PROJECT_SPEC.md §3.2 "Profile rules"). They keep one profile small enough
 * for localStorage and make each text field's maximum visible to the student.
 */
export const PROFILE_LIMITS = Object.freeze({
  SHORT_TEXT: 100, // name, location, college, branch, institute, project title
  ABOUT: 1000,
  SKILL: 40,
  MAX_SKILLS: 30,
  LEVEL: 50, // education level, e.g. "HSC"
  SCORE: 20, // e.g. "86%" or "8.1 CGPA"
  PROJECT_DESCRIPTION: 500,
  MAX_EDUCATION: 5,
  MAX_PROJECTS: 5,
  MIN_EDUCATION_YEAR: 1980,
});

/** Profile links (PROJECT_SPEC.md §5.1 `links`) in display order. */
export const PROFILE_LINK_FIELDS = Object.freeze([
  { name: 'linkedin', label: 'LinkedIn' },
  { name: 'github', label: 'GitHub' },
  { name: 'portfolio', label: 'Portfolio' },
]);

/** Only PDF resumes are accepted (CODING_RULES.md §5). */
export const RESUME_MIME_TYPE = 'application/pdf';

/** Delay before a typed search runs (UI_SPEC: debounced search). */
export const SEARCH_DEBOUNCE_MS = 300;

/** Limits & UI settings */
export const MAX_RESUME_SIZE = 500 * 1024; // 500 KB (PROJECT_SPEC.md §3.2)
export const JOBS_PER_PAGE = 9;
export const FEATURED_JOBS_COUNT = 6;
export const TOAST_DURATION = 4000;
/** Short pause on form submits so the loading state is visible (simulated network round-trip). */
export const SIMULATED_DELAY_MS = 600;
export const MAX_CARD_SKILLS = 4;
