/**
 * saved-job-service.js — Saved jobs (PROJECT_SPEC.md §5.4, BR-18).
 * The server stores only the link between the logged-in student and a job.
 */

import * as api from '../core/api.js';

export const SAVE_ERRORS = Object.freeze({
  NOT_ALLOWED: 'NOT_ALLOWED',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
});

/**
 * The student's saved jobs, most recently saved first, with each job's current availability.
 * Saved links are never removed automatically, even when the job has gone.
 * @returns {Promise<{ ok: true, data: { items: Array<{ record: { jobId: string, savedAt: string },
 *   job: object|null, availability: string }> } } | object>}
 */
export function getSavedJobs() {
  return api.get('/student/saved-jobs');
}

/**
 * Save a job for the logged-in student (BR-18: any approved job, once). Saving twice is harmless.
 * @returns {Promise<{ ok: true, data: { saved: true } } | { ok: false, code: string, error: string }>}
 */
export function saveJob(jobId) {
  return api.put(`/student/saved-jobs/${encodeURIComponent(jobId)}`);
}

/**
 * Remove the logged-in student's saved link to a job. Works even if the job no longer exists.
 * @returns {Promise<{ ok: true, data: { saved: false } } | { ok: false, code: string, error: string }>}
 */
export function unsaveJob(jobId) {
  return api.del(`/student/saved-jobs/${encodeURIComponent(jobId)}`);
}
