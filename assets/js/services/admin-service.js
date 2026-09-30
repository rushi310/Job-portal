/**
 * admin-service.js — Admin moderation (Phase 9, PROJECT_SPEC.md §3.4, BR-09, BR-20).
 * Every operation re-checks that the logged-in user (from the session) is an admin; pages never
 * pass the acting user. Users: approve recruiters, block / unblock, delete with cleanup of their
 * related data. Jobs: approve / reject with a reason (pending only), delete. Reset demo data.
 * Admin accounts are seed-only (BR-06) and are never blocked or deleted from here.
 * Phase 10: approving a recruiter or approving / rejecting a job notifies the recruiter (§4.5);
 * announcements create one notification per recipient.
 */

import {
  STORAGE_KEYS, ROLES, USER_STATUS, JOB_STATUS, REJECTION_REASON_MAX_LENGTH,
  PAGE_PATHS, NOTIFICATION_TYPES, ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_LIMITS,
} from '../core/config.js';
import { getLocal, setLocal } from '../core/storage.js';
import { parseDate } from '../core/utils.js';
import { ensureSeeded } from '../core/seed.js';
import { getCurrentUser } from '../core/auth.js';
import {
  createNotification, createNotifications, getAnnouncementNotifications,
} from './notification-service.js';

/** Error codes returned in `{ ok: false, code, error }` results. */
export const ADMIN_ERRORS = Object.freeze({
  NOT_ALLOWED: 'NOT_ALLOWED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_ACTION: 'INVALID_ACTION',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
});

function failure(code, error, extra = {}) {
  return { ok: false, code, error, ...extra };
}

/** @returns {object|null} the logged-in admin, or null */
function getAdmin() {
  const user = getCurrentUser();
  return user?.role === ROLES.ADMIN ? user : null;
}

const notAdmin = () => failure(ADMIN_ERRORS.NOT_ALLOWED, 'Only an admin can do this.');
const readArray = (key) => {
  const value = getLocal(key, []);
  return Array.isArray(value) ? value.filter(Boolean) : [];
};
const byNewest = (field) => (a, b) => parseDate(b[field]) - parseDate(a[field]);
const normalize = (value) => String(value ?? '').trim().toLowerCase();

/** Write several collections; stops at the first failure (removals only shrink data). */
function writeAll(entries) {
  for (const [key, value] of entries) {
    const saved = setLocal(key, value);
    if (!saved.ok) return failure(ADMIN_ERRORS.STORAGE_ERROR, saved.error);
  }
  return { ok: true };
}

/* ==========================================================================
   Dashboard
   ========================================================================== */

/**
 * Platform totals (PROJECT_SPEC §3.4): students, recruiters, jobs by status, applications.
 * @returns {object|null} null when the current user is not an admin
 */
export function getPlatformStats() {
  if (!getAdmin()) return null;
  const users = readArray(STORAGE_KEYS.USERS);
  const jobs = readArray(STORAGE_KEYS.JOBS);
  const recruiters = users.filter((user) => user.role === ROLES.RECRUITER);
  return {
    students: users.filter((user) => user.role === ROLES.STUDENT).length,
    recruiters: recruiters.length,
    pendingRecruiters: recruiters.filter((user) => user.status === USER_STATUS.PENDING).length,
    jobs: jobs.length,
    jobsByStatus: Object.fromEntries(Object.values(JOB_STATUS)
      .map((status) => [status, jobs.filter((job) => job.status === status).length])),
    applications: readArray(STORAGE_KEYS.APPLICATIONS).length,
  };
}

/* ==========================================================================
   Users
   ========================================================================== */

/** What the admin screens show about a user — never the password. */
function toUserSummary(user) {
  return {
    id: user.id,
    name: String(user.name ?? ''),
    email: String(user.email ?? ''),
    phone: String(user.phone ?? ''),
    role: user.role,
    status: user.status,
    createdAt: user.createdAt ?? '',
    companyName: user.role === ROLES.RECRUITER ? String(user.profile?.companyName ?? '') : '',
  };
}

/**
 * Users matching a search and filters, newest account first.
 * @param {{ query?: string, role?: string, status?: string }} [filters] '' = any
 * @returns {Array<object>} user summaries ([] when not an admin)
 */
export function listUsers({ query = '', role = '', status = '' } = {}) {
  if (!getAdmin()) return [];
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return readArray(STORAGE_KEYS.USERS)
    .map(toUserSummary)
    .filter((user) => (!role || user.role === role) && (!status || user.status === status))
    .filter((user) => {
      const haystack = normalize(`${user.name} ${user.email} ${user.companyName}`);
      return words.every((word) => haystack.includes(word));
    })
    .sort(byNewest('createdAt'));
}

/** Which actions the admin may take on a user (the same rules the write functions enforce). */
export function getUserActions(user, adminId = getAdmin()?.id) {
  if (!user || user.role === ROLES.ADMIN || user.id === adminId) {
    return { approve: false, block: false, unblock: false, remove: false };
  }
  return {
    approve: user.role === ROLES.RECRUITER && user.status === USER_STATUS.PENDING,
    block: user.status === USER_STATUS.ACTIVE,
    unblock: user.status === USER_STATUS.BLOCKED,
    remove: true,
  };
}

/** Find a user the admin may act on, or a failure. */
function findManagedUser(userId, action) {
  const admin = getAdmin();
  if (!admin) return { failure: notAdmin() };
  const users = readArray(STORAGE_KEYS.USERS);
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) return { failure: failure(ADMIN_ERRORS.NOT_FOUND, 'User not found.') };
  if (users[index].id === admin.id) {
    return { failure: failure(ADMIN_ERRORS.INVALID_ACTION, 'You cannot change your own account.') };
  }
  if (!getUserActions(users[index], admin.id)[action]) {
    return { failure: failure(ADMIN_ERRORS.INVALID_ACTION, 'This action is not available for this account.') };
  }
  return { users, index, user: users[index] };
}

function setStatus(userId, action, status) {
  const found = findManagedUser(userId, action);
  if (found.failure) return found.failure;
  const updated = { ...found.user, status };
  const next = found.users.map((user, position) => (position === found.index ? updated : user));
  const saved = setLocal(STORAGE_KEYS.USERS, next);
  return saved.ok ? { ok: true, data: toUserSummary(updated) } : failure(ADMIN_ERRORS.STORAGE_ERROR, saved.error);
}

/** Approve a pending recruiter: `pending` → `active` (they can post jobs straight away, BR-07). */
export function approveRecruiter(userId) {
  const result = setStatus(userId, 'approve', USER_STATUS.ACTIVE);
  if (result.ok) {
    createNotification({ // §4.5: recruiter account approved → recruiter
      userId,
      type: NOTIFICATION_TYPES.ACCOUNT,
      title: 'Account approved',
      message: 'Your recruiter account has been approved. You can now post jobs.',
      link: PAGE_PATHS.POST_JOB,
    });
  }
  return result;
}

/** Block an active student or recruiter: login is refused and an open session ends on the next page (BR-03). */
export function blockUser(userId) {
  return setStatus(userId, 'block', USER_STATUS.BLOCKED);
}

/** Unblock a blocked student or recruiter: `blocked` → `active`. */
export function unblockUser(userId) {
  return setStatus(userId, 'unblock', USER_STATUS.ACTIVE);
}

/**
 * Delete a student or recruiter and their related data:
 * - student: their applications, saved jobs and notifications;
 * - recruiter: their jobs, every application and saved job for those jobs, and their notifications.
 * @returns {{ ok: true, data: { removed: object } } | { ok: false, code: string, error: string }}
 */
export function deleteUser(userId) {
  const found = findManagedUser(userId, 'remove');
  if (found.failure) return found.failure;
  const { user } = found;

  const jobs = readArray(STORAGE_KEYS.JOBS);
  const ownJobIds = new Set(user.role === ROLES.RECRUITER
    ? jobs.filter((job) => job.recruiterId === user.id).map((job) => job.id) : []);
  const applications = readArray(STORAGE_KEYS.APPLICATIONS);
  const savedJobs = readArray(STORAGE_KEYS.SAVED_JOBS);
  const notifications = readArray(STORAGE_KEYS.NOTIFICATIONS);

  const keepApplication = (item) => item.studentId !== user.id && !ownJobIds.has(item.jobId);
  const keepSaved = (item) => item.studentId !== user.id && !ownJobIds.has(item.jobId);
  const removed = {
    jobs: ownJobIds.size,
    applications: applications.filter((item) => !keepApplication(item)).length,
    savedJobs: savedJobs.filter((item) => !keepSaved(item)).length,
  };

  const result = writeAll([
    [STORAGE_KEYS.APPLICATIONS, applications.filter(keepApplication)],
    [STORAGE_KEYS.SAVED_JOBS, savedJobs.filter(keepSaved)],
    [STORAGE_KEYS.NOTIFICATIONS, notifications.filter((item) => item.userId !== user.id)],
    [STORAGE_KEYS.JOBS, jobs.filter((job) => !ownJobIds.has(job.id))],
    [STORAGE_KEYS.USERS, found.users.filter((item) => item.id !== user.id)], // last: the account goes only after its data
  ]);
  return result.ok ? { ok: true, data: { user: toUserSummary(user), removed } } : result;
}

/* ==========================================================================
   Jobs
   ========================================================================== */

/**
 * All jobs (every status), newest first, with the recruiter's name and applicant count.
 * @param {{ status?: string }} [filters] '' = any
 * @returns {Array<{ job: object, recruiterName: string, applicantCount: number }>}
 */
export function listJobs({ status = '' } = {}) {
  if (!getAdmin()) return [];
  const users = new Map(readArray(STORAGE_KEYS.USERS).map((user) => [user.id, user]));
  const counts = new Map();
  readArray(STORAGE_KEYS.APPLICATIONS).forEach((item) => counts.set(item.jobId, (counts.get(item.jobId) ?? 0) + 1));
  return readArray(STORAGE_KEYS.JOBS)
    .filter((job) => typeof job.id === 'string' && typeof job.title === 'string')
    .filter((job) => !status || job.status === status)
    .sort(byNewest('postedAt'))
    .map((job) => ({
      job,
      recruiterName: users.get(job.recruiterId)?.name ?? 'Deleted recruiter',
      applicantCount: counts.get(job.id) ?? 0,
    }));
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

function updateJob(jobId, change) {
  if (!getAdmin()) return notAdmin();
  const jobs = readArray(STORAGE_KEYS.JOBS);
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return failure(ADMIN_ERRORS.NOT_FOUND, 'Job not found.');
  if (!canModerateJob(jobs[index])) {
    return failure(ADMIN_ERRORS.INVALID_ACTION, 'Only pending jobs can be approved or rejected.');
  }
  // Owner, company and every recruiter-entered field stay exactly as they were.
  const updated = { ...jobs[index], ...change, updatedAt: new Date().toISOString() };
  const next = jobs.map((job, position) => (position === index ? updated : job));
  const saved = setLocal(STORAGE_KEYS.JOBS, next);
  return saved.ok ? { ok: true, data: updated } : failure(ADMIN_ERRORS.STORAGE_ERROR, saved.error);
}

/** §4.5: job approved / rejected → the recruiter who owns it. */
function notifyJobDecision(job) {
  const approved = job.status === JOB_STATUS.APPROVED;
  createNotification({
    userId: job.recruiterId,
    type: NOTIFICATION_TYPES.JOB,
    title: approved ? 'Job approved' : 'Job rejected',
    message: approved
      ? `Your job "${job.title}" is now live for students.`
      : `"${job.title}" was rejected: ${job.rejectionReason}`,
    link: PAGE_PATHS.MY_JOBS,
  });
}

/** Approve a pending job: students can see it in search (BR-08). */
export function approveJob(jobId) {
  const result = updateJob(jobId, { status: JOB_STATUS.APPROVED, rejectionReason: '' });
  if (result.ok) notifyJobDecision(result.data);
  return result;
}

/** Reject a pending job with a reason the recruiter sees on My Jobs (BR-09). */
export function rejectJob(jobId, reason) {
  const message = validateRejectionReason(reason);
  if (message) return failure(ADMIN_ERRORS.VALIDATION_FAILED, message, { fieldErrors: { reason: message } });
  const result = updateJob(jobId, { status: JOB_STATUS.REJECTED, rejectionReason: String(reason).trim() });
  if (result.ok) notifyJobDecision(result.data);
  return result;
}

/* ==========================================================================
   Announcements (Phase 10, PROJECT_SPEC §3.4, §4.5)
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
 * Send an announcement: one notification per recipient (PROJECT_SPEC §5.5). Recipients are the
 * audience's accounts that can log in (blocked accounts are skipped).
 * @returns {{ ok: true, data: { recipients: number } }
 *   | { ok: false, code: string, error: string, fieldErrors?: object }}
 */
export function sendAnnouncement(values = {}) {
  if (!getAdmin()) return notAdmin();
  const fieldErrors = validateAnnouncement(values);
  if (Object.keys(fieldErrors).length > 0) {
    return failure(ADMIN_ERRORS.VALIDATION_FAILED, 'Please correct the highlighted fields.', { fieldErrors });
  }
  const { roles } = ANNOUNCEMENT_AUDIENCES.find((item) => item.value === values.audience);
  const recipients = readArray(STORAGE_KEYS.USERS)
    .filter((user) => roles.includes(user.role) && user.status !== USER_STATUS.BLOCKED);
  if (recipients.length === 0) return failure(ADMIN_ERRORS.INVALID_ACTION, 'There is nobody in this audience yet.');

  const result = createNotifications(recipients.map((user) => ({
    userId: user.id,
    type: NOTIFICATION_TYPES.ANNOUNCEMENT,
    title: values.title,
    message: values.message,
  })));
  return result.ok ? { ok: true, data: { recipients: recipients.length } } : failure(ADMIN_ERRORS.STORAGE_ERROR, result.error);
}

/**
 * Sent announcements, newest first, rebuilt from the announcement notifications: one entry per
 * send (same title, message and time). The audience is worked out from the recipients' roles.
 * @returns {Array<{ title: string, message: string, sentAt: string, recipients: number, audience: string }>}
 */
export function getSentAnnouncements() {
  if (!getAdmin()) return [];
  const roles = new Map(readArray(STORAGE_KEYS.USERS).map((user) => [user.id, user.role]));
  const groups = new Map();
  getAnnouncementNotifications().forEach((item) => {
    const key = JSON.stringify([item.title, item.message, item.createdAt]);
    const group = groups.get(key) ?? { title: item.title, message: item.message, sentAt: item.createdAt, userIds: [] };
    group.userIds.push(item.userId);
    groups.set(key, group);
  });
  return [...groups.values()].map(({ userIds, ...group }) => {
    const groupRoles = new Set(userIds.map((id) => roles.get(id)).filter(Boolean));
    const audience = groupRoles.size > 1 ? 'all' : groupRoles.has('recruiter') ? 'recruiters' : 'students';
    return {
      ...group,
      recipients: userIds.length,
      audience: ANNOUNCEMENT_AUDIENCES.find((item) => item.value === audience).label,
    };
  });
}

/**
 * Delete a job. Its applications and saved-job links stay as history, like any job that
 * disappears (PROJECT_SPEC §3.2): students see "Job no longer available".
 */
export function deleteJob(jobId) {
  if (!getAdmin()) return notAdmin();
  const jobs = readArray(STORAGE_KEYS.JOBS);
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return failure(ADMIN_ERRORS.NOT_FOUND, 'Job not found.');
  const saved = setLocal(STORAGE_KEYS.JOBS, jobs.filter((item) => item.id !== jobId));
  return saved.ok ? { ok: true, data: job } : failure(ADMIN_ERRORS.STORAGE_ERROR, saved.error);
}

/* ==========================================================================
   Reset demo data (BR-20)
   ========================================================================== */

/**
 * Replace all FreshHire data with the seed files. The files are loaded first, so a failure
 * leaves the current data untouched. The admin's session stays valid (seed admin keeps its id).
 * @returns {Promise<{ ok: true } | { ok: false, code: string, error: string }>}
 */
export async function resetDemoData() {
  if (!getAdmin()) return notAdmin();
  try {
    await ensureSeeded({ force: true });
    return { ok: true };
  } catch (error) {
    return failure(ADMIN_ERRORS.STORAGE_ERROR, error.message);
  }
}
