/**
 * application-service.js — Job applications: the API calls for applying, tracking, withdrawing
 * (student) and reviewing (recruiter), plus the small rules pages use to decide what to show.
 * The server checks every rule again (BR-12 – BR-17) and takes the student or recruiter from the
 * login token, so nothing here can be used to act for someone else.
 */

import { APPLICATION_STATUS, COVER_NOTE_MAX_LENGTH, RECRUITER_STATUS_FLOW } from '../core/config.js';
import * as api from '../core/api.js';

/** Error codes returned in `{ ok: false, code, error }` results. */
export const APPLY_ERRORS = Object.freeze({
  NOT_ALLOWED: 'NOT_ALLOWED',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_EXPIRED: 'JOB_EXPIRED',
  ALREADY_APPLIED: 'ALREADY_APPLIED',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CANNOT_WITHDRAW: 'CANNOT_WITHDRAW',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
});

/** A student may withdraw only from these statuses (BR-15). */
const WITHDRAWABLE_STATUSES = Object.freeze([APPLICATION_STATUS.APPLIED, APPLICATION_STATUS.UNDER_REVIEW]);

/* ==========================================================================
   Student
   ========================================================================== */

/** Validate the application form values. @returns {Object<string, string>} field → message */
export function validateApplicationForm({ coverNote = '' } = {}) {
  if (typeof coverNote !== 'string') return { coverNote: 'Cover note must be text.' };
  if (coverNote.trim().length > COVER_NOTE_MAX_LENGTH) {
    return { coverNote: `Cover note can be at most ${COVER_NOTE_MAX_LENGTH} characters.` };
  }
  return {};
}

/**
 * Apply to a job as the logged-in student.
 * @param {string} jobId
 * @param {{ coverNote?: string }} [form]
 * @returns {Promise<{ ok: true, data: object } | { ok: false, code: string, error: string, fieldErrors?: object }>}
 */
export function applyToJob(jobId, form = {}) {
  return api.post(`/jobs/${encodeURIComponent(jobId)}/applications`, { coverNote: form.coverNote ?? '' });
}

/** The most applications one request returns; the page shows a note if there are more. */
export const APPLICATIONS_PAGE_SIZE = 100;

/**
 * The logged-in student's applications, most recent activity first, each with its job (or its
 * title only once the job is closed; null once deleted) and the job's availability.
 * @returns {Promise<{ ok: true, data: { items: Array<{ application: object, job: object|null,
 *   availability: string }>, counts: Object<string, number>, total: number } } | object>}
 */
export function getOwnApplications() {
  return api.get('/student/applications', { limit: APPLICATIONS_PAGE_SIZE });
}

/** Can this application still be withdrawn by the student? */
export function canWithdraw(application) {
  return WITHDRAWABLE_STATUSES.includes(application?.status);
}

/**
 * Withdraw one of the logged-in student's applications (only from `applied` / `under_review`).
 * @returns {Promise<{ ok: true, data: object } | { ok: false, code: string, error: string }>}
 */
export function withdrawApplication(applicationId) {
  return api.post(`/student/applications/${encodeURIComponent(applicationId)}/withdraw`);
}

/* ==========================================================================
   Recruiter review (BR-15, BR-16) — only applications to the recruiter's own jobs
   ========================================================================== */

/** Next statuses a recruiter may choose from the current one (BR-15). */
export function getNextStatuses(status) {
  return [...(RECRUITER_STATUS_FLOW[status] ?? [])];
}

/**
 * One of the recruiter's own jobs with its applicants (newest first, candidate name only).
 * @returns {Promise<{ ok: true, data: { job: object,
 *   items: Array<{ application: object, candidateName: string }> } } | object>}
 */
export function getApplicantsForJob(jobId) {
  return api.get(`/recruiter/jobs/${encodeURIComponent(jobId)}/applications`);
}

/**
 * Full review data for one application to the recruiter's own job.
 * @returns {Promise<{ ok: true, data: { application: object, job: object, candidate: object|null } } | object>}
 */
export function getApplicantDetails(applicationId) {
  return api.get(`/recruiter/applications/${encodeURIComponent(applicationId)}`);
}

/**
 * The applicant's current resume as a PDF Blob — only for an application to the recruiter's own job.
 * @returns {Promise<{ ok: true, data: Blob } | { ok: false, code: string, error: string }>}
 */
export function getApplicantResumeFile(applicationId) {
  return api.download(`/recruiter/applications/${encodeURIComponent(applicationId)}/resume`);
}

/**
 * Move an application one step along its status flow (BR-15) as the recruiter who owns the job.
 * @returns {Promise<{ ok: true, data: object } | { ok: false, code: string, error: string }>}
 */
export function updateApplicationStatus(applicationId, newStatus) {
  return api.patch(`/recruiter/applications/${encodeURIComponent(applicationId)}/status`, { status: newStatus });
}
