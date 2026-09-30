/**
 * application-service.js — Business logic for job applications.
 * Phase 3: read-only queries for the student dashboard.
 * Apply / withdraw (Phase 5) and recruiter status changes (Phase 8) are added later.
 */

import { STORAGE_KEYS } from '../core/config.js';
import { getLocal } from '../core/storage.js';
import { parseDate } from '../core/utils.js';

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
