/**
 * application-service.js — Business logic for job applications.
 * Phase 3: read-only queries for the student dashboard.
 * Phase 5: eligibility (BR-14), apply status, and applyToJob (BR-12, BR-13, BR-16, BR-17).
 * Phase 6: withdraw by the student (BR-15). Phase 8: recruiter review and status changes (BR-15, BR-16).
 * Phase 10: applying notifies the job's recruiter; a recruiter status change notifies the student (§4.5).
 */

import {
  STORAGE_KEYS, ROLES, APPLICATION_STATUS, COVER_NOTE_MAX_LENGTH, RECRUITER_STATUS_FLOW,
  PAGE_PATHS, NOTIFICATION_TYPES,
} from '../core/config.js';
import { getLocal, setLocal } from '../core/storage.js';
import { parseDate, generateId, getLabel } from '../core/utils.js';
import { getCurrentUser } from '../core/auth.js';
import {
  getVisibleJob, isJobExpired, getJobById, getJobsByRecruiter, isActiveRecruiter,
} from './job-service.js';
import { findUserById } from './user-service.js';
import { decodeResumeFile } from './profile-service.js';
import { createNotification } from './notification-service.js';

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
  INVALID_TRANSITION: 'INVALID_TRANSITION',
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
  // §4.5: the recruiter who owns the job hears about the new applicant.
  createNotification({
    userId: job.recruiterId,
    type: NOTIFICATION_TYPES.APPLICATION,
    title: 'New applicant',
    message: `${student.name} applied for ${job.title}.`,
    link: `${PAGE_PATHS.APPLICANTS}?jobId=${encodeURIComponent(job.id)}`,
  });
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

/* ==========================================================================
   Recruiter review (Phase 8, BR-15, BR-16)
   Ownership is always application.jobId → job.recruiterId; the application's own `recruiterId`
   copy is never trusted. The recruiter comes from the session and must be `active` (BR-07).
   ========================================================================== */

/** Next statuses a recruiter may choose from the current one (BR-15). */
export function getNextStatuses(status) {
  return [...(RECRUITER_STATUS_FLOW[status] ?? [])];
}

/** @returns {{ recruiter: object } | { failure: object }} */
function getActiveRecruiterOrFailure() {
  const recruiter = getCurrentUser();
  if (recruiter?.role !== ROLES.RECRUITER) {
    return { failure: failure(APPLY_ERRORS.NOT_ALLOWED, 'Please log in as a recruiter.') };
  }
  if (!isActiveRecruiter(recruiter)) {
    return { failure: failure(APPLY_ERRORS.NOT_ALLOWED, 'Your account is awaiting admin approval.') };
  }
  return { recruiter };
}

/** Is this application for a job owned by the recruiter? */
function isOwnedBy(application, recruiterId) {
  const job = getJobById(application?.jobId);
  return Boolean(job) && job.recruiterId === recruiterId;
}

/**
 * What a recruiter may see about an applicant (PROJECT_SPEC.md §3.3: "view student profile/resume"):
 * name, contact details and the profile. Never the password, account status or dates, and the
 * resume only as { fileName, uploadedAt } — the file itself needs getApplicantResumeFile().
 * @returns {object|null}
 */
function toCandidate(studentId) {
  const student = findUserById(studentId);
  if (!student || student.role !== ROLES.STUDENT) return null;
  const { resume, ...profile } = student.profile ?? {};
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    phone: student.phone,
    profile: {
      ...profile,
      resume: resume && typeof resume.fileName === 'string'
        ? { fileName: resume.fileName, uploadedAt: resume.uploadedAt ?? '' } : null,
    },
  };
}

/**
 * Applications to the logged-in active recruiter's own jobs, newest application first.
 * @returns {Array<object>}
 */
export function getApplicationsForRecruiter() {
  const { recruiter, failure: notAllowed } = getActiveRecruiterOrFailure();
  if (notAllowed) return [];
  const ownJobIds = new Set(getJobsByRecruiter(recruiter.id).map((job) => job.id));
  return getAllApplications()
    .filter((application) => ownJobIds.has(application.jobId))
    .sort((a, b) => parseDate(b.appliedAt) - parseDate(a.appliedAt));
}

/**
 * Applicants for one of the recruiter's own jobs, each with the candidate's name.
 * @param {string} jobId
 * @returns {Array<{ application: object, candidateName: string }>} [] for another recruiter's job
 */
export function getApplicantsForJob(jobId) {
  return getRecruiterApplicants().filter(({ application }) => application.jobId === jobId);
}

/**
 * Every applicant to the recruiter's own jobs (newest first) with the candidate's name only.
 * @returns {Array<{ application: object, candidateName: string }>}
 */
export function getRecruiterApplicants() {
  return getApplicationsForRecruiter().map((application) => ({
    application,
    candidateName: toCandidate(application.studentId)?.name ?? 'Unknown student',
  }));
}

function findOwnedApplication(applicationId) {
  const { recruiter, failure: notAllowed } = getActiveRecruiterOrFailure();
  if (notAllowed) return { failure: notAllowed };
  const applications = getAllApplications();
  const index = applications.findIndex((item) => item.id === applicationId);
  if (index === -1 || !isOwnedBy(applications[index], recruiter.id)) {
    return { failure: failure(APPLY_ERRORS.NOT_FOUND, 'Application not found.') };
  }
  return { applications, index, application: applications[index] };
}

/**
 * Full review data for one application to the recruiter's own job.
 * @returns {{ ok: true, data: { application: object, job: object, candidate: object|null } }
 *   | { ok: false, code: string, error: string }}
 */
export function getApplicantDetails(applicationId) {
  const found = findOwnedApplication(applicationId);
  if (found.failure) return found.failure;
  const { application } = found;
  return {
    ok: true,
    data: { application, job: getJobById(application.jobId), candidate: toCandidate(application.studentId) },
  };
}

/**
 * The applicant's current resume as a PDF Blob — only for an application to the recruiter's own job.
 * @returns {{ ok: true, data: { blob: Blob, fileName: string } } | { ok: false, code: string, error: string }}
 */
export function getApplicantResumeFile(applicationId) {
  const found = findOwnedApplication(applicationId);
  if (found.failure) return found.failure;
  const resume = findUserById(found.application.studentId)?.profile?.resume;
  if (!resume) return failure(APPLY_ERRORS.NOT_FOUND, 'This student has no resume on their profile now.');
  return decodeResumeFile(resume, 'This resume file is damaged and cannot be opened.');
}

/**
 * Move an application on its job's status flow (BR-15) as the recruiter who owns the job.
 * The change is appended to statusHistory (BR-16); earlier history is never changed.
 * @param {string} applicationId
 * @param {string} newStatus
 * @returns {{ ok: true, data: object } | { ok: false, code: string, error: string }}
 */
export function updateApplicationStatus(applicationId, newStatus) {
  const found = findOwnedApplication(applicationId);
  if (found.failure) return found.failure;
  const { applications, index, application } = found;
  if (!getNextStatuses(application.status).includes(newStatus)) {
    return failure(APPLY_ERRORS.INVALID_TRANSITION, 'This status change is not allowed.');
  }

  const now = new Date().toISOString();
  const history = Array.isArray(application.statusHistory) ? application.statusHistory : [];
  const updated = {
    ...application,
    status: newStatus,
    statusHistory: [...history, { status: newStatus, at: now, note: '' }],
    updatedAt: now,
  };
  const next = applications.map((item, position) => (position === index ? updated : item));
  const saved = setLocal(STORAGE_KEYS.APPLICATIONS, next);
  if (!saved.ok) return failure(APPLY_ERRORS.STORAGE_ERROR, saved.error);
  notifyStatusChange(updated);
  return { ok: true, data: updated };
}

/** Titles for the student's "application status changed" notification (§4.5). */
const STATUS_NOTIFICATION_TITLES = Object.freeze({
  [APPLICATION_STATUS.UNDER_REVIEW]: 'Application under review',
  [APPLICATION_STATUS.SHORTLISTED]: 'Application shortlisted',
  [APPLICATION_STATUS.INTERVIEW]: 'Moved to interview',
  [APPLICATION_STATUS.SELECTED]: 'You have been selected',
  [APPLICATION_STATUS.REJECTED]: 'Application not selected',
});

/** §4.5: the student hears about a recruiter's status change (withdrawing is their own action). */
function notifyStatusChange(application) {
  const job = getJobById(application.jobId);
  const jobText = job ? `${job.title} at ${job.companyName}` : 'a job';
  createNotification({
    userId: application.studentId,
    type: NOTIFICATION_TYPES.STATUS,
    title: STATUS_NOTIFICATION_TITLES[application.status] ?? 'Application updated',
    message: `Your application for ${jobText} is now: ${getLabel(application.status)}.`,
    link: PAGE_PATHS.APPLICATIONS,
  });
}
