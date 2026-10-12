/**
 * recruiter-controller.js — HTTP handlers for recruiter features. The recruiter is always
 * `req.user`; job and application ids from the URL are checked for ownership in the services.
 */

const jobService = require('../services/job-service');
const applicationService = require('../services/application-service');
const profileService = require('../services/profile-service');
const analyticsService = require('../services/analytics-service');
const { USER_STATUS, JOB_STATUS, APPLICATION_STATUS } = require('../config/constants');
const { parseJobStatus } = require('../validators/admin-validator');
const { toJob } = require('../utils/serializers');
const { asyncHandler, sendData } = require('../utils/async-handler');
const { sendResume } = require('./student-controller');

const RECENT_APPLICANTS = 5;
const isActive = (user) => user.status === USER_STATUS.ACTIVE;

/** Applications to the recruiter's own jobs that are currently shortlisted. */
async function countShortlisted(recruiter) {
  const applications = await applicationService.findRecruiterApplications(recruiter._id, { select: 'status' });
  return applications.filter((application) => application.status === APPLICATION_STATUS.SHORTLISTED).length;
}

/** Stats, recent applicants and job-level analytics, all from the recruiter's own jobs. */
const getDashboard = asyncHandler(async (req, res) => {
  const recruiter = req.user;
  const canSeeApplicants = isActive(recruiter); // BR-07: nothing about applicants while pending
  const [analytics, recentApplicants, shortlisted] = await Promise.all([
    analyticsService.getRecruiterAnalytics(recruiter),
    canSeeApplicants ? applicationService.listRecentApplicants(recruiter, RECENT_APPLICANTS) : [],
    canSeeApplicants ? countShortlisted(recruiter) : 0,
  ]);
  sendData(res, {
    stats: {
      activeJobs: analytics.jobs.filter((job) => job.status === JOB_STATUS.APPROVED && !job.isExpired).length,
      totalApplicants: analytics.totalApplicants,
      shortlisted,
      pendingApproval: analytics.jobs.filter((job) => job.status === JOB_STATUS.PENDING).length,
    },
    recentApplicants,
    analytics,
  });
});

const listJobs = asyncHandler(async (req, res) => {
  sendData(res, await jobService.listOwnJobs(req.user, {
    status: parseJobStatus(req.query.status),
    canSeeApplicants: isActive(req.user),
  }));
});

const getJob = asyncHandler(async (req, res) => {
  sendData(res, toJob(await jobService.findOwnJob(req.user._id, req.params.jobId)));
});

const createJob = asyncHandler(async (req, res) => {
  sendData(res, await jobService.createJob(req.user, req.body), 201);
});

const updateJob = asyncHandler(async (req, res) => {
  sendData(res, await jobService.updateJob(req.user, req.params.jobId, req.body));
});

const closeJob = asyncHandler(async (req, res) => {
  sendData(res, await jobService.closeJob(req.user, req.params.jobId));
});

const listApplicants = asyncHandler(async (req, res) => {
  sendData(res, await applicationService.listApplicantsForJob(req.user, req.params.jobId));
});

const getApplicant = asyncHandler(async (req, res) => {
  sendData(res, await applicationService.getApplicantDetails(req.user, req.params.applicationId));
});

const getApplicantResume = asyncHandler(async (req, res) => {
  sendResume(res, await applicationService.getApplicantResume(req.user, req.params.applicationId));
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
  sendData(res, await applicationService.updateApplicationStatus(req.user, req.params.applicationId, req.body?.status));
});

const updateCompanyProfile = asyncHandler(async (req, res) => {
  sendData(res, await profileService.updateCompanyProfile(req.user, req.body));
});

module.exports = {
  getDashboard,
  listJobs,
  getJob,
  createJob,
  updateJob,
  closeJob,
  listApplicants,
  getApplicant,
  getApplicantResume,
  updateApplicationStatus,
  updateCompanyProfile,
};
