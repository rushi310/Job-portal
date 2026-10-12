/**
 * dashboard-service.js — The student and recruiter dashboards, each loaded in one request.
 * The server builds them only from the logged-in user's own records (a student's applications,
 * saved jobs and notifications; a recruiter's own jobs and their applicants).
 */

import * as api from '../core/api.js';
import { toCategoryReport, toFunnel } from './analytics-service.js';

/**
 * Student dashboard: stat numbers, recent applications, status breakdown, recent notifications
 * and recommended jobs.
 * @returns {Promise<{ ok: true, data: { stats: object, recentApplications: Array<object>,
 *   statusBreakdown: object, notifications: object, recommended: object } } | object>}
 */
export async function getStudentDashboard() {
  const result = await api.get('/student/dashboard');
  if (!result.ok) return result;
  return { ok: true, data: { ...result.data, statusBreakdown: toCategoryReport(result.data.statusBreakdown) } };
}

/**
 * Recruiter dashboard: stat numbers, the newest applicants and job-level analytics
 * (applicants per job, status funnel). Pending recruiters get empty applicant data (BR-07).
 * @returns {Promise<{ ok: true, data: { stats: object, recentApplicants: Array<object>,
 *   analytics: object } } | object>}
 */
export async function getRecruiterDashboard() {
  const result = await api.get('/recruiter/dashboard');
  if (!result.ok) return result;
  const { analytics } = result.data;
  return { ok: true, data: { ...result.data, analytics: { ...analytics, funnel: toFunnel(analytics.funnel) } } };
}
