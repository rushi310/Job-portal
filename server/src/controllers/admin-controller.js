/**
 * admin-controller.js — HTTP handlers for admin features (every route requires an admin).
 */

const adminService = require('../services/admin-service');
const analyticsService = require('../services/analytics-service');
const { parseUserFilters, parseJobStatus } = require('../validators/admin-validator');
const { parsePaging } = require('../utils/pagination');
const { asyncHandler, sendData } = require('../utils/async-handler');

const getDashboard = asyncHandler(async (req, res) => {
  sendData(res, await adminService.getDashboard());
});

const listUsers = asyncHandler(async (req, res) => {
  sendData(res, await adminService.listUsers(req.user, parseUserFilters(req.query), parsePaging(req.query)));
});

const approveRecruiter = asyncHandler(async (req, res) => {
  sendData(res, await adminService.approveRecruiter(req.user, req.params.userId));
});

const blockUser = asyncHandler(async (req, res) => {
  sendData(res, await adminService.blockUser(req.user, req.params.userId));
});

const unblockUser = asyncHandler(async (req, res) => {
  sendData(res, await adminService.unblockUser(req.user, req.params.userId));
});

const deleteUser = asyncHandler(async (req, res) => {
  sendData(res, await adminService.deleteUser(req.user, req.params.userId));
});

const listJobs = asyncHandler(async (req, res) => {
  sendData(res, await adminService.listJobs({ status: parseJobStatus(req.query.status) }, parsePaging(req.query)));
});

const approveJob = asyncHandler(async (req, res) => {
  sendData(res, await adminService.approveJob(req.params.jobId));
});

const rejectJob = asyncHandler(async (req, res) => {
  sendData(res, await adminService.rejectJob(req.params.jobId, req.body?.reason));
});

const deleteJob = asyncHandler(async (req, res) => {
  sendData(res, await adminService.deleteJob(req.params.jobId));
});

const listAnnouncements = asyncHandler(async (req, res) => {
  sendData(res, { items: await adminService.listSentAnnouncements() });
});

const sendAnnouncement = asyncHandler(async (req, res) => {
  sendData(res, await adminService.sendAnnouncement(req.body), 201);
});

const getReports = asyncHandler(async (req, res) => {
  sendData(res, await analyticsService.getPlatformReport());
});

const resetDemoData = asyncHandler(async (req, res) => {
  sendData(res, await adminService.resetDemoData());
});

module.exports = {
  getDashboard,
  listUsers,
  approveRecruiter,
  blockUser,
  unblockUser,
  deleteUser,
  listJobs,
  approveJob,
  rejectJob,
  deleteJob,
  listAnnouncements,
  sendAnnouncement,
  getReports,
  resetDemoData,
};
