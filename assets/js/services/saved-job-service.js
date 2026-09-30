/**
 * saved-job-service.js — Saved jobs (PROJECT_SPEC.md §5.4).
 * Phase 3: read-only query for the student dashboard. Save / unsave is added in Phase 6.
 */

import { STORAGE_KEYS } from '../core/config.js';
import { getLocal } from '../core/storage.js';

/**
 * Saved-job records of one student.
 * @param {string} studentId
 * @returns {Array<{ studentId: string, jobId: string, savedAt: string }>}
 */
export function getSavedJobsByStudent(studentId) {
  if (!studentId) return [];
  const savedJobs = getLocal(STORAGE_KEYS.SAVED_JOBS, []);
  return Array.isArray(savedJobs) ? savedJobs.filter((record) => record?.studentId === studentId) : [];
}
