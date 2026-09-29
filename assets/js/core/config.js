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

export const ROLES = Object.freeze({
  STUDENT: 'student',
  RECRUITER: 'recruiter',
  ADMIN: 'admin',
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

/** Limits & UI settings */
export const MAX_RESUME_SIZE = 500 * 1024; // 500 KB (PROJECT_SPEC.md §3.2)
export const JOBS_PER_PAGE = 9;
export const FEATURED_JOBS_COUNT = 6;
export const TOAST_DURATION = 4000;
export const MAX_CARD_SKILLS = 4;
