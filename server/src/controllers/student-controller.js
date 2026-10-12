/**
 * student-controller.js — HTTP handlers for student features. The student is always `req.user`.
 */

const jobService = require('../services/job-service');
const applicationService = require('../services/application-service');
const savedJobService = require('../services/saved-job-service');
const profileService = require('../services/profile-service');
const analyticsService = require('../services/analytics-service');
const notificationService = require('../services/notification-service');
const { APPLICATION_STATUS, LIMITS } = require('../config/constants');
const { parseJobSearch } = require('../validators/job-validator');
const { parsePaging } = require('../utils/pagination');
const { text } = require('../utils/text');
const { asyncHandler, sendData } = require('../utils/async-handler');

const RECENT_APPLICATIONS = 5;
const RECENT_UPDATES = 3;
const RECOMMENDED_JOBS = 3;

/** Send a PDF so the browser shows or saves it; never cached by shared caches. */
function sendResume(res, { data, fileName, contentType }) {
  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="resume.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(data);
}

const searchJobs = asyncHandler(async (req, res) => {
  const paging = parsePaging(req.query, { defaultLimit: LIMITS.JOBS_PER_PAGE });
  sendData(res, await jobService.searchJobs(parseJobSearch(req.query), paging, req.user._id));
});

const getFilterOptions = asyncHandler(async (req, res) => {
  sendData(res, await jobService.getFilterOptions());
});

const getJobDetails = asyncHandler(async (req, res) => {
  sendData(res, await applicationService.getJobDetailsForStudent(req.user, req.params.jobId));
});

const applyToJob = asyncHandler(async (req, res) => {
  sendData(res, await applicationService.applyToJob(req.user, req.params.jobId, req.body), 201);
});

/** Everything on the student dashboard in one response, all limited to the student's own records. */
const getDashboard = asyncHandler(async (req, res) => {
  const student = req.user;
  const [applications, savedJobs, statusBreakdown, notifications, recommended] = await Promise.all([
    applicationService.listForStudent(student, {}, { page: 1, limit: RECENT_APPLICATIONS }),
    savedJobService.countSavedJobs(student._id),
    analyticsService.getStudentStatusBreakdown(student),
    notificationService.listForUser(student._id, { page: 1, limit: RECENT_UPDATES }),
    jobService.getRecommendedJobs(student, RECOMMENDED_JOBS),
  ]);
  sendData(res, {
    stats: {
      applications: applications.counts.all,
      shortlisted: applications.counts[APPLICATION_STATUS.SHORTLISTED],
      savedJobs,
    },
    recentApplications: applications.items,
    statusBreakdown,
    notifications: { items: notifications.items, unread: notifications.unread, total: notifications.total },
    recommended,
  });
});

const listApplications = asyncHandler(async (req, res) => {
  const status = Object.values(APPLICATION_STATUS).includes(text(req.query.status)) ? text(req.query.status) : '';
  sendData(res, await applicationService.listForStudent(req.user, { status }, parsePaging(req.query)));
});

const withdrawApplication = asyncHandler(async (req, res) => {
  sendData(res, await applicationService.withdrawApplication(req.user, req.params.applicationId));
});

const listSavedJobs = asyncHandler(async (req, res) => {
  sendData(res, await savedJobService.listSavedJobs(req.user));
});

const saveJob = asyncHandler(async (req, res) => {
  sendData(res, await savedJobService.saveJob(req.user, req.params.jobId));
});

const unsaveJob = asyncHandler(async (req, res) => {
  sendData(res, await savedJobService.unsaveJob(req.user, req.params.jobId));
});

const updateProfileSection = asyncHandler(async (req, res) => {
  sendData(res, await profileService.updateProfileSection(req.user, req.params.section, req.body));
});

const uploadResume = asyncHandler(async (req, res) => {
  sendData(res, await profileService.uploadResume(req.user, req.body, {
    contentType: req.get('content-type'),
    fileName: req.get('x-file-name'),
  }));
});

const removeResume = asyncHandler(async (req, res) => {
  sendData(res, await profileService.removeResume(req.user));
});

const getOwnResume = asyncHandler(async (req, res) => {
  sendResume(res, await profileService.getOwnResume(req.user));
});

module.exports = {
  sendResume,
  searchJobs,
  getFilterOptions,
  getJobDetails,
  applyToJob,
  getDashboard,
  listApplications,
  withdrawApplication,
  listSavedJobs,
  saveJob,
  unsaveJob,
  updateProfileSection,
  uploadResume,
  removeResume,
  getOwnResume,
};
