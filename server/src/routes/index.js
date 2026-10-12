/**
 * routes/index.js — Every API route, grouped by who may call it.
 * Protection is declared here, next to each group, so it is easy to audit:
 * `authenticate` → a valid login; `requireRole` → the role; `requireActiveRecruiter` → an
 * approved recruiter (BR-07). Ownership of individual records is checked in the services.
 */

const express = require('express');
const { ROLES, LIMITS, RESUME_MIME_TYPE } = require('../config/constants');
const {
  authenticate, requireRole, requireActiveRecruiter, validateIdParam,
} = require('../middleware/auth');
const { createAuthLimiter } = require('../middleware/rate-limiters');
const authController = require('../controllers/auth-controller');
const publicController = require('../controllers/public-controller');
const student = require('../controllers/student-controller');
const recruiter = require('../controllers/recruiter-controller');
const admin = require('../controllers/admin-controller');
const notifications = require('../controllers/notification-controller');

/** The resume upload is the raw PDF as the request body; a little above the limit so the service can explain. */
const resumeBody = express.raw({ type: RESUME_MIME_TYPE, limit: LIMITS.MAX_RESUME_SIZE + 1024 });

function createAuthRouter() {
  const router = express.Router();
  router.post('/register', createAuthLimiter(), authController.register);
  router.post('/login', createAuthLimiter(undefined, { failedOnly: true }), authController.login);
  router.post('/logout', authenticate, authController.logout);
  router.get('/me', authenticate, authController.getMe);
  return router;
}

/** Job search and applying: students only (the landing page uses /public/landing instead). */
function createJobRouter() {
  const router = express.Router();
  router.use(authenticate, requireRole(ROLES.STUDENT));

  router.get('/', student.searchJobs);
  router.get('/filter-options', student.getFilterOptions);
  router.get('/:jobId', validateIdParam('jobId'), student.getJobDetails);
  router.post('/:jobId/applications', validateIdParam('jobId'), student.applyToJob);
  return router;
}

function createStudentRouter() {
  const router = express.Router();
  router.use(authenticate, requireRole(ROLES.STUDENT));

  router.get('/dashboard', student.getDashboard);
  router.get('/applications', student.listApplications);
  router.post('/applications/:applicationId/withdraw', validateIdParam('applicationId'), student.withdrawApplication);

  router.get('/saved-jobs', student.listSavedJobs);
  router.put('/saved-jobs/:jobId', validateIdParam('jobId'), student.saveJob);
  router.delete('/saved-jobs/:jobId', validateIdParam('jobId'), student.unsaveJob);

  router.patch('/profile/:section', student.updateProfileSection);
  router.get('/resume', student.getOwnResume);
  router.put('/resume', resumeBody, student.uploadResume);
  router.delete('/resume', student.removeResume);
  return router;
}

function createRecruiterRouter() {
  const router = express.Router();
  router.use(authenticate, requireRole(ROLES.RECRUITER));

  // Available while the account is still pending approval.
  router.get('/dashboard', recruiter.getDashboard);
  router.get('/jobs', recruiter.listJobs);
  router.patch('/profile', recruiter.updateCompanyProfile);

  // Everything below needs an approved recruiter (BR-07).
  router.use(requireActiveRecruiter);
  router.post('/jobs', recruiter.createJob);
  router.get('/jobs/:jobId', validateIdParam('jobId'), recruiter.getJob);
  router.patch('/jobs/:jobId', validateIdParam('jobId'), recruiter.updateJob);
  router.post('/jobs/:jobId/close', validateIdParam('jobId'), recruiter.closeJob);
  router.get('/jobs/:jobId/applications', validateIdParam('jobId'), recruiter.listApplicants);
  router.get('/applications/:applicationId', validateIdParam('applicationId'), recruiter.getApplicant);
  router.get('/applications/:applicationId/resume', validateIdParam('applicationId'), recruiter.getApplicantResume);
  router.patch('/applications/:applicationId/status', validateIdParam('applicationId'), recruiter.updateApplicationStatus);
  return router;
}

function createAdminRouter() {
  const router = express.Router();
  router.use(authenticate, requireRole(ROLES.ADMIN));

  router.get('/dashboard', admin.getDashboard);
  router.get('/users', admin.listUsers);
  router.post('/users/:userId/approve', validateIdParam('userId'), admin.approveRecruiter);
  router.post('/users/:userId/block', validateIdParam('userId'), admin.blockUser);
  router.post('/users/:userId/unblock', validateIdParam('userId'), admin.unblockUser);
  router.delete('/users/:userId', validateIdParam('userId'), admin.deleteUser);

  router.get('/jobs', admin.listJobs);
  router.post('/jobs/:jobId/approve', validateIdParam('jobId'), admin.approveJob);
  router.post('/jobs/:jobId/reject', validateIdParam('jobId'), admin.rejectJob);
  router.delete('/jobs/:jobId', validateIdParam('jobId'), admin.deleteJob);

  router.get('/announcements', admin.listAnnouncements);
  router.post('/announcements', admin.sendAnnouncement);
  router.get('/reports', admin.getReports);
  router.post('/reset-demo-data', admin.resetDemoData);
  return router;
}

function createNotificationRouter() {
  const router = express.Router();
  router.use(authenticate);
  router.get('/', notifications.list);
  router.get('/unread-count', notifications.getUnreadCount);
  router.post('/read-all', notifications.markAllAsRead);
  router.post('/:notificationId/read', validateIdParam('notificationId'), notifications.markAsRead);
  return router;
}

/** Build the /api router. */
function createApiRouter() {
  const router = express.Router();
  router.get('/health', publicController.getHealth);
  router.get('/public/landing', publicController.getLanding);
  router.use('/auth', createAuthRouter());
  router.use('/jobs', createJobRouter());
  router.use('/student', createStudentRouter());
  router.use('/recruiter', createRecruiterRouter());
  router.use('/admin', createAdminRouter());
  router.use('/notifications', createNotificationRouter());
  return router;
}

module.exports = { createApiRouter };
