/**
 * saved-job-service.js — Saved jobs (PROJECT_SPEC.md §5.4, BR-18).
 * Stores only the relationship { studentId, jobId, savedAt }; job data always comes from job-service.
 * The student is always taken from the session, never from a parameter.
 */

import { STORAGE_KEYS, ROLES } from '../core/config.js';
import { getLocal, setLocal } from '../core/storage.js';
import { parseDate } from '../core/utils.js';
import { getCurrentUser } from '../core/auth.js';
import { getJobById, getVisibleJob, getJobAvailability } from './job-service.js';

export const SAVE_ERRORS = Object.freeze({
  NOT_ALLOWED: 'NOT_ALLOWED',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  STORAGE_ERROR: 'STORAGE_ERROR',
});

/** Well-formed saved-job records only; corrupted entries are ignored. */
function getAllSavedJobs() {
  const savedJobs = getLocal(STORAGE_KEYS.SAVED_JOBS, []);
  if (!Array.isArray(savedJobs)) return [];
  return savedJobs.filter((record) => typeof record?.studentId === 'string' && typeof record.jobId === 'string');
}

/**
 * Saved-job records of one student, most recently saved first.
 * @param {string} studentId
 * @returns {Array<{ studentId: string, jobId: string, savedAt: string }>}
 */
export function getSavedJobsByStudent(studentId) {
  if (!studentId) return [];
  return getAllSavedJobs()
    .filter((record) => record.studentId === studentId)
    .sort((a, b) => parseDate(b.savedAt) - parseDate(a.savedAt));
}

/** @returns {boolean} */
export function isJobSaved(studentId, jobId) {
  return getAllSavedJobs().some((record) => record.studentId === studentId && record.jobId === jobId);
}

/**
 * The student's saved jobs with their current job record and availability (for the Saved Jobs page).
 * Saved links are never removed automatically, even when the job has gone.
 * @returns {Array<{ record: object, job: object|null, availability: string }>}
 */
export function getSavedJobsWithDetails(studentId) {
  return getSavedJobsByStudent(studentId).map((record) => {
    const job = getJobById(record.jobId);
    return { record, job, availability: getJobAvailability(job) };
  });
}

function getCurrentStudent() {
  const user = getCurrentUser();
  return user?.role === ROLES.STUDENT ? user : null;
}

/**
 * Save a job for the logged-in student (BR-18: any approved job, once). Saving twice is harmless.
 * @returns {{ ok: true, data: { saved: true } } | { ok: false, code: string, error: string }}
 */
export function saveJob(jobId) {
  const student = getCurrentStudent();
  if (!student) return { ok: false, code: SAVE_ERRORS.NOT_ALLOWED, error: 'Only students can save jobs.' };
  if (!getVisibleJob(jobId)) {
    return { ok: false, code: SAVE_ERRORS.JOB_NOT_FOUND, error: 'This job is not available.' };
  }
  const savedJobs = getAllSavedJobs();
  if (savedJobs.some((record) => record.studentId === student.id && record.jobId === jobId)) {
    return { ok: true, data: { saved: true } };
  }
  const result = setLocal(STORAGE_KEYS.SAVED_JOBS, [
    ...savedJobs,
    { studentId: student.id, jobId, savedAt: new Date().toISOString() },
  ]);
  return result.ok
    ? { ok: true, data: { saved: true } }
    : { ok: false, code: SAVE_ERRORS.STORAGE_ERROR, error: result.error };
}

/**
 * Remove the logged-in student's saved link to a job (the job itself is untouched).
 * Works even if the job no longer exists, so stale saved jobs can be cleared.
 * @returns {{ ok: true, data: { saved: false } } | { ok: false, code: string, error: string }}
 */
export function unsaveJob(jobId) {
  const student = getCurrentStudent();
  if (!student) return { ok: false, code: SAVE_ERRORS.NOT_ALLOWED, error: 'Only students can save jobs.' };
  const savedJobs = getAllSavedJobs();
  const remaining = savedJobs.filter((record) => !(record.studentId === student.id && record.jobId === jobId));
  if (remaining.length === savedJobs.length) return { ok: true, data: { saved: false } };
  const result = setLocal(STORAGE_KEYS.SAVED_JOBS, remaining);
  return result.ok
    ? { ok: true, data: { saved: false } }
    : { ok: false, code: SAVE_ERRORS.STORAGE_ERROR, error: result.error };
}
