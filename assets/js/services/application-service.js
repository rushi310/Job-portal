/**
 * application-service.js — Business logic for job applications.
 * Phase 3: read-only queries for the student dashboard.
 * Phase 5: eligibility (BR-14), apply status, and applyToJob (BR-12, BR-13, BR-16, BR-17).
 * Phase 6: withdraw by the student (BR-15). Recruiter status changes (Phase 8) are added later.
 */

import {
  STORAGE_KEYS, ROLES, APPLICATION_STATUS, COVER_NOTE_MAX_LENGTH,
} from '../core/config.js';
import { getLocal, setLocal } from '../core/storage.js';
import { parseDate, generateId } from '../core/utils.js';
import { getCurrentUser } from '../core/auth.js';
import { getVisibleJob, isJobExpired } from './job-service.js';

/** Error codes returned in `{ ok: false, code, error }` results. */
export const APPLY_ERRORS = Object.freeze({
  NOT_ALLOWED: 'NOT_ALLOWED',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_EXPIRED: 'JOB_EXPIRED',
  ALREADY_APPLIED: 'ALREADY_APPLIED',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CANNOT_WITHDRAW: 'CANNOT_WITHDRAW',
});

/** A student may withdraw only from these statuses (BR-15). */
const WITHDRAWABLE_STATUSES = Object.freeze([APPLICATION_STATUS.APPLIED, APPLICATION_STATUS.UNDER_REVIEW]);

/** @returns {Array<object>} all applications; never throws on missing/corrupted data */
function getAllApplications() {
  const applications = getLocal(STORAGE_KEYS.APPLICATIONS, []);
  return Array.isArray(applications) ? applications.filter(Boolean) : [];
}

/** Most recent activity first (status change, else application date). */
function byLatestActivity(a, b) {
  return parseDate(b.updatedAt ?? b.appliedAt) - parseDate(a.updatedAt ?? a.appliedAt);
}

/**
 * Applications belonging to one student only, most recently updated first.
 * @param {string} studentId id of the logged-in student (from the session, never from the URL)
 * @returns {Array<object>}
 */
export function getApplicationsByStudent(studentId) {
  if (!studentId) return [];
  return getAllApplications()
    .filter((application) => application.studentId === studentId)
    .sort(byLatestActivity);
}

/** Number of applications currently in the given status. */
export function countApplicationsByStatus(applications, status) {
  return applications.filter((application) => application.status === status).length;
}

/**
 * The student's application for a job, if any (a withdrawn one still counts — BR-13).
 * @returns {object|null}
 */
export function getApplicationForJob(studentId, jobId) {
  if (!studentId || !jobId) return null;
  return getAllApplications()
    .find((application) => application.studentId === studentId && application.jobId === jobId) ?? null;
}

/* ==========================================================================
   Eligibility (BR-14)
   ========================================================================== */

const listText = (values) => values.join(', ');

/**
 * Check each eligibility rule of a job against a student's profile.
 * Rules with no requirement (empty list / no minimum) always pass.
 * @returns {{ isEligible: boolean, rules: Array<{ label: string, requirement: string, yours: string, met: boolean }> }}
 */
export function checkEligibility(student, job) {
  const profile = student?.profile ?? {};
  const eligibility = job?.eligibility ?? {};
  const degrees = Array.isArray(eligibility.degrees) ? eligibility.degrees : [];
  const years = Array.isArray(eligibility.graduationYears) ? eligibility.graduationYears : [];
  const minCgpa = Number.isFinite(eligibility.minCgpa) ? eligibility.minCgpa : null;
  const cgpa = Number.isFinite(profile.cgpa) ? profile.cgpa : null;

  const rules = [
    {
      label: 'Degree',
      requirement: degrees.length ? listText(degrees) : 'Any degree',
      yours: profile.degree || 'Not provided',
      met: degrees.length === 0 || degrees.includes(profile.degree),
    },
    {
      label: 'Graduation year',
      requirement: years.length ? listText(years) : 'Any year',
      yours: Number.isFinite(profile.graduationYear) ? String(profile.graduationYear) : 'Not provided',
      met: years.length === 0 || years.includes(profile.graduationYear),
    },
    {
      label: 'Minimum CGPA',
      requirement: minCgpa === null ? 'No minimum' : String(minCgpa),
      yours: cgpa === null ? 'Not provided' : String(cgpa),
      met: minCgpa === null || (cgpa !== null && cgpa >= minCgpa),
    },
  ];
  return { isEligible: rules.every((rule) => rule.met), rules };
}

/* ==========================================================================
   Apply
   ========================================================================== */

/**
 * Can this student apply to this job right now? Order matters: the first failing rule is reported.
 * @returns {{ canApply: boolean, code?: string, message?: string, application?: object }}
 */
export function getApplyStatus(student, job) {
  if (!student || student.role !== ROLES.STUDENT) {
    return { canApply: false, code: APPLY_ERRORS.NOT_ALLOWED, message: 'Only students can apply to jobs.' };
  }
  if (!job) {
    return { canApply: false, code: APPLY_ERRORS.JOB_NOT_FOUND, message: 'This job is not available.' };
  }
  const application = getApplicationForJob(student.id, job.id);
  if (application) {
    return {
      canApply: false, code: APPLY_ERRORS.ALREADY_APPLIED, message: 'You have already applied to this job.', application,
    };
  }
  if (isJobExpired(job)) {
    return { canApply: false, code: APPLY_ERRORS.JOB_EXPIRED, message: 'The application deadline for this job has passed.' };
  }
  if (!checkEligibility(student, job).isEligible) {
    return {
      canApply: false, code: APPLY_ERRORS.NOT_ELIGIBLE, message: 'You do not meet the eligibility criteria for this job.',
    };
  }
  return { canApply: true };
}

/** Validate the application form values. @returns {Object<string, string>} field → message */
export function validateApplicationForm({ coverNote = '' } = {}) {
  if (typeof coverNote !== 'string') return { coverNote: 'Cover note must be text.' };
  if (coverNote.trim().length > COVER_NOTE_MAX_LENGTH) {
    return { coverNote: `Cover note can be at most ${COVER_NOTE_MAX_LENGTH} characters.` };
  }
  return {};
}

function failure(code, error, extra = {}) {
  return { ok: false, code, error, ...extra };
}

/**
 * Apply to a job as the logged-in student. The student is always taken from the session —
 * never from a parameter — and every rule is checked again here, whatever the page showed.
 * @param {string} jobId
 * @param {{ coverNote?: string }} [form]
 * @returns {{ ok: true, data: object } | { ok: false, code: string, error: string, fieldErrors?: object }}
 */
export function applyToJob(jobId, form = {}) {
  const student = getCurrentUser();
  const job = getVisibleJob(jobId);
  const status = getApplyStatus(student, job);
  if (!status.canApply) return failure(status.code, status.message);

  const fieldErrors = validateApplicationForm(form);
  if (Object.keys(fieldErrors).length > 0) {
    return failure(APPLY_ERRORS.VALIDATION_FAILED, 'Please correct the highlighted field.', { fieldErrors });
  }

  const now = new Date().toISOString();
  const application = {
    id: generateId('app'),
    jobId: job.id,
    studentId: student.id,
    recruiterId: job.recruiterId,
    coverNote: (form.coverNote ?? '').trim(),
    resumeFileName: student.profile?.resume?.fileName ?? null, // BR-17: reference only, not required
    status: APPLICATION_STATUS.APPLIED,
    statusHistory: [{ status: APPLICATION_STATUS.APPLIED, at: now, note: '' }], // BR-16
    appliedAt: now,
    updatedAt: now,
  };

  // Re-read immediately before writing so a second tab can't create a duplicate (BR-13).
  const applications = getAllApplications();
  if (applications.some((item) => item.studentId === student.id && item.jobId === job.id)) {
    return failure(APPLY_ERRORS.ALREADY_APPLIED, 'You have already applied to this job.');
  }
  const saved = setLocal(STORAGE_KEYS.APPLICATIONS, [...applications, application]);
  if (!saved.ok) return failure(APPLY_ERRORS.STORAGE_ERROR, saved.error);
  return { ok: true, data: application };
}

/* ==========================================================================
   Withdraw (Phase 6, BR-15)
   ========================================================================== */

/** Can this application still be withdrawn by the student? */
export function canWithdraw(application) {
  return WITHDRAWABLE_STATUSES.includes(application?.status);
}

/**
 * Withdraw one of the logged-in student's applications. The student comes from the session;
 * the application must belong to them and be in `applied` or `under_review`. The change is
 * appended to the status history (BR-16). Withdrawn is final and still blocks re-applying (BR-13).
 * @param {string} applicationId
 * @returns {{ ok: true, data: object } | { ok: false, code: string, error: string }}
 */
export function withdrawApplication(applicationId) {
  const student = getCurrentUser();
  if (!student || student.role !== ROLES.STUDENT) {
    return failure(APPLY_ERRORS.NOT_ALLOWED, 'Only students can withdraw applications.');
  }
  const applications = getAllApplications();
  const index = applications.findIndex((item) => item.id === applicationId && item.studentId === student.id);
  if (index === -1) return failure(APPLY_ERRORS.NOT_FOUND, 'Application not found.');

  const application = applications[index];
  if (!canWithdraw(application)) {
    return failure(APPLY_ERRORS.CANNOT_WITHDRAW, 'This application can no longer be withdrawn.');
  }

  const now = new Date().toISOString();
  const history = Array.isArray(application.statusHistory) ? application.statusHistory : [];
  const updated = {
    ...application,
    status: APPLICATION_STATUS.WITHDRAWN,
    statusHistory: [...history, { status: APPLICATION_STATUS.WITHDRAWN, at: now, note: 'Withdrawn by student.' }],
    updatedAt: now,
  };
  const next = applications.map((item, position) => (position === index ? updated : item));
  const saved = setLocal(STORAGE_KEYS.APPLICATIONS, next);
  return saved.ok ? { ok: true, data: updated } : failure(APPLY_ERRORS.STORAGE_ERROR, saved.error);
}
