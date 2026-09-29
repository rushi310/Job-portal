/**
 * job-service.js — Business logic for jobs.
 * Phase 1: read-only getters used by the landing page.
 * Search/filter (Phase 4) and create/update/approve (Phases 8–9) are added later.
 */

import { STORAGE_KEYS, JOB_STATUS, JOB_TYPES, WORK_MODES } from '../core/config.js';
import { getLocal } from '../core/storage.js';
import { isDeadlinePassed, parseDate } from '../core/utils.js';

/** @returns {Array<object>} every job in storage */
export function getAllJobs() {
  return getLocal(STORAGE_KEYS.JOBS, []);
}

/** @returns {object|null} */
export function getJobById(jobId) {
  return getAllJobs().find((job) => job.id === jobId) ?? null;
}

/** Expiry is computed from the deadline, never stored (BR-12). */
export function isJobExpired(job) {
  return isDeadlinePassed(job.deadline);
}

/** Newest first by posting date. */
function byNewest(a, b) {
  return parseDate(b.postedAt) - parseDate(a.postedAt);
}

/**
 * Jobs visible to students (BR-08): approved only.
 * @param {{ includeExpired?: boolean }} options
 */
export function getApprovedJobs({ includeExpired = false } = {}) {
  return getAllJobs()
    .filter((job) => job.status === JOB_STATUS.APPROVED)
    .filter((job) => includeExpired || !isJobExpired(job))
    .sort(byNewest);
}

/** Latest approved, non-expired jobs for the landing page. */
export function getFeaturedJobs(limit) {
  return getApprovedJobs().slice(0, limit);
}

/** Headline numbers for the landing page stats strip (open, non-expired jobs only). */
export function getPublicJobStats() {
  const openJobs = getApprovedJobs();
  return {
    openJobs: openJobs.length,
    hiringCompanies: new Set(openJobs.map((job) => job.companyName)).size,
    internships: openJobs.filter((job) => job.jobType === JOB_TYPES.INTERNSHIP).length,
    remoteOrHybrid: openJobs.filter((job) => job.workMode !== WORK_MODES.ON_SITE).length,
  };
}
