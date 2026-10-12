/**
 * admin-service.js — Admin moderation (PROJECT_SPEC.md §3.4, BR-09, BR-20): the API calls for
 * users, jobs, announcements and the demo reset, plus the form rules for quick feedback.
 * Every one of these routes is refused by the server unless the login token belongs to an admin.
 */

import {
  JOB_STATUS, REJECTION_REASON_MAX_LENGTH, ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_LIMITS, ADMIN_PAGE_SIZE,
} from '../core/config.js';
import * as api from '../core/api.js';

/** Error codes returned in `{ ok: false, code, error }` results. */
export const ADMIN_ERRORS = Object.freeze({
  NOT_ALLOWED: 'NOT_ALLOWED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_ACTION: 'INVALID_ACTION',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
});

const id = encodeURIComponent;

/* ==========================================================================
   Dashboard
   ========================================================================== */

/**
 * Platform totals, the newest recruiters and jobs waiting for approval, and whether the demo
 * reset is allowed on this server.
 * @returns {Promise<{ ok: true, data: { stats: object, pendingRecruiters: Array<object>,
 *   pendingJobs: Array<object>, demoResetEnabled: boolean } } | object>}
 */
export function getAdminDashboard() {
  return api.get('/admin/dashboard');
}

/* ==========================================================================
   Users
   ========================================================================== */

/**
 * One page of users matching a search and filters, newest account first. Each user comes with
 * `actions`: which of approve / block / unblock / remove the server allows for that account.
 * @param {{ query?: string, role?: string, status?: string, page?: number }} [filters] '' = any
 * @returns {Promise<{ ok: true, data: { items: Array<object>, page: number, totalPages: number,
 *   total: number } } | object>}
 */
export function listUsers({ query = '', role = '', status = '', page = 1 } = {}) {
  return api.get('/admin/users', { query, role, status, page, limit: ADMIN_PAGE_SIZE });
}

/** Approve a pending recruiter: `pending` → `active` (they can post jobs straight away, BR-07). */
export const approveRecruiter = (userId) => api.post(`/admin/users/${id(userId)}/approve`);
/** Block an active student or recruiter: login is refused and open sessions end (BR-03). */
export const blockUser = (userId) => api.post(`/admin/users/${id(userId)}/block`);
/** Unblock a blocked student or recruiter: `blocked` → `active`. */
export const unblockUser = (userId) => api.post(`/admin/users/${id(userId)}/unblock`);
/**
 * Delete a student or recruiter and their related data.
 * @returns {Promise<{ ok: true, data: { user: object, removed: object } } | object>}
 */
export const deleteUser = (userId) => api.del(`/admin/users/${id(userId)}`);

/* ==========================================================================
   Jobs
   ========================================================================== */

/**
 * One page of jobs (every status), newest first, with the recruiter's name and applicant count,
 * plus the number of jobs in each status.
 * @param {{ status?: string, page?: number }} [filters] '' = any status
 * @returns {Promise<{ ok: true, data: { items: Array<{ job: object, recruiterName: string,
 *   applicantCount: number }>, counts: Object<string, number>, page: number, totalPages: number } } | object>}
 */
export function listJobs({ status = '', page = 1 } = {}) {
  return api.get('/admin/jobs', { status, page, limit: ADMIN_PAGE_SIZE });
}

/** Approve and reject apply to pending jobs only (BR-09). */
export const canModerateJob = (job) => job?.status === JOB_STATUS.PENDING;

/** @returns {string} error message, or '' when the reason is acceptable */
export function validateRejectionReason(reason) {
  const text = String(reason ?? '').trim();
  if (!text) return 'Please give a reason. The recruiter will see it.';
  return text.length > REJECTION_REASON_MAX_LENGTH
    ? `The reason must be ${REJECTION_REASON_MAX_LENGTH} characters or fewer.` : '';
}

/** Approve a pending job: students can see it in search (BR-08). */
export const approveJob = (jobId) => api.post(`/admin/jobs/${id(jobId)}/approve`);
/** Reject a pending job with a reason the recruiter sees on My Jobs (BR-09). */
export const rejectJob = (jobId, reason) => api.post(`/admin/jobs/${id(jobId)}/reject`, { reason });
/** Delete a job. Its applications and saved links stay as history (PROJECT_SPEC §3.2). */
export const deleteJob = (jobId) => api.del(`/admin/jobs/${id(jobId)}`);

/* ==========================================================================
   Announcements (PROJECT_SPEC §3.4, §4.5)
   ========================================================================== */

/**
 * Validate an announcement form.
 * @returns {Object<string, string>} field → message (empty = valid)
 */
export function validateAnnouncement({ audience, title, message } = {}) {
  const errors = {};
  if (!ANNOUNCEMENT_AUDIENCES.some((item) => item.value === audience)) errors.audience = 'Please choose who receives it.';
  const titleText = String(title ?? '').trim();
  if (!titleText) errors.title = 'Please enter a title.';
  else if (titleText.length > ANNOUNCEMENT_LIMITS.TITLE) errors.title = `The title must be ${ANNOUNCEMENT_LIMITS.TITLE} characters or fewer.`;
  const messageText = String(message ?? '').trim();
  if (!messageText) errors.message = 'Please enter a message.';
  else if (messageText.length > ANNOUNCEMENT_LIMITS.MESSAGE) errors.message = `The message must be ${ANNOUNCEMENT_LIMITS.MESSAGE} characters or fewer.`;
  return errors;
}

/**
 * Send an announcement: one notification per account in the audience that can log in.
 * @returns {Promise<{ ok: true, data: { recipients: number } } | object>}
 */
export function sendAnnouncement({ audience, title, message } = {}) {
  return api.post('/admin/announcements', { audience, title, message });
}

/**
 * Sent announcements, newest first, with the audience's label.
 * @returns {Promise<{ ok: true, data: Array<{ title: string, message: string, sentAt: string,
 *   recipients: number, audience: string }> } | object>}
 */
export async function getSentAnnouncements() {
  const result = await api.get('/admin/announcements');
  if (!result.ok) return result;
  const labelOf = (value) => ANNOUNCEMENT_AUDIENCES.find((item) => item.value === value)?.label ?? value;
  return { ok: true, data: result.data.items.map((item) => ({ ...item, audience: labelOf(item.audience) })) };
}

/* ==========================================================================
   Reset demo data (BR-20)
   ========================================================================== */

/**
 * Replace everything except admin accounts with the demo data. Works only on a server that
 * allows it (ALLOW_DEMO_RESET); otherwise the server answers FEATURE_DISABLED.
 * @returns {Promise<{ ok: true, data: object } | { ok: false, code: string, error: string }>}
 */
export function resetDemoData() {
  return api.post('/admin/reset-demo-data');
}
